from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..db import get_async_session
from ..models.ai_insight import AiInsight
from ..models.analysis import Analysis
from ..models.user import User
from ..utils.jwt import get_current_user

router = APIRouter(prefix="/ai-insights", tags=["ai-insights"])


@router.get("/{analysis_id}")
async def get_ai_insights(
    analysis_id: str,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[dict]:
    """Fetch AI-generated insights for an analysis owned by the current user."""

    result = await session.execute(
        select(Analysis)
        .options(selectinload(Analysis.ai_insights))
        .where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found.",
        )

    return [
        {
            "id": insight.id,
            "analysis_id": insight.analysis_id,
            "insight_type": insight.insight_type,
            "model_used": insight.model_used,
            "prompt_version": insight.prompt_version,
            "structured_data": insight.structured_data,
            "raw_text": insight.raw_text,
            "input_tokens": insight.input_tokens,
            "output_tokens": insight.output_tokens,
            "estimated_cost_usd": insight.estimated_cost_usd,
            "latency_ms": insight.latency_ms,
            "created_at": insight.created_at.isoformat() if insight.created_at else None,
            "updated_at": insight.updated_at.isoformat() if insight.updated_at else None,
        }
        for insight in analysis.ai_insights
    ]
