from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..db import get_async_session
from ..models.analysis import Analysis
from ..models.enums import AnalysisStatus
from ..models.user import User
from ..schemas.analysis import AnalysisStatusResponse, AnalysisSubmitRequest
from ..services.github_fetcher import extract_repository_name, normalize_github_url
from ..tasks import run_analysis_pipeline
from ..utils.jwt import get_current_user


router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post(
    "/submit",
    response_model=AnalysisStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def submit_analysis(
    payload: AnalysisSubmitRequest,
    background_tasks: BackgroundTasks,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AnalysisStatusResponse:
    try:
        normalized_url = normalize_github_url(payload.repository_url)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    analysis = Analysis(
        user_id=current_user.id,
        repository_url=normalized_url,
        repository_name=extract_repository_name(normalized_url),
        branch=payload.branch,
        status=AnalysisStatus.PENDING,
    )
    session.add(analysis)
    await session.commit()
    await session.refresh(analysis)

    background_tasks.add_task(run_analysis_pipeline, str(analysis.id))
    return AnalysisStatusResponse(
        id=analysis.id,
        user_id=analysis.user_id,
        repository_url=analysis.repository_url,
        repository_name=analysis.repository_name,
        branch=analysis.branch,
        status=analysis.status,
        submitted_at=analysis.submitted_at,
        started_at=analysis.started_at,
        completed_at=analysis.completed_at,
        error_message=analysis.error_message,
        created_at=analysis.created_at,
        updated_at=analysis.updated_at,
        code_metric=None,
        reports=[],
    )


@router.get("/{analysis_id}/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    analysis_id: str,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> AnalysisStatusResponse:
    result = await session.execute(
        select(Analysis)
        .options(
            selectinload(Analysis.code_metric),
            selectinload(Analysis.reports),
        )
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
    return AnalysisStatusResponse.model_validate(analysis)
