from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AnalysisStatus, ReportType


class AnalysisSubmitRequest(BaseModel):
    repository_url: str = Field(min_length=1, max_length=500)
    branch: str | None = Field(default=None, min_length=1, max_length=255)


class CodeMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    analysis_id: uuid.UUID
    file_count: int
    line_count: int
    commit_count: int
    duplicate_block_count: int
    duplicate_line_count: int
    average_cyclomatic_complexity: float
    max_cyclomatic_complexity: int
    maintainability_index: float
    technical_debt_score: float
    created_at: datetime
    updated_at: datetime


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    analysis_id: uuid.UUID
    report_type: ReportType
    file_name: str
    content_type: str
    created_at: datetime
    updated_at: datetime


class AnalysisStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    repository_url: str
    repository_name: str
    branch: str | None
    status: AnalysisStatus
    submitted_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    code_metric: CodeMetricResponse | None = None
    reports: list[ReportResponse] = Field(default_factory=list)
