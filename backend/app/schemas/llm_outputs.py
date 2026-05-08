from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AiRepositorySummary(BaseModel):
    """Structured output schema for AI-generated repository summaries."""

    overview: str = Field(
        max_length=400,
        description="High-level repo health description in 2-3 sentences.",
    )
    strengths: list[str] = Field(
        max_length=5,
        description="Up to 5 strengths of the codebase.",
    )
    risks: list[str] = Field(
        max_length=5,
        description="Up to 5 risks or problem areas.",
    )
    top_recommendations: list[str] = Field(
        max_length=3,
        description="Up to 3 specific, actionable recommendations.",
    )
    code_health_score: float = Field(
        ge=0,
        le=100,
        description="Overall code health score from 0 (poor) to 100 (excellent).",
    )
    critical_issue: str = Field(
        max_length=300,
        description="The single most critical issue to address.",
    )


class SecurityIssue(BaseModel):
    severity: Literal["critical", "high", "medium", "low"]
    category: str
    file_path: str
    line_number: int | None
    description: str
    remediation: str


class SecurityAuditResult(BaseModel):
    overall_risk_score: float = Field(ge=0, le=100)
    issues: list[SecurityIssue]
    summary: str = Field(max_length=500)


class AiArchitectureSchema(BaseModel):
    tech_stack: dict[str, str] = Field(description="Keys: frontend, backend, database, etc.")
    design_patterns: list[str] = Field(description="Design patterns identified.")
    scalability_score: float = Field(ge=0, le=100)
    modularization_description: str = Field(max_length=500)
    architectural_notes: str = Field(max_length=500)

