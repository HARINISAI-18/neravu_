"""Add publication sync jobs and a version-filtered published RAG index."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "d4f7b2a901ce"
down_revision: Union[str, None] = "c8e2a4f6d901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.add_column(
        "programmes",
        sa.Column("pending_publication_version", sa.Integer(), nullable=True),
    )
    op.add_column(
        "scheme_publication_versions",
        sa.Column("index_status", sa.Text(), nullable=False, server_default="pending"),
    )
    op.add_column(
        "scheme_publication_versions",
        sa.Column("indexed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_scheme_publication_index_status",
        "scheme_publication_versions",
        "index_status IN ('pending', 'processing', 'ready', 'failed')",
    )

    for table_name in ("eligibility_rules", "document_requirements"):
        op.add_column(table_name, sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            f"fk_{table_name}_source_id_programme_sources",
            table_name,
            "programme_sources",
            ["source_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_index(f"ix_{table_name}_source_id", table_name, ["source_id"])

    op.create_table(
        "scheme_sync_jobs",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "programme_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("programmes.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("job_type", sa.Text(), nullable=False, server_default="rag"),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_code", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.UniqueConstraint(
            "programme_id", "version_number", "job_type",
            name="uq_scheme_sync_job_programme_version_type",
        ),
        sa.CheckConstraint("job_type = 'rag'", name="ck_scheme_sync_job_type"),
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'completed', 'failed')",
            name="ck_scheme_sync_job_status",
        ),
        sa.CheckConstraint("attempts >= 0", name="ck_scheme_sync_job_attempts"),
    )
    op.create_index(
        "ix_scheme_sync_jobs_ready",
        "scheme_sync_jobs",
        ["status", "available_at", "created_at"],
    )

    op.create_table(
        "published_knowledge_chunks",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "programme_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("programmes.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "publication_version_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("scheme_publication_versions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("claim_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_reference", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("source_locator", sa.Text(), nullable=False),
        sa.Column("source_review_expires_at", sa.Date(), nullable=False),
        sa.Column("field_path", sa.Text(), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(384), nullable=False),
        sa.Column("embedding_model", sa.Text(), nullable=False),
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed("to_tsvector('simple', chunk_text)", persisted=True),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.UniqueConstraint(
            "programme_id", "version_number", "content_hash",
            name="uq_published_knowledge_content_version",
        ),
    )
    op.create_index(
        "ix_published_chunks_programme_version",
        "published_knowledge_chunks",
        ["programme_id", "version_number"],
    )
    op.create_index(
        "ix_published_chunks_search_vector",
        "published_knowledge_chunks",
        ["search_vector"],
        postgresql_using="gin",
    )
    op.execute(
        "CREATE INDEX ix_published_chunks_embedding_hnsw "
        "ON public.published_knowledge_chunks USING hnsw (embedding vector_cosine_ops)"
    )
    op.execute("""
        CREATE FUNCTION public.search_published_knowledge(
            query_text text,
            query_embedding vector(384),
            result_limit integer,
            requested_programme uuid DEFAULT NULL
        ) RETURNS TABLE (
            chunk_id uuid,
            programme_id uuid,
            version_number integer,
            source_id uuid,
            claim_id uuid,
            source_reference text,
            source_url text,
            source_locator text,
            field_path text,
            chunk_text text,
            rrf_score double precision
        ) LANGUAGE sql STABLE AS $$
            WITH q AS (
                SELECT plainto_tsquery('simple', query_text) AS tsq
            ), eligible AS (
                SELECT k.*
                FROM public.published_knowledge_chunks k
                JOIN public.programmes p
                  ON p.id = k.programme_id
                 AND p.current_published_version = k.version_number
                JOIN public.scheme_publication_versions v
                  ON v.programme_id = k.programme_id
                 AND v.version_number = k.version_number
                 AND v.index_status = 'ready'
                WHERE k.source_review_expires_at >= CURRENT_DATE
                  AND (
                      requested_programme IS NULL
                      OR k.programme_id = requested_programme
                  )
            ), vector_ranked AS (
                SELECT e.id,
                       row_number() OVER (ORDER BY e.embedding <=> query_embedding) AS rank
                FROM eligible e
                ORDER BY e.embedding <=> query_embedding
                LIMIT LEAST(GREATEST(result_limit, 1), 100)
            ), lexical_ranked AS (
                SELECT e.id,
                       row_number() OVER (ORDER BY ts_rank_cd(e.search_vector, q.tsq) DESC) AS rank
                FROM eligible e CROSS JOIN q
                WHERE e.search_vector @@ q.tsq
                ORDER BY ts_rank_cd(e.search_vector, q.tsq) DESC
                LIMIT LEAST(GREATEST(result_limit, 1), 100)
            ), candidate_ids AS (
                SELECT id FROM vector_ranked
                UNION
                SELECT id FROM lexical_ranked
            )
            SELECT e.id, e.programme_id, e.version_number,
                   e.source_id, e.claim_id,
                   e.source_reference, e.source_url, e.source_locator,
                   e.field_path, e.chunk_text,
                   COALESCE(1.0 / (60 + vr.rank), 0)
                     + COALESCE(1.0 / (60 + lr.rank), 0) AS rrf_score
            FROM candidate_ids c
            JOIN eligible e ON e.id = c.id
            LEFT JOIN vector_ranked vr ON vr.id = e.id
            LEFT JOIN lexical_ranked lr ON lr.id = e.id
            ORDER BY rrf_score DESC
            LIMIT LEAST(GREATEST(result_limit, 1), 100)
        $$
    """)


def downgrade() -> None:
    for table_name in ("document_requirements", "eligibility_rules"):
        op.drop_index(f"ix_{table_name}_source_id", table_name=table_name)
        op.drop_constraint(f"fk_{table_name}_source_id_programme_sources", table_name, type_="foreignkey")
        op.drop_column(table_name, "source_id")
    op.execute("DROP FUNCTION IF EXISTS public.search_published_knowledge(text, vector, integer, uuid)")
    op.execute("DROP INDEX IF EXISTS public.ix_published_chunks_embedding_hnsw")
    op.drop_index("ix_published_chunks_search_vector", table_name="published_knowledge_chunks")
    op.drop_index("ix_published_chunks_programme_version", table_name="published_knowledge_chunks")
    op.drop_table("published_knowledge_chunks")
    op.drop_index("ix_scheme_sync_jobs_ready", table_name="scheme_sync_jobs")
    op.drop_table("scheme_sync_jobs")
    op.drop_constraint(
        "ck_scheme_publication_index_status",
        "scheme_publication_versions",
        type_="check",
    )
    op.drop_column("scheme_publication_versions", "indexed_at")
    op.drop_column("scheme_publication_versions", "index_status")
    op.drop_column("programmes", "pending_publication_version")
