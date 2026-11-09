"""Idempotent worker that indexes reviewed publication snapshots."""

import asyncio
import hashlib
import json
import logging
from functools import lru_cache
from typing import Any

from sqlalchemy import text

from app.db.config import get_database_engine


logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 5
MAX_CHUNK_CHARS = 1200
CHUNK_OVERLAP_CHARS = 120


def _compute_vectors(texts: list[str]):
    from app.services.hybrid_rag import compute_embeddings
    return compute_embeddings(texts)


def _split_text(value: str) -> list[str]:
    value = value.strip()
    if len(value) <= MAX_CHUNK_CHARS:
        return [value] if value else []
    chunks = []
    start = 0
    while start < len(value):
        end = min(start + MAX_CHUNK_CHARS, len(value))
        if end < len(value):
            boundary = value.rfind(" ", start, end)
            if boundary > start:
                end = boundary
        chunks.append(value[start:end].strip())
        if end >= len(value):
            break
        start = max(start + 1, end - CHUNK_OVERLAP_CHARS)
    return [chunk for chunk in chunks if chunk]


def _build_index_chunks(snapshot: dict[str, Any]) -> list[dict[str, str]]:
    programme = snapshot.get("programme") or {}
    sources = {
        str(source["id"]): source
        for source in snapshot.get("sources", [])
    }
    chunks = []
    for claim in snapshot.get("evidence_claims", []):
        if claim.get("review_status") != "approved":
            continue
        source = sources.get(str(claim.get("source_id")))
        if not source or source.get("evidence_status") != "approved":
            continue
        value = claim.get("structured_value")
        value_text = json.dumps(value, ensure_ascii=False, sort_keys=True)
        context = (
            f"Programme: {programme.get('official_name', '')}\n"
            f"Field: {claim.get('field_path', '')}\n"
            f"Approved claim: {claim.get('claim_text', '')}\n"
            f"Structured value: {value_text}\n"
            f"Official source: {source.get('source_title', '')}; "
            f"issuing body: {source.get('issuing_body', '')}\n"
            f"Evidence location: {claim.get('source_locator', '')}"
        )
        for piece in _split_text(context):
            chunks.append({
                "source_id": str(source["id"]),
                "claim_id": str(claim["id"]),
                "source_reference": str(source.get("source_title", "")),
                "source_url": str(source.get("source_url", "")),
                "source_locator": str(claim.get("source_locator", "")),
                "source_review_expires_at": str(source.get("review_expires_at", "")),
                "field_path": str(claim.get("field_path", "")),
                "chunk_text": piece,
            })
    return chunks


