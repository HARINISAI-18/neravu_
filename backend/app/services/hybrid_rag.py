import os

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from functools import lru_cache

from sqlalchemy import text
from sentence_transformers import SentenceTransformer

from app.db.config import get_database_engine

EMBEDDING_MODEL = "intfloat/multilingual-e5-small"
RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"


@lru_cache(maxsize=1)
def get_embedding_model():
    try:
        return SentenceTransformer(EMBEDDING_MODEL, local_files_only=True)
    except Exception:
        return SentenceTransformer(EMBEDDING_MODEL)


@lru_cache(maxsize=1)
def get_reranker():
    from sentence_transformers import CrossEncoder
    return CrossEncoder(RERANKER_MODEL)


@lru_cache(maxsize=1)
def get_engine():
    return get_database_engine()


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
                FROM public.search_published_knowledge(
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

    rerank_enabled = os.getenv("ENABLE_RERANKER", "false").lower() in {"1", "true"}
    if rerank_enabled:
        try:
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
        except Exception:
            pass

    for item in candidates:
        item["rerank_score"] = float(item.get("rrf_score", 0.0))

    candidates.sort(
        key=lambda item: item["rerank_score"],
        reverse=True,
    )

    return candidates[:top_k]
