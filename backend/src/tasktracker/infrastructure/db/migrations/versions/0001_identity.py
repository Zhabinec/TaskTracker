"""Create users and hashed opaque session storage.

Revision ID: 0001_identity
Revises: none
"""

import sqlalchemy as sa
from alembic import op

revision = "0001_identity"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email_normalized", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email_normalized", name="uq_users_email_normalized"),
        sa.CheckConstraint(
            "email_normalized = lower(btrim(email_normalized)) AND "
            "char_length(email_normalized) BETWEEN 1 AND 254",
            name="ck_users_email_normalized",
        ),
        sa.CheckConstraint("char_length(password_hash) > 0", name="ck_users_password_hash"),
    )
    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name="pk_sessions"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE", name="fk_sessions_user_id_users"
        ),
        sa.UniqueConstraint("token_hash", name="uq_sessions_token_hash"),
        sa.CheckConstraint("token_hash ~ '^[0-9a-f]{64}$'", name="ck_sessions_token_hash"),
        sa.CheckConstraint("expires_at > created_at", name="ck_sessions_expiry"),
        sa.CheckConstraint("revoked_at >= created_at", name="ck_sessions_revocation"),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_table("sessions")
    op.drop_table("users")
