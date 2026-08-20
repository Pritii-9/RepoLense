from __future__ import annotations

import asyncio
import sys
from contextlib import asynccontextmanager
from time import perf_counter
from uuid import uuid4

# Set Windows event loop policy for subprocess support
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except AttributeError:
        pass  # Python 3.8+ on Windows

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .limiter import limiter
from fastapi.responses import JSONResponse
from sqlalchemy import text, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .db import engine, get_async_session, AsyncSessionFactory
from .models import Base, ApiTelemetry  # noqa: F401
from .routers.ai_insights import router as ai_insights_router
from .routers.analysis import router as analysis_router
from .routers.webhooks import router as webhooks_router
from .routers.auth_fixed import router as auth_router
from .routers.github_auth import router as github_auth_router
from .routers.chat import router as chat_router
from .routers.reports import router as reports_router
from .routers.cicd import router as cicd_router
from .routers.logs import router as logs_router
from .routers.search import router as search_router
from .routers.telemetry import router as telemetry_router
from .routers.public import router as public_router, _share_router as share_router
from .routers.organization import router as organization_router
from .utils.logger import (
    configure_logging,
    get_logger,
    get_request_id,
    reset_request_id,
    set_request_id,
)


configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.temp_directory.mkdir(parents=True, exist_ok=True)
    settings.object_storage_directory.mkdir(parents=True, exist_ok=True)
    for attempt in range(5):
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
                await connection.execute(text("ALTER TABLE analyses ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ;"))
                await connection.execute(text("ALTER TABLE analyses ADD COLUMN IF NOT EXISTS processing_node VARCHAR(255);"))
                await connection.execute(text("ALTER TABLE analyses ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;"))
                await connection.execute(text("ALTER TABLE analyses ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3;"))
            break
        except Exception as exc:
            logger.warning(f"db_startup_attempt_{attempt + 1}_failed: {exc}")
            if attempt == 4:
                logger.error("db_startup_all_attempts_failed")
            await asyncio.sleep(2)

    # Self-Healing Task Engine: Recover orphaned tasks & start periodic recovery daemon
    recovery_daemon_task = None
    try:
        from .services.task_recovery import recover_orphaned_tasks, start_recovery_daemon
        await recover_orphaned_tasks()
        recovery_daemon_task = asyncio.create_task(start_recovery_daemon(interval_seconds=15))
    except Exception as exc:
        logger.warning(f"failed_to_initialize_task_recovery: {exc}")

    logger.info("application_startup")
    try:
        yield
    finally:
        if recovery_daemon_task is not None:
            recovery_daemon_task.cancel()
        await engine.dispose()
        logger.info("application_shutdown")


app = FastAPI(title=settings.project_name, lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_origins=list(set(settings.cors_origins_list + [
        "http://localhost:4173", "http://127.0.0.1:4173",
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:4174", "http://127.0.0.1:4174",
        "http://localhost:4175", "http://127.0.0.1:4175",
    ])),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    token = set_request_id(request_id)
    started = perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "unhandled_exception",
            extra={"method": request.method, "path": request.url.path},
        )
        response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error.",
                "request_id": request_id,
            },
        )

    origin = request.headers.get("origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"

    duration_ms = round((perf_counter() - started) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request_completed",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
        },
    )

    # Fire-and-forget task to save telemetry to DB
    async def save_telemetry():
        try:
            # Simple JWT extraction (if present) for telemetry
            auth_header = request.headers.get("Authorization")
            user_id = None
            if auth_header and auth_header.startswith("Bearer "):
                raw_token = auth_header.split(" ")[1]
                try:
                    from jose import jwt as jose_jwt
                    payload = jose_jwt.decode(
                        raw_token,
                        settings.jwt_secret,
                        algorithms=[settings.jwt_algorithm],
                    )
                    user_id = payload.get("sub")
                except Exception:
                    pass

            async with AsyncSessionFactory() as session:
                record = ApiTelemetry(
                    path=request.url.path,
                    method=request.method,
                    status_code=response.status_code,
                    latency_ms=duration_ms,
                    user_id=user_id,
                )
                session.add(record)
                await session.commit()
        except Exception as e:
            logger.error(f"Failed to save telemetry: {e}")

    asyncio.create_task(save_telemetry())

    reset_request_id(token)
    return response


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    logger.warning(
        "request_validation_failed",
        extra={"method": request.method, "path": request.url.path},
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error.",
            "errors": exc.errors(),
            "request_id": get_request_id(),
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "request_id": get_request_id()},
    )


@app.get("/health")
async def health_check(
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, str]:
    try:
        await session.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.exception("database_healthcheck_failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable.",
        ) from exc
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(github_auth_router)
app.include_router(github_auth_router, prefix="/api/v1")
app.include_router(analysis_router)
app.include_router(share_router)
app.include_router(reports_router)
app.include_router(ai_insights_router)
app.include_router(chat_router)
app.include_router(cicd_router)
app.include_router(webhooks_router)
app.include_router(logs_router)
app.include_router(search_router)
app.include_router(telemetry_router)
app.include_router(public_router)
app.include_router(organization_router)
