"""Initial Neravu database schema.

Revision ID: 88cda3ba8b82
Revises:
Create Date: 2026-11-01 15:04:26.844349
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "88cda3ba8b82"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
     # gen_random_uuid() is available in supported PostgreSQL versions.
    # Enable pgvector separately when implementing RAG.

    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("organization_type", sa.Text(), nullable=False),
        sa.Column("official_website", sa.Text()),
        sa.Column("contact_email", sa.Text()),
        sa.Column("contact_phone", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )

    op.create_table(
        "programmes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("programme_code", sa.Text(), nullable=False, unique=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("official_name", sa.Text(), nullable=False),
        sa.Column("programme_type", sa.Text(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("coverage", postgresql.JSONB(), nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("details", postgresql.JSONB(), nullable=False,
                  server_default=sa.text("'{}'::jsonb")),
        sa.Column("review_status", sa.Text(), nullable=False,
                  server_default="draft"),
        sa.CheckConstraint(
            "review_status IN ('draft', 'under_review', 'verified', 'expired', 'superseded')",
            name="ck_programmes_review_status",
        ),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("version >= 1", name="ck_programmes_version"),
        sa.Column("last_verified_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_programmes_review_status", "programmes", ["review_status"])

    op.create_table(
        "programme_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("programme_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("programmes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_title", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text()),
        sa.Column("storage_path", sa.Text()),
        sa.Column("page_reference", sa.Text()),
        sa.Column("effective_date", sa.Date()),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_programme_sources_programme_id", "programme_sources", ["programme_id"])

    op.create_table(
        "eligibility_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("programme_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("programmes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_type", sa.Text(), nullable=False),
        sa.Column("rule_definition", postgresql.JSONB(), nullable=False),
        sa.Column("explanation", sa.Text()),
        sa.Column("source_reference", sa.Text()),
        sa.Column("verification_status", sa.Text(), nullable=False,
                  server_default="unverified"),
        sa.CheckConstraint(
            "verification_status IN ('unverified', 'verified', 'requires_review')",
            name="ck_eligibility_rules_verification",
        ),
    )
    op.create_index("ix_eligibility_rules_programme_id", "eligibility_rules", ["programme_id"])

    op.create_table(
        "document_requirements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("programme_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("programmes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_name", sa.Text(), nullable=False),
        sa.Column("required_when", postgresql.JSONB()),
        sa.Column("accepted_alternatives", postgresql.JSONB()),
        sa.Column("source_reference", sa.Text()),
    )
    op.create_index("ix_document_requirements_programme_id", "document_requirements", ["programme_id"])


def downgrade() -> None:
    op.drop_index("ix_document_requirements_programme_id", table_name="document_requirements")
    op.drop_table("document_requirements")
    op.drop_index("ix_eligibility_rules_programme_id", table_name="eligibility_rules")
    op.drop_table("eligibility_rules")
    op.drop_index("ix_programme_sources_programme_id", table_name="programme_sources")
    op.drop_table("programme_sources")
    op.drop_index("ix_programmes_review_status", table_name="programmes")
    op.drop_table("programmes")
    op.drop_table("organizations")
    # Shared PostgreSQL extensions are intentionally retained.
