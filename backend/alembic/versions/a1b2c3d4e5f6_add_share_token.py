"""add share_token to analyses

Revision ID: a1b2c3d4e5f6
Revises: bb0762393dfe
Create Date: 2026-07-03

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "bb0762393dfe"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column("share_token", sa.String(64), nullable=True, unique=True),
    )
    op.create_index("ix_analyses_share_token", "analyses", ["share_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_analyses_share_token", table_name="analyses")
    op.drop_column("analyses", "share_token")
