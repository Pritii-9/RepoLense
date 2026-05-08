from __future__ import annotations

from enum import Enum


class AnalysisStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class LLMProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GROQ = "groq"


class ReportType(str, Enum):
    CSV = "csv"
    PDF = "pdf"


class AiInsightType(str, Enum):
    SUMMARY = "summary"
    SECURITY = "security"
    ARCHITECTURE = "architecture"
    DOCUMENTATION = "documentation"
