"""Add evidence claims, review decisions, and immutable publications."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c8e2a4f6d901"
down_revision: Union[str, None] = "b7f1c2d3e4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "programmes",
        sa.Column("current_published_version", sa.Integer(), nullable=True),
    )
    op.add_column(
        "programme_sources",
        sa.Column("issuing_body", sa.Text(), nullable=True),
    )
    op.add_column(
        "programme_sources",
        sa.Column(
            "evidence_status", sa.Text(), nullable=False, server_default="unverified"
        ),
    )
    op.add_column(
        "programme_sources",
        sa.Column("reviewed_by", sa.Text(), nullable=True),
    )
    op.add_column(
        "programme_sources",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "programme_sources",
        sa.Column("review_expires_at", sa.Date(), nullable=True),
    )
    op.create_check_constraint(
        "ck_programme_sources_evidence_status",
        "programme_sources",
        "evidence_status IN ('unverified', 'approved', 'rejected')",
    )

    op.create_table(
        "scheme_evidence_claims",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "programme_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("programmes.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "source_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("programme_sources.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("field_path", sa.Text(), nullable=False),
        sa.Column("claim_text", sa.Text(), nullable=False),
        sa.Column("structured_value", postgresql.JSONB(), nullable=True),
        sa.Column("source_locator", sa.Text(), nullable=False),
        sa.Column("is_critical", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("review_status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("created_by", sa.Text(), nullable=False),
        sa.Column("reviewed_by", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.CheckConstraint(
            "review_status IN ('pending', 'approved', 'rejected')",
            name="ck_scheme_evidence_claim_review_status",
        ),
    )
    op.create_index(
        "ix_scheme_evidence_claims_programme",
        "scheme_evidence_claims",
        ["programme_id", "review_status"],
    )

    op.create_table(
        "scheme_evidence_reviews",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("programme_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_type", sa.Text(), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("decision", sa.Text(), nullable=False),
        sa.Column("reviewer_user_id", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("target_snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("source_snapshot", postgresql.JSONB(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.CheckConstraint(
            "target_type IN ('source', 'claim')",
            name="ck_scheme_evidence_review_target_type",
        ),
        sa.CheckConstraint(
            "decision IN ('approved', 'rejected')",
            name="ck_scheme_evidence_review_decision",
        ),
    )
    op.create_index(
        "ix_scheme_evidence_reviews_target",
        "scheme_evidence_reviews",
        ["target_type", "target_id", "reviewed_at"],
    )

    op.create_table(
        "scheme_publication_versions",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "programme_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("programmes.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("published_by", sa.Text(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.UniqueConstraint(
            "programme_id", "version_number",
            name="uq_scheme_publication_programme_version",
        ),
        sa.CheckConstraint("version_number >= 1", name="ck_scheme_publication_version_positive"),
    )
    op.create_index(
        "ix_scheme_publication_programme_version",
        "scheme_publication_versions",
        ["programme_id", "version_number"],
    )

    op.execute("""
        CREATE FUNCTION public.prevent_neravu_history_mutation()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_TABLE_NAME = 'scheme_publication_versions' THEN
                IF TG_OP = 'UPDATE' THEN
                    IF NEW.id IS NOT DISTINCT FROM OLD.id
                       AND NEW.programme_id IS NOT DISTINCT FROM OLD.programme_id
                       AND NEW.version_number IS NOT DISTINCT FROM OLD.version_number
                       AND NEW.snapshot IS NOT DISTINCT FROM OLD.snapshot
                       AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
                       AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at THEN
                        RETURN NEW;
                    END IF;
                END IF;
            END IF;
            RAISE EXCEPTION 'Neravu history records are append-only';
        END;
        $$
    """)
    for table_name, trigger_name in (
        ("scheme_admin_audit_events", "trg_scheme_admin_audit_append_only"),
        ("scheme_evidence_reviews", "trg_scheme_evidence_reviews_append_only"),
        ("scheme_publication_versions", "trg_scheme_publication_versions_append_only"),
    ):
        op.execute(
            f"CREATE TRIGGER {trigger_name} BEFORE UPDATE OR DELETE ON public.{table_name} "
            "FOR EACH ROW EXECUTE FUNCTION public.prevent_neravu_history_mutation()"
        )

    op.drop_constraint(
        "ck_scheme_admin_audit_action",
        "scheme_admin_audit_events",
        type_="check",
    )
    op.create_check_constraint(
        "ck_scheme_admin_audit_action",
        "scheme_admin_audit_events",
        "action IN ('created', 'updated', 'deleted', 'source_created', "
        "'source_updated', 'source_deleted', 'claim_created', 'claim_updated', "
        "'source_reviewed', 'claim_reviewed', 'publication_queued', 'sync_retried')",
    )


def downgrade() -> None:
    for table_name, trigger_name in (
        ("scheme_publication_versions", "trg_scheme_publication_versions_append_only"),
        ("scheme_evidence_reviews", "trg_scheme_evidence_reviews_append_only"),
        ("scheme_admin_audit_events", "trg_scheme_admin_audit_append_only"),
    ):
        op.execute(f"DROP TRIGGER IF EXISTS {trigger_name} ON public.{table_name}")
    op.execute("DROP FUNCTION IF EXISTS public.prevent_neravu_history_mutation()")
    op.drop_constraint(
        "ck_scheme_admin_audit_action",
        "scheme_admin_audit_events",
        type_="check",
    )
    op.create_check_constraint(
        "ck_scheme_admin_audit_action",
        "scheme_admin_audit_events",
        "action IN ('created', 'updated', 'deleted', 'source_created', "
        "'source_updated', 'source_deleted')",
    )
    op.drop_index(
        "ix_scheme_publication_programme_version",
        table_name="scheme_publication_versions",
    )
    op.drop_table("scheme_publication_versions")
    op.drop_index(
        "ix_scheme_evidence_reviews_target",
        table_name="scheme_evidence_reviews",
    )
    op.drop_table("scheme_evidence_reviews")
    op.drop_index(
        "ix_scheme_evidence_claims_programme",
        table_name="scheme_evidence_claims",
    )
    op.drop_table("scheme_evidence_claims")
    op.drop_constraint(
        "ck_programme_sources_evidence_status",
        "programme_sources",
        type_="check",
    )
    op.drop_column("programme_sources", "review_expires_at")
    op.drop_column("programme_sources", "reviewed_at")
    op.drop_column("programme_sources", "reviewed_by")
    op.drop_column("programme_sources", "evidence_status")
    op.drop_column("programme_sources", "issuing_body")
    op.drop_column("programmes", "current_published_version")
