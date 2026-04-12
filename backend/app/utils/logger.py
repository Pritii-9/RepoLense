from __future__ import annotations

import json
import logging
from contextvars import ContextVar, Token
from datetime import datetime, timezone


REQUEST_ID_CONTEXT: ContextVar[str] = ContextVar("request_id", default="-")


class StructuredLogFormatter(logging.Formatter):
    """Render application logs as JSON for easier ingestion."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", REQUEST_ID_CONTEXT.get()),
        }
        for field_name in (
            "method",
            "path",
            "status_code",
            "duration_ms",
            "analysis_id",
            "user_id",
        ):
            value = getattr(record, field_name, None)
            if value is not None:
                payload[field_name] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=True)


def configure_logging(level: str = "INFO") -> None:
    """Configure root logging once for the service."""

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(level.upper())

    handler = logging.StreamHandler()
    handler.setFormatter(StructuredLogFormatter())
    root_logger.addHandler(handler)

    for noisy_logger in ("uvicorn.access",):
        logging.getLogger(noisy_logger).handlers.clear()


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def set_request_id(request_id: str) -> Token[str]:
    return REQUEST_ID_CONTEXT.set(request_id)


def reset_request_id(token: Token[str]) -> None:
    REQUEST_ID_CONTEXT.reset(token)


def get_request_id() -> str:
    return REQUEST_ID_CONTEXT.get()
