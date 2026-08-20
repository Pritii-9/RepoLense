from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class AiRepositorySummary(BaseModel):
    """Structured output schema for AI-generated repository summaries."""

    overview: str = Field(description="High-level repo health description in 2-3 sentences.")
    strengths: list[str] = Field(description="Up to 5 strengths of the codebase.")
    risks: list[str] = Field(description="Up to 5 risks or problem areas.")
    top_recommendations: list[str] = Field(description="Up to 3 specific, actionable recommendations.")
    code_health_score: float = Field(ge=0, le=100, description="Overall code health score 0-100.")
    critical_issue: str = Field(description="The single most critical issue to address.")

    @field_validator("strengths")
    @classmethod
    def limit_strengths(cls, v: list[str]) -> list[str]:
        return v[:5]

    @field_validator("risks")
    @classmethod
    def limit_risks(cls, v: list[str]) -> list[str]:
        return v[:5]

    @field_validator("top_recommendations")
    @classmethod
    def limit_recommendations(cls, v: list[str]) -> list[str]:
        return v[:3]


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
    summary: str = Field(description="Brief security audit summary.")


class AiArchitectureSchema(BaseModel):
    tech_stack: dict[str, str] = Field(default_factory=dict, description="Keys: frontend, backend, database, devops, etc.")
    design_patterns: list[str] = Field(default_factory=list, description="Design patterns identified.")
    scalability_score: float = Field(default=50.0, ge=0, le=100)
    modularization_description: str = Field(default="", description="How the code is organized.")
    architectural_notes: str = Field(default="", description="Additional architectural observations.")

    @field_validator("design_patterns")
    @classmethod
    def limit_patterns(cls, v: list[str]) -> list[str]:
        return v[:10]
