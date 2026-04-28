from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, Text, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class AiInsight(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """AI-generated insights linked to an analysis job."""

    __tablename__ = "ai_insights"

    analysis_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("analyses.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    insight_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(20), nullable=False, default="1.0")

    # Structured data stored as JSON
    structured_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Raw text fallback
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Analytics / cost tracking
    input_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    analysis = relationship("Analysis", back_populates="ai_insights")