def _claim_job() -> dict[str, Any] | None:
    engine = get_database_engine()
    with engine.begin() as connection:
        connection.execute(text("""
            UPDATE public.scheme_sync_jobs
            SET status = 'pending', locked_at = NULL, updated_at = now()
            WHERE status = 'processing' AND attempts < :max_attempts
              AND locked_at < now() - interval '5 minutes'
        """), {"max_attempts": MAX_ATTEMPTS})
        connection.execute(text("""
            UPDATE public.scheme_sync_jobs
            SET status = 'failed', error_code = 'worker_lease_expired',
                locked_at = NULL, updated_at = now()
            WHERE status = 'processing' AND attempts >= :max_attempts
              AND locked_at < now() - interval '5 minutes'
        """), {"max_attempts": MAX_ATTEMPTS})
        connection.execute(text("""
            UPDATE public.scheme_publication_versions v
            SET index_status = 'failed'
            FROM public.scheme_sync_jobs j
            WHERE j.programme_id = v.programme_id
              AND j.version_number = v.version_number
              AND j.job_type = 'rag' AND j.status = 'failed'
        """))
        connection.execute(text("""
            UPDATE public.programmes p
            SET pending_publication_version = NULL
            WHERE p.pending_publication_version IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM public.scheme_sync_jobs j
                  WHERE j.programme_id = p.id
                    AND j.version_number = p.pending_publication_version
                    AND j.status = 'failed'
              )
        """))
        job_row = connection.execute(
            text("""
                SELECT id, programme_id, version_number, attempts
                FROM public.scheme_sync_jobs
                WHERE status = 'pending' AND available_at <= now()
                ORDER BY created_at, id
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            """),
        ).mappings().first()
        if job_row is None:
            return None
        job = dict(job_row)
        connection.execute(
            text("""
                UPDATE public.scheme_sync_jobs
                SET status = 'processing', attempts = attempts + 1,
                    locked_at = now(), updated_at = now(), error_code = NULL
                WHERE id = :job_id
            """),
            {"job_id": str(job["id"])},
        )
        snapshot = connection.execute(
            text("""
                SELECT snapshot, published_at
                FROM public.scheme_publication_versions
                WHERE programme_id = :programme_id AND version_number = :version_number
            """),
            {
                "programme_id": str(job["programme_id"]),
                "version_number": job["version_number"],
            },
        ).mappings().first()
        if snapshot is None:
            connection.execute(
                text("""
                    UPDATE public.scheme_sync_jobs
                    SET status = 'failed', error_code = 'publication_snapshot_missing',
                        locked_at = NULL, updated_at = now()
                    WHERE id = :job_id
                """),
                {"job_id": str(job["id"])},
            )
            connection.execute(
                text("""
                    UPDATE public.scheme_publication_versions
                    SET index_status = 'failed'
                    WHERE programme_id = :programme_id AND version_number = :version_number
                """),
                {
                    "programme_id": str(job["programme_id"]),
                    "version_number": job["version_number"],
                },
            )
            connection.execute(
                text("""
                    UPDATE public.programmes SET pending_publication_version = NULL
                    WHERE id = :programme_id AND pending_publication_version = :version_number
                """),
                {
                    "programme_id": str(job["programme_id"]),
                    "version_number": job["version_number"],
                },
            )
            return None
        job["snapshot"] = snapshot["snapshot"]
        job["published_at"] = snapshot["published_at"]
        connection.execute(
            text("""
                UPDATE public.scheme_publication_versions
                SET index_status = 'processing'
                WHERE programme_id = :programme_id AND version_number = :version_number
            """),
            {
                "programme_id": str(job["programme_id"]),
                "version_number": job["version_number"],
            },
        )
        return job


def _write_index(job: dict[str, Any], chunks: list[dict[str, str]], vectors) -> None:
    engine = get_database_engine()
    with engine.begin() as connection:
        publication = connection.execute(
            text("""
                SELECT id FROM public.scheme_publication_versions
                WHERE programme_id = :programme_id AND version_number = :version_number
                FOR UPDATE
            """),
            {
                "programme_id": str(job["programme_id"]),
                "version_number": job["version_number"],
            },
        ).mappings().one()

        for chunk, vector in zip(chunks, vectors):
            vector_value = "[" + ",".join(str(float(value)) for value in vector) + "]"
            content_hash = hashlib.sha256(chunk["chunk_text"].encode("utf-8")).hexdigest()
            connection.execute(
                text("""
                    INSERT INTO public.published_knowledge_chunks (
                        programme_id, publication_version_id, version_number,
                        source_id, claim_id, source_reference, source_url,
                        source_locator, source_review_expires_at, field_path,
                        chunk_text, content_hash, embedding, embedding_model
                    ) VALUES (
                        :programme_id, :publication_version_id, :version_number,
                        :source_id, :claim_id, :source_reference, :source_url,
                        :source_locator, CAST(:source_review_expires_at AS date), :field_path,
                        :chunk_text, :content_hash, CAST(:embedding AS vector(384)),
                        :embedding_model
                    )
                    ON CONFLICT (programme_id, version_number, content_hash)
                    DO UPDATE SET
                        publication_version_id = EXCLUDED.publication_version_id,
                        source_id = EXCLUDED.source_id,
                        claim_id = EXCLUDED.claim_id,
                        source_reference = EXCLUDED.source_reference,
                        source_url = EXCLUDED.source_url,
                        source_locator = EXCLUDED.source_locator,
                        source_review_expires_at = EXCLUDED.source_review_expires_at,
                        field_path = EXCLUDED.field_path,
                        chunk_text = EXCLUDED.chunk_text,
                        embedding = EXCLUDED.embedding,
                        embedding_model = EXCLUDED.embedding_model
                """),
                {
                    **chunk,
                    "programme_id": str(job["programme_id"]),
                    "publication_version_id": str(publication["id"]),
                    "version_number": job["version_number"],
                    "content_hash": content_hash,
                    "embedding": vector_value,
                    "embedding_model": "intfloat/multilingual-e5-small",
                },
            )

        connection.execute(
            text("""
                UPDATE public.scheme_publication_versions
                SET index_status = 'ready', indexed_at = now()
                WHERE programme_id = :programme_id AND version_number = :version_number
            """),
            {
                "programme_id": str(job["programme_id"]),
                "version_number": job["version_number"],
            },
        )
        connection.execute(
            text("""
                UPDATE public.programmes
                SET current_published_version = :version_number,
                    pending_publication_version = NULL,
                    review_status = 'verified',
                    last_verified_at = :published_at,
                    updated_at = now()
                WHERE id = :programme_id
                  AND pending_publication_version = :version_number
            """),
            {
                "programme_id": str(job["programme_id"]),
                "version_number": job["version_number"],
                "published_at": job["published_at"],
            },
        )
        connection.execute(
            text("""
                UPDATE public.scheme_sync_jobs
                SET status = 'completed', completed_at = now(),
                    locked_at = NULL, updated_at = now(), error_code = NULL
                WHERE id = :job_id
            """),
            {"job_id": str(job["id"])},
        )


