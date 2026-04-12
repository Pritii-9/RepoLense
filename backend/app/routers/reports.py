from __future__ import annotations

import asyncio
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_async_session
from app.models.analysis import Analysis
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportDownloadURLResponse
from app.services.s3_handler import s3_handler
from app.utils.jwt import get_current_user


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{report_id}/download-url", response_model=ReportDownloadURLResponse)
async def get_report_download_url(
    report_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ReportDownloadURLResponse:
    result = await session.execute(
        select(Report)
        .join(Analysis, Report.analysis_id == Analysis.id)
        .where(
            Report.id == report_id,
            Analysis.user_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    download_url = await asyncio.to_thread(
        s3_handler.generate_presigned_url,
        report.s3_key,
        3600,
    )
    return ReportDownloadURLResponse(report_id=report.id, url=download_url)
