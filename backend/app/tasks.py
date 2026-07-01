from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .config import settings
from .db import AsyncSessionFactory
from .models.ai_insight import AiInsight
from .models.analysis import Analysis
from .models.code_metric import CodeMetric
from .models.enums import AiInsightType, AnalysisStatus, ReportType
from .models.report import Report
from .schemas.llm_outputs import AiArchitectureSchema, AiRepositorySummary
from .services.code_analyzer import analyze_repository
from .services.github_fetcher import cleanup_repository, clone_repository, get_commit_count
from .services.llm_client import LLMClient, LLMProvider
from .services.prompts import ARCHITECTURE_ANALYSIS_PROMPT, REPO_SUMMARY_PROMPT
from .services.s3_handler import s3_handler
from .services.vector_store import VectorStoreService
from .services.ws_manager import ws_manager
from .services.pr_reviewer import fetch_pr_diff, generate_ai_review, post_pr_comment
from .utils.logger import get_logger
from .celery_app import celery_app

logger = get_logger(__name__)


async def _emit(analysis_id: str, emoji: str, message: str, event_type: str = "log") -> None:
    """Broadcast a structured log event to all WebSocket clients for this analysis."""
    await ws_manager.broadcast(
        analysis_id,
        {
            "type": event_type,
            "ts": datetime.now(timezone.utc).strftime("%H:%M:%S"),
            "emoji": emoji,
            "message": message,
        },
    )


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


async def _generate_architectural_insight(
    analysis: Analysis,
    metrics,
    repository_path: Path,
) -> AiInsight | None:
    """Generate architectural insights using LLM."""
    if not settings.enable_ai_analysis:
        return None

    # Get top files for context
    file_list = []
    for root, _, files in os.walk(repository_path):
        if any(p in {"node_modules", ".git", "venv"} for p in Path(root).parts):
            continue
        rel_root = Path(root).relative_to(repository_path)
        for f in files[:10]: # Limit files per dir
            file_list.append(str(rel_root / f))
        if len(file_list) > 100:
            break

    llm = LLMClient()
    try:
        prompt_text = ARCHITECTURE_ANALYSIS_PROMPT.format(
            repo_name=analysis.repository_name,
            repo_url=analysis.repository_url,
            file_list="\n".join(file_list),
            avg_complexity=metrics.average_cyclomatic_complexity,
            maintainability=metrics.maintainability_index,
            debt_score=metrics.technical_debt_score,
        )

        arch_data, metrics_info = await llm.generate_structured(
            messages=[{"role": "user", "content": prompt_text}],
            output_schema=AiArchitectureSchema,
        )

        return AiInsight(
            analysis_id=analysis.id,
            insight_type=AiInsightType.ARCHITECTURE,
            model_used=llm.model,
            prompt_version=ARCHITECTURE_ANALYSIS_PROMPT.version,
            structured_data=arch_data.model_dump(mode="json"),
            input_tokens=metrics_info.input_tokens,
            output_tokens=metrics_info.output_tokens,
            estimated_cost_usd=metrics_info.estimated_cost_usd,
            latency_ms=metrics_info.latency_ms,
        )
    except Exception as exc:
        logger.exception("arch_insight_failed", extra={"error": str(exc)})
        return None
    finally:
        await llm.close()


async def _index_repository(analysis_id: str, repository_path: Path) -> None:
    """Index repository for RAG."""
    if not settings.enable_ai_analysis:
        return
    try:
        vs = VectorStoreService(analysis_id)
        await vs.index_repository(repository_path)
    except Exception as exc:
        logger.exception("indexing_failed", extra={"analysis_id": analysis_id, "error": str(exc)})


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

        await _emit(analysis_id, "⚙️", "Analysis pipeline started — status set to RUNNING.")

        await _emit(analysis_id, "📥", f"Cloning repository '{repository_name}'…")
        repository_path = await clone_repository(repository_url, branch)
        commit_count = await get_commit_count(repository_path)
        await _emit(analysis_id, "✅", f"Repository cloned successfully ({commit_count} commits visible).")

        await _emit(analysis_id, "📊", "Running static analysis (complexity, duplicates, maintainability)…")
        artifacts = await asyncio.to_thread(
            analyze_repository,
            repository_path,
            repository_name,
            repository_url,
            commit_count,
        )
        await _emit(
            analysis_id, "📋",
            f"Static analysis complete — {artifacts.metrics.file_count} files, "
            f"{artifacts.metrics.line_count:,} lines scanned."
        )

        await _emit(analysis_id, "☁️", "Uploading CSV and PDF reports to object storage…")
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
        await _emit(analysis_id, "✅", "Reports uploaded successfully.")

        # Generate AI Insights & Index for RAG
        await _emit(analysis_id, "🤖", "Generating AI summary and architectural insight…")
        ai_summary = await _generate_ai_summary(analysis, artifacts.metrics)
        ai_arch = await _generate_architectural_insight(analysis, artifacts.metrics, repository_path)

        await _emit(analysis_id, "📦", "Indexing repository into vector database for semantic search…")
        await _index_repository(analysis_id, repository_path)

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
            if ai_summary is not None:
                session.add(ai_summary)
            if ai_arch is not None:
                session.add(ai_arch)

            analysis.status = AnalysisStatus.COMPLETED
            analysis.completed_at = datetime.now(timezone.utc)
            analysis.error_message = None
            await session.commit()

        await _emit(analysis_id, "🎉", "Analysis complete! All reports and AI insights are ready.", event_type="done")
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
        await _emit(analysis_id, "❌", f"Pipeline failed: {str(exc)[:200]}", event_type="error")
    finally:
        if repository_path is not None:
            await asyncio.to_thread(cleanup_repository, repository_path)


async def run_pr_review_task(repo_owner: str, repo_name: str, pr_number: int) -> None:
    """Background task to fetch PR diff, generate AI review, and post to GitHub."""
    logger.info(f"Starting PR review for {repo_owner}/{repo_name}#{pr_number}")
    try:
        # 1. Fetch Diff
        diff = await fetch_pr_diff(repo_owner, repo_name, pr_number)
        if not diff:
            logger.warning(f"Could not fetch diff for {repo_owner}/{repo_name}#{pr_number} or diff is empty.")
            return

        # 2. Generate AI Review
        review_comment = await generate_ai_review(diff, repo_name)
        if not review_comment:
            logger.warning(f"AI review generation failed for {repo_owner}/{repo_name}#{pr_number}")
            return

        # 3. Post Comment
        success = await post_pr_comment(repo_owner, repo_name, pr_number, review_comment)
        if success:
            logger.info(f"PR review pipeline completed for {repo_owner}/{repo_name}#{pr_number}")
        else:
            logger.error(f"Failed to post PR review comment for {repo_owner}/{repo_name}#{pr_number}")
            
    except Exception as e:
        logger.exception(f"Unhandled error in run_pr_review_task: {e}")


@celery_app.task(name="tasks.run_analysis_pipeline_task")
def run_analysis_pipeline_task(analysis_id: str) -> None:
    """Celery task wrapper for run_analysis_pipeline."""
    asyncio.run(run_analysis_pipeline(analysis_id))


@celery_app.task(name="tasks.run_pr_review_task_wrapper")
def run_pr_review_task_wrapper(repo_owner: str, repo_name: str, pr_number: int) -> None:
    """Celery task wrapper for run_pr_review_task."""
    asyncio.run(run_pr_review_task(repo_owner, repo_name, pr_number))
