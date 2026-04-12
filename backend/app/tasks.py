from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from app.db import AsyncSessionFactory
from app.models.analysis import Analysis
from app.models.code_metric import CodeMetric
from app.models.enums import AnalysisStatus, ReportType
from app.models.report import Report
from app.services.code_analyzer import analyze_repository
from app.services.github_fetcher import cleanup_repository, clone_repository, get_commit_count
from app.services.s3_handler import s3_handler
from app.utils.logger import get_logger


logger = get_logger(__name__)


async def run_analysis_pipeline(analysis_id: str) -> None:
    """Clone, analyze, upload reports, and persist results."""

    analysis_uuid = uuid.UUID(analysis_id)
    repository_path = None

    try:
        async with AsyncSessionFactory() as session:
            analysis = await session.get(Analysis, analysis_uuid)
            if analysis is None:
                logger.warning(
                    "analysis_not_found_for_pipeline",
                    extra={"analysis_id": analysis_id},
                )
                return

            analysis.status = AnalysisStatus.RUNNING
            analysis.started_at = datetime.now(timezone.utc)
            analysis.error_message = None
            await session.commit()

            repository_url = analysis.repository_url
            repository_name = analysis.repository_name
            branch = analysis.branch
            user_id = analysis.user_id

        repository_path = await clone_repository(repository_url, branch)
        commit_count = await get_commit_count(repository_path)
        artifacts = await asyncio.to_thread(
            analyze_repository,
            repository_path,
            repository_name,
            repository_url,
            commit_count,
        )

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        csv_key = (
            f"users/{user_id}/analyses/{analysis_id}/{timestamp}-{artifacts.csv_file_name}"
        )
        pdf_key = (
            f"users/{user_id}/analyses/{analysis_id}/{timestamp}-{artifacts.pdf_file_name}"
        )

        await asyncio.to_thread(
            s3_handler.upload_bytes,
            artifacts.csv_bytes,
            csv_key,
            "text/csv",
        )
        await asyncio.to_thread(
            s3_handler.upload_bytes,
            artifacts.pdf_bytes,
            pdf_key,
            "application/pdf",
        )

        async with AsyncSessionFactory() as session:
            analysis = await session.get(Analysis, analysis_uuid)
            if analysis is None:
                return

            metrics = artifacts.metrics
            session.add(
                CodeMetric(
                    analysis_id=analysis.id,
                    file_count=metrics.file_count,
                    line_count=metrics.line_count,
                    commit_count=metrics.commit_count,
                    duplicate_block_count=metrics.duplicate_block_count,
                    duplicate_line_count=metrics.duplicate_line_count,
                    average_cyclomatic_complexity=metrics.average_cyclomatic_complexity,
                    max_cyclomatic_complexity=metrics.max_cyclomatic_complexity,
                    maintainability_index=metrics.maintainability_index,
                    technical_debt_score=metrics.technical_debt_score,
                )
            )
            session.add_all(
                [
                    Report(
                        analysis_id=analysis.id,
                        report_type=ReportType.CSV,
                        file_name=artifacts.csv_file_name,
                        s3_key=csv_key,
                        content_type="text/csv",
                    ),
                    Report(
                        analysis_id=analysis.id,
                        report_type=ReportType.PDF,
                        file_name=artifacts.pdf_file_name,
                        s3_key=pdf_key,
                        content_type="application/pdf",
                    ),
                ]
            )
            analysis.status = AnalysisStatus.COMPLETED
            analysis.completed_at = datetime.now(timezone.utc)
            analysis.error_message = None
            await session.commit()

        logger.info("analysis_pipeline_completed", extra={"analysis_id": analysis_id})
    except Exception as exc:
        logger.exception("analysis_pipeline_failed", extra={"analysis_id": analysis_id})
        async with AsyncSessionFactory() as session:
            analysis = await session.get(Analysis, analysis_uuid)
            if analysis is not None:
                analysis.status = AnalysisStatus.FAILED
                analysis.completed_at = datetime.now(timezone.utc)
                analysis.error_message = str(exc)[:4000]
                await session.commit()
    finally:
        if repository_path is not None:
            await asyncio.to_thread(cleanup_repository, repository_path)
