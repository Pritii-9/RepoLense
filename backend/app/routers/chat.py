from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
import json
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


@router.post("/{analysis_id}/chat")
async def chat_with_repository(
    analysis_id: str,
    request: ChatRequest,
    session: AsyncSession = Depends(get_async_session),
):
    """Ask a question about a specific repository analysis (Streaming)."""

    analysis = await session.get(Analysis, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if analysis.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Analysis is in '{analysis.status}' state. Chat is only available for completed analyses.",
        )

    # 1. Retrieve relevant context from vector store
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

    async def event_generator():
        try:
            # Send sources first
            yield f"data: {json.dumps({'sources': list(set(sources))})}\n\n"

            async for chunk in llm.generate_stream(
                messages=[{"role": "user", "content": prompt}]
            ):
                yield f"data: {json.dumps({'text': chunk})}\n\n"
        except Exception as exc:
            logger.exception("chat_stream_failed", extra={"analysis_id": analysis_id, "exception": str(exc)})
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            await llm.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
