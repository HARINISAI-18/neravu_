
import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sentence_transformers import (
    SentenceTransformer,
    CrossEncoder,
)

load_dotenv(
    Path(__file__).resolve().parents[3] / ".env"
)

EMBEDDING_MODEL = "intfloat/multilingual-e5-small"
RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"


@lru_cache(maxsize=1)
def get_embedding_model():
    return SentenceTransformer(EMBEDDING_MODEL)


@lru_cache(maxsize=1)
def get_reranker():
    return CrossEncoder(RERANKER_MODEL)


@lru_cache(maxsize=1)
def get_engine():
    url = os.getenv("SUPABASE_DATABASE_URL")

    if not url:
        raise RuntimeError("SUPABASE_DATABASE_URL missing")

    host = (make_url(url).host or "").lower()

    if not host.endswith(".supabase.com"):
        raise RuntimeError("Expected Supabase database host")

    return create_engine(url, pool_pre_ping=True)


def hybrid_retrieve(
    question: str,
    programme_id: str | None = None,
    candidate_count: int = 15,
    top_k: int = 5,
) -> list[dict]:

    if not question or not question.strip():
        raise ValueError("Question cannot be empty")

    if not 1 <= top_k <= candidate_count <= 30:
        raise ValueError("Invalid retrieval limits")

    embedding = get_embedding_model().encode(
        "query: " + question,
        normalize_embeddings=True,
    )

    vector_value = (
        "[" +
        ",".join(str(float(x)) for x in embedding) +
        "]"
    )

    with get_engine().connect() as connection:
        rows = connection.execute(
            text("""
                SELECT *
                FROM public.hybrid_search_knowledge(
                    :question,
                    CAST(:embedding AS vector(384)),
                    :candidate_count,
                    CAST(:programme_id AS uuid)
                )
            """),
            {
                "question": question,
                "embedding": vector_value,
                "candidate_count": candidate_count,
                "programme_id": programme_id,
            },
        ).mappings().all()

    if not rows:
        return []

    candidates = [dict(row) for row in rows]

    pairs = [
        (question, item["chunk_text"])
        for item in candidates
    ]

    scores = get_reranker().predict(
        pairs,
        batch_size=4,
        show_progress_bar=False,
    )

    for item, score in zip(candidates, scores):
        item["rerank_score"] = float(score)

    candidates.sort(
        key=lambda item: item["rerank_score"],
        reverse=True,
    )

    return candidates[:top_k]
