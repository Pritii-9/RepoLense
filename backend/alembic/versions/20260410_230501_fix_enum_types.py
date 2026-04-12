"""Legacy enum follow-up kept as a no-op to preserve revision history."""

from __future__ import annotations

revision = "20260410_230501"
down_revision = "20260410_230500"
branch_labels = None
depends_on = None


def upgrade() -> None:
    return None


def downgrade() -> None:
    return None
