from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.analysis import Analysis
from ..services.llm_client import LLMClient
from ..services.prompts import CODE_CHAT_PROMPT
from ..services.vector_store import VectorStoreService
from ..db import get_async_session
from ..utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/analysis", tags=["chat"])


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]
    metrics: dict[str, Any]


@router.post("/{analysis_id}/chat", response_model=ChatResponse)
async def chat_with_repository(
    analysis_id: str,
    request: ChatRequest,
    session: AsyncSession = Depends(get_async_session),
):
    """Ask a question about a specific repository analysis."""

    analysis = await session.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Analysis is in '{analysis.status}' state. Chat is only available for completed analyses.",
        )

    try:
        # 1. Retrieve relevant context from vector store (won't crash if no index)
        vs = VectorStoreService(analysis_id)
        docs = await vs.query(request.question)

        context_parts: list[str] = []
        sources: list[str] = []
        for doc in docs:
            source = doc.metadata.get("source", "unknown")
            sources.append(source)
            context_parts.append(f"--- File: {source} ---\n{doc.page_content}")

        context = "\n\n".join(context_parts) if context_parts else "No code context indexed yet."

        # 2. Generate answer using LLM
        llm = LLMClient()

        if not llm._api_key:
            raise HTTPException(
                status_code=503,
                detail="AI provider is not configured. Please set your API key in the backend .env file.",
            )

        prompt = CODE_CHAT_PROMPT.format(
            context=context,
            question=request.question,
        )

        answer, metrics = await llm.generate(
            messages=[{"role": "user", "content": prompt}]
        )

        return ChatResponse(
            answer=answer,
            sources=list(set(sources)),
            metrics=metrics.to_dict(),
        )

    except HTTPException:
        raise
    except ValueError as exc:
        # API key missing or schema validation error
        logger.warning("chat_config_error", extra={"analysis_id": analysis_id, "error": str(exc)})
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("chat_failed", extra={"analysis_id": analysis_id, "exception": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate AI response: {exc}",
        )
    finally:
        if "llm" in locals():
            await llm.close()
