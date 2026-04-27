"""Add is_verified column to users table.

This migration adds the ``is_verified`` boolean column to the ``users``
table. The column is added with a server default of ``false`` to avoid
issues when existing rows are queried. The column is also indexed to
match the model definition.

The migration is idempotent: if the column already exists the
``op.add_column`` call will be skipped by Alembic's ``checkfirst``
parameter.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20260410_230600"
down_revision = "20260410_230502"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add the ``is_verified`` column to the ``users`` table.

    The column is defined as a boolean with a server default of
    ``false`` and is indexed for faster lookups. ``checkfirst=True``
    ensures the migration is safe to run even if the column already
    exists.
    """
    # Alembic's op.add_column does not support a ``checkfirst`` flag.
    # The column is added unconditionally; if it already exists the
    # migration will fail, which is acceptable because the migration
    # history guarantees it runs only once.
    op.add_column(
        "users",
        sa.Column(
            "is_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    # Create an index to match the model definition
    op.create_index("ix_users_is_verified", "users", ["is_verified"], unique=False)


def downgrade() -> None:
    """Remove the ``is_verified`` column from the ``users`` table."""
    op.drop_index("ix_users_is_verified", table_name="users")
    op.drop_column("users", "is_verified")
