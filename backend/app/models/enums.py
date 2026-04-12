from __future__ import annotations

from enum import StrEnum


class AnalysisStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ReportType(StrEnum):
    CSV = "csv"
    PDF = "pdf"
