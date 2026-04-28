"""Add ai_insights table.

This migration creates the ``ai_insights`` table that stores AI-generated
insights linked to repository analyses. It also adds a JSON column for
structured outputs and tracking fields for cost and latency analytics.

Revision ID: 20260411_000000
Revises: 20260410_230600
Create Date: 2026-04-11 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260411_000000"
down_revision = "20260410_230600"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the ``ai_insights`` table."""
    op.create_table(
        "ai_insights",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("analysis_id", sa.String(36), nullable=False, index=True),
        sa.Column("insight_type", sa.String(50), nullable=False, index=True),
        sa.Column("model_used", sa.String(100), nullable=False),
        sa.Column("prompt_version", sa.String(20), nullable=False, server_default="1.0"),
        sa.Column("structured_data", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analyses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("analysis_id", "insight_type", name="uq_ai_insight_analysis_type"),
    )
    op.create_index("ix_ai_insights_analysis_id", "ai_insights", ["analysis_id"], unique=False)


def downgrade() -> None:
    """Drop the ``ai_insights`` table."""
    op.drop_index("ix_ai_insights_analysis_id", table_name="ai_insights")
    op.drop_table("ai_insights")
