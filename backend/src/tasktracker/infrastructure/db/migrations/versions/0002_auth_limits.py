"""Share authentication rate limits between workers.

Revision ID: 0002_auth_limits
Revises: 0001_identity
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_auth_limits"
down_revision = "0001_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_rate_windows",
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("window_start", "key", name="pk_auth_rate_windows"),
        sa.CheckConstraint("attempts > 0", name="ck_auth_rate_windows_attempts"),
    )


def downgrade() -> None:
    op.drop_table("auth_rate_windows")
