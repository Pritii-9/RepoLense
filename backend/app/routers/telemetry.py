from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, desc
from datetime import datetime, timedelta

from ..db import get_async_session
from ..models.telemetry import ApiTelemetry, AiTokenLog
from ..models.user import User
from ..utils.logger import get_logger

from fastapi.responses import Response

logger = get_logger(__name__)
router = APIRouter(prefix="/telemetry", tags=["telemetry"])

@router.get("/tracker.js")
async def get_telemetry_tracker():
    """Return lightweight telemetry tracker script for RepoLens."""
    js_code = """
(function() {
  try {
    console.log('[RepoLens Telemetry] Engine active.');
  } catch (e) {}
})();
"""
    return Response(content=js_code, media_type="application/javascript")

@router.get("/metrics")
async def get_telemetry_metrics(session: AsyncSession = Depends(get_async_session)):
    """
    Returns aggregated metrics for the Telemetry Dashboard.
    """
    try:
        # Calculate time windows
        now = datetime.utcnow()
        seven_days_ago = now - timedelta(days=7)

        # 1. API Telemetry aggregations
        api_stats = await session.execute(
            select(
                func.count(ApiTelemetry.id).label("total_requests"),
                func.avg(ApiTelemetry.latency_ms).label("avg_latency"),
            ).where(ApiTelemetry.timestamp >= seven_days_ago)
        )
        api_stats_row = api_stats.first()
        total_requests = api_stats_row.total_requests or 0 if api_stats_row else 0
        avg_latency = round(api_stats_row.avg_latency or 0, 2) if api_stats_row else 0

        # Error rate calculation (status >= 400)
        error_stats = await session.execute(
            select(func.count(ApiTelemetry.id)).where(
                ApiTelemetry.timestamp >= seven_days_ago,
                ApiTelemetry.status_code >= 400
            )
        )
        total_errors = error_stats.scalar() or 0
        error_rate = round((total_errors / total_requests) * 100, 2) if total_requests > 0 else 0

        # 2. AI Token Log aggregations
        token_stats = await session.execute(
            select(
                func.sum(AiTokenLog.total_cost).label("total_cost"),
                func.sum(AiTokenLog.prompt_tokens + AiTokenLog.completion_tokens).label("total_tokens")
            ).where(AiTokenLog.timestamp >= seven_days_ago)
        )
        token_stats_row = token_stats.first()
        total_ai_cost = round(token_stats_row.total_cost or 0, 4) if token_stats_row else 0
        total_ai_tokens = token_stats_row.total_tokens or 0 if token_stats_row else 0

        # 3. Top 5 Slowest Endpoints
        slowest_endpoints = await session.execute(
            select(
                ApiTelemetry.path,
                func.avg(ApiTelemetry.latency_ms).label("avg_latency"),
                func.count(ApiTelemetry.id).label("calls")
            )
            .where(ApiTelemetry.timestamp >= seven_days_ago)
            .group_by(ApiTelemetry.path)
            .order_by(desc("avg_latency"))
            .limit(5)
        )
        slowest = [
            {"path": row.path, "avg_latency": round(row.avg_latency, 2), "calls": row.calls}
            for row in slowest_endpoints
        ]

        # 4. Daily AI Cost (last 7 days)
        # SQLite uses date(timestamp), PostgreSQL uses date_trunc. Since we might use either, we'll fetch raw logs and group in memory for safety.
        # This is fine for small/medium datasets.
        ai_logs = await session.execute(
            select(AiTokenLog.timestamp, AiTokenLog.total_cost)
            .where(AiTokenLog.timestamp >= seven_days_ago)
        )
        daily_costs = {}
        for d in (seven_days_ago + timedelta(days=i) for i in range(8)):
            daily_costs[d.strftime("%Y-%m-%d")] = 0.0
            
        for row in ai_logs:
            day_str = row.timestamp.strftime("%Y-%m-%d")
            if day_str in daily_costs:
                daily_costs[day_str] += row.total_cost

        daily_cost_series = [{"date": k, "cost": round(v, 4)} for k, v in daily_costs.items()]
        daily_cost_series.sort(key=lambda x: x["date"])

        # 5. Daily API Volume (last 7 days)
        api_logs = await session.execute(
            select(ApiTelemetry.timestamp, ApiTelemetry.latency_ms)
            .where(ApiTelemetry.timestamp >= seven_days_ago)
        )
        daily_volume = {}
        daily_latency_sum = {}
        for d in (seven_days_ago + timedelta(days=i) for i in range(8)):
            ds = d.strftime("%Y-%m-%d")
            daily_volume[ds] = 0
            daily_latency_sum[ds] = 0.0
            
        for row in api_logs:
            day_str = row.timestamp.strftime("%Y-%m-%d")
            if day_str in daily_volume:
                daily_volume[day_str] += 1
                daily_latency_sum[day_str] += row.latency_ms

        daily_api_series = []
        for ds in sorted(daily_volume.keys()):
            vol = daily_volume[ds]
            avg_lat = round(daily_latency_sum[ds] / vol, 2) if vol > 0 else 0
            daily_api_series.append({"date": ds, "requests": vol, "avg_latency": avg_lat})

        return {
            "summary": {
                "total_requests": total_requests,
                "error_rate": error_rate,
                "avg_latency": avg_latency,
                "total_ai_cost": total_ai_cost,
                "total_ai_tokens": total_ai_tokens,
            },
            "slowest_endpoints": slowest,
            "daily_costs": daily_cost_series,
            "daily_api": daily_api_series,
        }

    except Exception as e:
        logger.error(f"Failed to fetch telemetry metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch telemetry metrics"
        )