def _mark_failed(job: dict[str, Any], error: Exception) -> None:
    engine = get_database_engine()
    error_code = type(error).__name__[:100]
    with engine.begin() as connection:
        job_state = connection.execute(
            text("SELECT attempts FROM public.scheme_sync_jobs WHERE id = :job_id FOR UPDATE"),
            {"job_id": str(job["id"])},
        ).mappings().first()
        attempts = int(job_state["attempts"]) if job_state else MAX_ATTEMPTS
        terminal = attempts >= MAX_ATTEMPTS
        connection.execute(
            text("""
                UPDATE public.scheme_sync_jobs
                SET status = :status,
                    available_at = now() + (LEAST(attempts * 15, 300) * interval '1 second'),
                    locked_at = NULL, updated_at = now(), error_code = :error_code
                WHERE id = :job_id
            """),
            {
                "job_id": str(job["id"]),
                "status": "failed" if terminal else "pending",
                "error_code": error_code,
            },
        )
        if terminal:
            connection.execute(
                text("""
                    UPDATE public.scheme_publication_versions
                    SET index_status = 'failed'
                    WHERE programme_id = :programme_id AND version_number = :version_number
                """),
                {
                    "programme_id": str(job["programme_id"]),
                    "version_number": job["version_number"],
                },
            )
            connection.execute(
                text("""
                    UPDATE public.programmes SET pending_publication_version = NULL
                    WHERE id = :programme_id AND pending_publication_version = :version_number
                """),
                {
                    "programme_id": str(job["programme_id"]),
                    "version_number": job["version_number"],
                },
            )
        connection.execute(
            text("""
                UPDATE public.scheme_publication_versions
                SET index_status = :index_status
                WHERE programme_id = :programme_id AND version_number = :version_number
            """),
            {
                "programme_id": str(job["programme_id"]),
                "version_number": job["version_number"],
                "index_status": "failed" if terminal else "pending",
            },
        )


def process_one_job() -> bool:
    job = _claim_job()
    if job is None:
        return False
    try:
        snapshot = job["snapshot"]
        if isinstance(snapshot, str):
            snapshot = json.loads(snapshot)
        chunks = _build_index_chunks(snapshot)
        if not chunks:
            raise ValueError("publication_snapshot_has_no_approved_claims")
        vectors = _compute_vectors(["passage: " + chunk["chunk_text"] for chunk in chunks])
        _write_index(job, chunks, vectors)
    except Exception as error:
        logger.warning("Scheme sync job failed (%s)", type(error).__name__)
        _mark_failed(job, error)
    return True


async def run_sync_worker() -> None:
    while True:
        try:
            processed = await asyncio.to_thread(process_one_job)
            await asyncio.sleep(0 if processed else 30)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.warning("Scheme sync worker unavailable (%s)", type(error).__name__)
            await asyncio.sleep(5)
