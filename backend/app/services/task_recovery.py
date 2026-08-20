from __future__ import annotations

import asyncio
import os
import socket
from datetime import datetime, timedelta, timezone
from typing import Callable

from sqlalchemy import select, update, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import AsyncSessionFactory
from ..models.analysis import Analysis
from ..models.enums import AnalysisStatus
from ..utils.logger import get_logger

logger = get_logger(__name__)

NODE_ID = f"{socket.gethostname()}-{os.getpid()}"
HEARTBEAT_INTERVAL_SECONDS = 5
HEARTBEAT_TIMEOUT_SECONDS = 20


async def heartbeat_loop(analysis_id: str, stop_event: asyncio.Event) -> None:
    """Periodically update the last_heartbeat timestamp in PostgreSQL while task is running."""
    while not stop_event.is_set():
        try:
            await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
            if stop_event.is_set():
                break

            async with AsyncSessionFactory() as session:
                await session.execute(
                    update(Analysis)
                    .where(Analysis.id == analysis_id)
                    .values(
                        last_heartbeat=datetime.now(timezone.utc),
                        processing_node=NODE_ID,
                    )
                )
                await session.commit()
        except Exception as exc:
            logger.warning(
                "heartbeat_update_failed",
                extra={"analysis_id": analysis_id, "error": str(exc)},
            )


async def recover_orphaned_tasks() -> list[str]:
    """Scan PostgreSQL for tasks in RUNNING state whose last_heartbeat is stale or missing.

    Resets orphaned tasks back to PENDING if retries remain, or marks as FAILED if max retries exceeded.
    Returns list of recovered task IDs.
    """
    recovered_ids: list[str] = []
    cutoff_time = datetime.now(timezone.utc) - timedelta(seconds=HEARTBEAT_TIMEOUT_SECONDS)

    try:
        async with AsyncSessionFactory() as session:
            # Query tasks that are stuck in RUNNING state with an expired or missing heartbeat
            stmt = select(Analysis).where(
                Analysis.status == AnalysisStatus.RUNNING,
                or_(
                    Analysis.last_heartbeat == None,
                    Analysis.last_heartbeat < cutoff_time,
                ),
            )
            result = await session.execute(stmt)
            orphaned_tasks = result.scalars().all()

            if not orphaned_tasks:
                return []

            for task in orphaned_tasks:
                if task.retry_count < task.max_retries:
                    task.status = AnalysisStatus.PENDING
                    task.processing_node = None
                    task.last_heartbeat = None
                    task.error_message = None
                    recovered_ids.append(str(task.id))
                    logger.info(
                        "auto_requeuing_orphaned_task",
                        extra={
                            "analysis_id": str(task.id),
                            "retry_count": task.retry_count,
                            "max_retries": task.max_retries,
                        },
                    )
                else:
                    task.status = AnalysisStatus.FAILED
                    task.completed_at = datetime.now(timezone.utc)
                    task.error_message = f"Task failed after exceeding maximum retries ({task.max_retries})."
                    logger.warning(
                        "orphaned_task_exceeded_max_retries",
                        extra={"analysis_id": str(task.id), "max_retries": task.max_retries},
                    )

            await session.commit()

        # Re-queue recovered tasks into pipeline
        if recovered_ids:
            from ..tasks import run_analysis_pipeline
            for tid in recovered_ids:
                asyncio.create_task(run_analysis_pipeline(tid))

    except Exception as exc:
        logger.exception("task_recovery_failed", extra={"error": str(exc)})

    return recovered_ids


async def start_recovery_daemon(interval_seconds: int = 15) -> None:
    """Background daemon running orphan task recovery periodically."""
    logger.info("task_recovery_daemon_started", extra={"interval_seconds": interval_seconds})
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            await recover_orphaned_tasks()
        except asyncio.CancelledError:
            logger.info("task_recovery_daemon_stopped")
            break
        except Exception as exc:
            logger.error("error_in_recovery_daemon", extra={"error": str(exc)})
