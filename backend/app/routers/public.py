"""Public routes — no authentication required."""
from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..db import get_async_session
from ..models.analysis import Analysis
from ..models.enums import AnalysisStatus
from ..models.user import User
from ..schemas.analysis import AnalysisStatusResponse
from ..utils.jwt import get_current_user

router = APIRouter(prefix="/public", tags=["public"])
_share_router = APIRouter(prefix="/analysis", tags=["share"])


# ── Public: view a shared analysis (no auth) ────────────────────────────────

@router.get("/analysis/{share_token}", response_model=AnalysisStatusResponse)
async def get_shared_analysis(
    share_token: str,
    session: Annotated[AsyncSession, Depends(get_async_session)],
) -> AnalysisStatusResponse:
    """Return a read-only view of a completed analysis via its share token."""
    result = await session.execute(
        select(Analysis)
        .options(
            selectinload(Analysis.code_metric),
            selectinload(Analysis.reports),
            selectinload(Analysis.ai_insights),
            selectinload(Analysis.vulnerabilities),
        )
        .where(Analysis.share_token == share_token)
    )
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared report not found or the link has been revoked.",
        )
    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This analysis is not yet complete.",
        )
    return AnalysisStatusResponse.model_validate(analysis)


# ── Authenticated: generate / revoke share token ────────────────────────────

@_share_router.post("/{analysis_id}/share", response_model=AnalysisStatusResponse)
async def generate_share_link(
    analysis_id: str,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AnalysisStatusResponse:
    """Generate (or return existing) a public share token for an analysis."""
    result = await session.execute(
        select(Analysis)
        .options(
            selectinload(Analysis.code_metric),
            selectinload(Analysis.reports),
            selectinload(Analysis.ai_insights),
            selectinload(Analysis.vulnerabilities),
        )
        .where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    if analysis.status != AnalysisStatus.COMPLETED:
        raise HTTPException(
            status_code=400, detail="Only completed analyses can be shared."
        )

    if not analysis.share_token:
        analysis.share_token = secrets.token_urlsafe(32)
        session.add(analysis)
        await session.commit()

    return AnalysisStatusResponse.model_validate(analysis)


@_share_router.delete("/{analysis_id}/share", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share_link(
    analysis_id: str,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Revoke the public share link for an analysis."""
    result = await session.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id,
        )
    )
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    analysis.share_token = None
    session.add(analysis)
    await session.commit()
    return None
