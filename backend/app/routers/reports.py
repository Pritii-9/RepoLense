from __future__ import annotations

import asyncio
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..db import get_async_session
from ..models.analysis import Analysis
from ..models.report import Report
from ..models.user import User
from ..schemas.report import ExportRequest, ExportResponse, ReportDownloadURLResponse
from ..services.s3_handler import s3_handler
from ..utils.jwt import get_current_user


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{report_id}/download-url", response_model=ReportDownloadURLResponse)
async def get_report_download_url(
    report_id: str,
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


@router.post("/{analysis_id}/export", response_model=ExportResponse)
async def export_analysis_metrics(
    analysis_id: str,
    payload: ExportRequest,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ExportResponse:
    from ..models.code_metric import CodeMetric
    from ..services.report_exporter import generate_code_metric_export, get_presigned_export_url

    result = await session.execute(
        select(CodeMetric).options(selectinload(CodeMetric.analysis)).where(
            CodeMetric.analysis_id == analysis_id,
            CodeMetric.analysis.has(user_id=current_user.id),
        )
    )
    metric = result.scalar_one_or_none()
    if metric is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis metrics not found or access denied."
        )

    metric_data = {
        "file_count": metric.file_count,
        "line_count": metric.line_count,
        "commit_count": metric.commit_count,
        "duplicate_block_count": metric.duplicate_block_count,
        "duplicate_line_count": metric.duplicate_line_count,
        "average_cyclomatic_complexity": metric.average_cyclomatic_complexity,
        "max_cyclomatic_complexity": metric.max_cyclomatic_complexity,
        "maintainability_index": metric.maintainability_index,
        "technical_debt_score": metric.technical_debt_score,
    }

    s3_key = await generate_code_metric_export(metric_data, str(analysis_id), payload.format)
    url = await get_presigned_export_url(s3_key)
    
    # Extract filename from s3_key logic, but simplify
    filename = f"metrics_{analysis_id}_{payload.format}"
    
    return ExportResponse(
        download_url=url,
        filename=filename,
        expires_in_seconds=3600
    )
