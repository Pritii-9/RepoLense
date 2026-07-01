"""add github oauth fields"""

revision = '85fe329686c1'
down_revision = '6db339ec0b61'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa



def upgrade() -> None:
    op.add_column('users', sa.Column('github_id', sa.String(length=100), nullable=True))
    op.create_index(op.f('ix_users_github_id'), 'users', ['github_id'], unique=True)
    op.add_column('users', sa.Column('github_access_token', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'github_access_token')
    op.drop_index(op.f('ix_users_github_id'), table_name='users')
    op.drop_column('users', 'github_id')
