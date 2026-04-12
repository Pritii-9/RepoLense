"""Initial RepoLens Stage 1 schema."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260410_230500"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    try:
        result = conn.exec_driver_sql(
            "SELECT 1 FROM pg_type WHERE typname = 'analysis_status'"
        ).fetchone()

        if result:
            conn.exec_driver_sql("DROP TYPE analysis_status CASCADE")

        result = conn.exec_driver_sql(
            "SELECT 1 FROM pg_type WHERE typname = 'report_type'"
        ).fetchone()

        if result:
            conn.exec_driver_sql("DROP TYPE report_type CASCADE")
    except Exception:
        pass

    analysis_status = postgresql.ENUM(
        "pending",
        "running",
        "completed",
        "failed",
        name="analysis_status",
        create_type=False,
    )
    report_type = postgresql.ENUM("csv", "pdf", name="report_type", create_type=False)
    
    analysis_status.create(conn, checkfirst=True)
    report_type.create(conn, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)

    op.create_table(
        "analyses",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("repository_url", sa.String(length=500), nullable=False),
        sa.Column("repository_name", sa.String(length=255), nullable=False),
        sa.Column("branch", sa.String(length=255), nullable=True),
        sa.Column(
            "status",
            analysis_status,
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_analyses_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_analyses")),
    )
    op.create_index(op.f("ix_analyses_status"), "analyses", ["status"], unique=False)
    op.create_index(op.f("ix_analyses_user_id"), "analyses", ["user_id"], unique=False)

    op.create_table(
        "code_metrics",
        sa.Column("analysis_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_count", sa.Integer(), nullable=False),
        sa.Column("line_count", sa.Integer(), nullable=False),
        sa.Column("commit_count", sa.Integer(), nullable=False),
        sa.Column("duplicate_block_count", sa.Integer(), nullable=False),
        sa.Column("duplicate_line_count", sa.Integer(), nullable=False),
        sa.Column("average_cyclomatic_complexity", sa.Float(), nullable=False),
        sa.Column("max_cyclomatic_complexity", sa.Integer(), nullable=False),
        sa.Column("maintainability_index", sa.Float(), nullable=False),
        sa.Column("technical_debt_score", sa.Float(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["analysis_id"],
            ["analyses.id"],
            name=op.f("fk_code_metrics_analysis_id_analyses"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_code_metrics")),
        sa.UniqueConstraint("analysis_id", name=op.f("uq_code_metrics_analysis_id")),
    )
    op.create_index(
        op.f("ix_code_metrics_analysis_id"),
        "code_metrics",
        ["analysis_id"],
        unique=False,
    )

    op.create_table(
        "reports",
        sa.Column("analysis_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("report_type", report_type, nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("s3_key", sa.String(length=1024), nullable=False),
        sa.Column("content_type", sa.String(length=255), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(
            ["analysis_id"],
            ["analyses.id"],
            name=op.f("fk_reports_analysis_id_analyses"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reports")),
        sa.UniqueConstraint("s3_key", name=op.f("uq_reports_s3_key")),
    )
    op.create_index(op.f("ix_reports_analysis_id"), "reports", ["analysis_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_reports_analysis_id"), table_name="reports")
    op.drop_table("reports")

    op.drop_index(op.f("ix_code_metrics_analysis_id"), table_name="code_metrics")
    op.drop_table("code_metrics")

    op.drop_index(op.f("ix_analyses_user_id"), table_name="analyses")
    op.drop_index(op.f("ix_analyses_status"), table_name="analyses")
    op.drop_table("analyses")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    conn = op.get_bind()

    try:
        conn.exec_driver_sql("DROP TYPE IF EXISTS report_type CASCADE")
        conn.exec_driver_sql("DROP TYPE IF EXISTS analysis_status CASCADE")
    except Exception:
        pass
