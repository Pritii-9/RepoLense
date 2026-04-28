from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from .config import settings
from .db import AsyncSessionFactory
from .models.ai_insight import AiInsight
from .models.analysis import Analysis
from .models.code_metric import CodeMetric
from .models.enums import AiInsightType, AnalysisStatus, ReportType
from .models.report import Report
from .schemas.llm_outputs import AiRepositorySummary
from .services.code_analyzer import analyze_repository
from .services.github_fetcher import cleanup_repository, clone_repository, get_commit_count
from .services.llm_client import LLMClient, LLMProvider
from .services.prompts import REPO_SUMMARY_PROMPT
from .services.s3_handler import s3_handler
from .utils.logger import get_logger


logger = get_logger(__name__)


def _format_hotspots(hotspots: list) -> str:
    lines: list[str] = []
    for h in hotspots:
        lines.append(f"  - {h.file_path} :: {h.entity_name} (complexity={h.complexity}, line={h.line_number})")
    return "\n".join(lines) if lines else "  (none)"


async def _generate_ai_summary(
    analysis: Analysis,
    metrics,
) -> AiInsight | None:
    """Generate an AI-powered repository summary and return an AiInsight model.

    Returns None if AI analysis is disabled or the call fails.
    """
    if not settings.enable_ai_analysis:
        logger.info("ai_analysis_disabled", extra={"analysis_id": str(analysis.id)})
        return None

    llm = LLMClient(
        provider=LLMProvider(settings.default_llm_provider),
        model=settings.default_llm_model,
    )
    try:
        prompt_text = REPO_SUMMARY_PROMPT.format(
            repo_name=analysis.repository_name,
            repo_url=analysis.repository_url,
            file_count=metrics.file_count,
            line_count=metrics.line_count,
            avg_complexity=metrics.average_cyclomatic_complexity,
            max_complexity=metrics.max_cyclomatic_complexity,
            maintainability=metrics.maintainability_index,
            debt_score=metrics.technical_debt_score,
            duplicate_blocks=metrics.duplicate_block_count,
            hotspots=_format_hotspots(metrics.hotspots),
        )

        summary, metrics_info = await llm.generate_structured(
            messages=[{"role": "user", "content": prompt_text}],
            output_schema=AiRepositorySummary,
        )

        insight = AiInsight(
            analysis_id=analysis.id,
            insight_type=AiInsightType.SUMMARY,
            model_used=llm.model,
            prompt_version=REPO_SUMMARY_PROMPT.version,
            structured_data=summary.model_dump(mode="json"),
            raw_text=None,
            input_tokens=metrics_info.input_tokens,
            output_tokens=metrics_info.output_tokens,
            estimated_cost_usd=metrics_info.estimated_cost_usd,
            latency_ms=metrics_info.latency_ms,
        )

        logger.info(
            "ai_summary_generated",
            extra={
                "analysis_id": str(analysis.id),
                "model": llm.model,
                "latency_ms": metrics_info.latency_ms,
                "cost_usd": metrics_info.estimated_cost_usd,
            },
        )
        return insight
    except Exception as exc:
        logger.exception(
            "ai_summary_generation_failed",
            extra={"analysis_id": str(analysis.id), "error": str(exc)},
        )
        return None
    finally:
        await llm.close()


async def run_analysis_pipeline(analysis_id: str) -> None:
    """Clone, analyze, upload reports, persist results, and optionally generate AI summary."""

    repository_path = None

    try:
        async with AsyncSessionFactory() as session:
            analysis = await session.get(Analysis, analysis_id)
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

        # Generate AI summary (non-blocking to pipeline success)
        ai_insight = await _generate_ai_summary(analysis, artifacts.metrics)

        async with AsyncSessionFactory() as session:
            analysis = await session.get(Analysis, analysis_id)
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
            if ai_insight is not None:
                session.add(ai_insight)

            analysis.status = AnalysisStatus.COMPLETED
            analysis.completed_at = datetime.now(timezone.utc)
            analysis.error_message = None
            await session.commit()

        logger.info("analysis_pipeline_completed", extra={"analysis_id": analysis_id})
    except Exception as exc:
        logger.exception("analysis_pipeline_failed", extra={"analysis_id": analysis_id})
        async with AsyncSessionFactory() as session:
            analysis = await session.get(Analysis, analysis_id)
            if analysis is not None:
                analysis.status = AnalysisStatus.FAILED
                analysis.completed_at = datetime.now(timezone.utc)
                analysis.error_message = str(exc)[:4000]
                await session.commit()
    finally:
        if repository_path is not None:
            await asyncio.to_thread(cleanup_repository, repository_path)
