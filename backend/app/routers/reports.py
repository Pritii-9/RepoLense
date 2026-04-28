from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_async_session
from ..models.analysis import Analysis
from ..models.report import Report
from ..models.user import User
from ..schemas.report import ExportRequest, ExportResponse, ReportDownloadURLResponse
from ..services.report_exporter import generate_code_metric_export
from ..services.s3_handler import s3_handler
from ..utils.jwt import create_signed_token, decode_signed_token, get_current_user


router = APIRouter(prefix="/reports", tags=["reports"])


def _build_download_token(*, key: str, file_name: str, content_type: str) -> str:
    return create_signed_token(
        {
            "sub": key,
            "purpose": "object-download",
            "file_name": file_name,
            "content_type": content_type,
        },
        expires_minutes=60,
    )


def _build_download_url(request: Request, token: str) -> str:
    return str(request.url_for("download_stored_file")) + f"?token={token}"


@router.get("/download", name="download_stored_file")
async def download_stored_file(token: Annotated[str, Query(min_length=1)]) -> Response:
    payload = decode_signed_token(token)
    if payload.get("purpose") != "object-download":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid download token.",
        )

    key = payload.get("sub")
    file_name = payload.get("file_name")
    content_type = payload.get("content_type")
    if not isinstance(key, str) or not isinstance(file_name, str) or not isinstance(content_type, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid download token.",
        )

    content = s3_handler.download_bytes(key)
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    return Response(content=content, media_type=content_type, headers=headers)


@router.get("/{report_id}/download-url", response_model=ReportDownloadURLResponse)
async def get_report_download_url(
    report_id: str,
    request: Request,
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

    token = _build_download_token(
        key=report.s3_key,
        file_name=report.file_name,
        content_type=report.content_type,
    )
    return ReportDownloadURLResponse(
        report_id=report.id,
        url=_build_download_url(request, token),
    )


@router.post("/{analysis_id}/export", response_model=ExportResponse)
async def export_analysis_metrics(
    analysis_id: str,
    payload: ExportRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ExportResponse:
    from ..models.code_metric import CodeMetric

    result = await session.execute(
        select(CodeMetric).where(
            CodeMetric.analysis_id == analysis_id,
            CodeMetric.analysis.has(user_id=current_user.id),
        )
    )
    metric = result.scalar_one_or_none()
    if metric is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis metrics not found or access denied.",
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
    filename = s3_key.rsplit("/", 1)[-1]
    content_type = "text/csv" if payload.format == "csv" else "application/json"
    token = _build_download_token(key=s3_key, file_name=filename, content_type=content_type)

    return ExportResponse(
        download_url=_build_download_url(request, token),
        filename=filename,
        expires_in_seconds=3600,
    )
