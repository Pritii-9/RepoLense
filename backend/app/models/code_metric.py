from __future__ import annotations

import uuid

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class CodeMetric(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Stored analysis metrics for a repository snapshot."""

    __tablename__ = "code_metrics"

    analysis_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("analyses.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    file_count: Mapped[int] = mapped_column(Integer, nullable=False)
    line_count: Mapped[int] = mapped_column(Integer, nullable=False)
    commit_count: Mapped[int] = mapped_column(Integer, nullable=False)
    duplicate_block_count: Mapped[int] = mapped_column(Integer, nullable=False)
    duplicate_line_count: Mapped[int] = mapped_column(Integer, nullable=False)
    average_cyclomatic_complexity: Mapped[float] = mapped_column(Float, nullable=False)
    max_cyclomatic_complexity: Mapped[int] = mapped_column(Integer, nullable=False)
    maintainability_index: Mapped[float] = mapped_column(Float, nullable=False)
    technical_debt_score: Mapped[float] = mapped_column(Float, nullable=False)

    analysis = relationship("Analysis", back_populates="code_metric")
