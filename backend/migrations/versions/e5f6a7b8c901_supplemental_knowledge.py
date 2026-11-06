"""Add a searchable index for user-provided reference PDFs."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "e5f6a7b8c901"
down_revision: Union[str, None] = "d4f7b2a901ce"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "supplemental_knowledge_chunks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("document_name", sa.Text(), nullable=False),
        sa.Column("document_hash", sa.Text(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("chunk_number", sa.Integer(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("verification_status", sa.Text(), nullable=False, server_default="unverified"),
        sa.Column("embedding", Vector(384), nullable=False),
        sa.Column("embedding_model", sa.Text(), nullable=False),
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed("to_tsvector('simple', chunk_text)", persisted=True),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint(
            "document_hash",
            "page_number",
            "chunk_number",
            name="uq_supplemental_knowledge_document_page_chunk",
        ),
        sa.CheckConstraint("page_number > 0", name="ck_supplemental_knowledge_page_positive"),
        sa.CheckConstraint("chunk_number >= 0", name="ck_supplemental_knowledge_chunk_nonnegative"),
        sa.CheckConstraint(
            "verification_status IN ('unverified', 'verified')",
            name="ck_supplemental_knowledge_verification",
        ),
    )
    op.execute("ALTER TABLE public.supplemental_knowledge_chunks ENABLE ROW LEVEL SECURITY")
    op.execute("REVOKE ALL ON TABLE public.supplemental_knowledge_chunks FROM PUBLIC")
    op.create_index(
        "ix_supplemental_knowledge_search_vector",
        "supplemental_knowledge_chunks",
        ["search_vector"],
        postgresql_using="gin",
    )
    op.execute(
        "CREATE INDEX ix_supplemental_knowledge_embedding_hnsw "
        "ON public.supplemental_knowledge_chunks USING hnsw (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS public.ix_supplemental_knowledge_embedding_hnsw")
    op.drop_index(
        "ix_supplemental_knowledge_search_vector",
        table_name="supplemental_knowledge_chunks",
    )
    op.drop_table("supplemental_knowledge_chunks")
