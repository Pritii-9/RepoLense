from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from ..models.enums import AnalysisStatus, ReportType


class AnalysisSubmitRequest(BaseModel):
    repository_url: str = Field(min_length=1, max_length=500)
    branch: str | None = Field(default=None, min_length=1, max_length=255)


class CodeMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    analysis_id: str
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

    id: str
    analysis_id: str
    report_type: ReportType
    file_name: str
    content_type: str
    created_at: datetime
    updated_at: datetime


class AiInsightResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    analysis_id: str
    insight_type: str
    model_used: str
    prompt_version: str
    structured_data: dict
    raw_text: str | None
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float
    latency_ms: int
    created_at: datetime
    updated_at: datetime


class AnalysisStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
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
    ai_insights: list[AiInsightResponse] = Field(default_factory=list)


class PRRiskRequest(BaseModel):
    repository_url: str = Field(min_length=1, max_length=500)
    branch: str = Field(min_length=1, max_length=255)
    diff_text: str = Field(min_length=1)


class PRRiskResponse(BaseModel):
    risk_score: int = Field(ge=0, le=100, description="Risk score from 0 to 100")
    risk_level: str = Field(description="'Low', 'Medium', or 'High'")
    summary: str = Field(description="Brief summary of the PR risk")
    potential_issues: list[str] = Field(description="List of specific potential issues found")
    suggested_reviewers: list[str] = Field(description="Types of engineers who should review this")
