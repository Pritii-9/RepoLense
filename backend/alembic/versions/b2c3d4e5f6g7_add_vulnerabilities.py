"""add vulnerabilities table

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'b2c3d4e5f6g7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table('vulnerabilities',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('analysis_id', sa.String(length=36), nullable=False),
        sa.Column('package_name', sa.String(length=255), nullable=False),
        sa.Column('ecosystem', sa.String(length=50), nullable=False),
        sa.Column('cve_id', sa.String(length=100), nullable=False),
        sa.Column('summary', sa.String(length=1000), nullable=True),
        sa.Column('severity', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['analysis_id'], ['analyses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vulnerabilities_analysis_id'), 'vulnerabilities', ['analysis_id'], unique=False)
    op.create_index(op.f('ix_vulnerabilities_id'), 'vulnerabilities', ['id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_vulnerabilities_id'), table_name='vulnerabilities')
    op.drop_index(op.f('ix_vulnerabilities_analysis_id'), table_name='vulnerabilities')
    op.drop_table('vulnerabilities')
