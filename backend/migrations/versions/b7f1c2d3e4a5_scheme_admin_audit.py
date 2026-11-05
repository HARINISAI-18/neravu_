"""Add durable audit snapshots for authenticated draft scheme CRUD."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b7f1c2d3e4a5"
down_revision: Union[str, None] = "88cda3ba8b82"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "scheme_admin_audit_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("programme_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", sa.Text(), nullable=False),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("before_snapshot", postgresql.JSONB()),
        sa.Column("after_snapshot", postgresql.JSONB()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "action IN ('created', 'updated', 'deleted', "
            "'source_created', 'source_updated', 'source_deleted')",
            name="ck_scheme_admin_audit_action",
        ),
    )
    op.create_index(
        "ix_scheme_admin_audit_programme_created",
        "scheme_admin_audit_events",
        ["programme_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_scheme_admin_audit_programme_created",
        table_name="scheme_admin_audit_events",
    )
    op.drop_table("scheme_admin_audit_events")
