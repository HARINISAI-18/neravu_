
import os
import json
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sentence_transformers import SentenceTransformer

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATABASE_URL = os.getenv("SUPABASE_DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("SUPABASE_DATABASE_URL missing")

host = (make_url(DATABASE_URL).host or "").lower()

if not host.endswith(".supabase.com"):
    raise RuntimeError("Expected Supabase database host")

MODEL_NAME = "intfloat/multilingual-e5-small"

model = SentenceTransformer(MODEL_NAME)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

PROGRAMME_CODE = "CSV-F64FDF5C58ACCF8E2112"


def collect_text(value, prefix=""):
    """Flatten nested questionnaire JSON into text entries."""

    if isinstance(value, dict):
        for key, child in value.items():
            label = f"{prefix} / {key}" if prefix else str(key)
            yield from collect_text(child, label)

    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from collect_text(
                child,
                f"{prefix} / item {index + 1}"
            )

    elif value is not None:
        content = str(value).strip()

        if content:
            yield f"{prefix}\n{content}"


def split_text(text_value, max_chars=900, overlap=120):
    """Split long entries without losing nearby context."""

    if max_chars <= overlap:
        raise ValueError("max_chars must exceed overlap")

    start = 0

    while start < len(text_value):
        end = min(start + max_chars, len(text_value))

        yield text_value[start:end]

        if end == len(text_value):
            break

        start = end - overlap


with engine.begin() as connection:
    programme = connection.execute(
        text("""
            SELECT id, official_name, details
            FROM public.programmes
            WHERE programme_code = :code
        """),
        {"code": PROGRAMME_CODE},
    ).mappings().first()

    if not programme:
        raise RuntimeError("Programme not found")

    details = programme["details"] or {}

    if isinstance(details, str):
        details = json.loads(details)

    entries = list(collect_text(details))

    chunks = []

    for entry in entries:
        chunks.extend(split_text(entry))

    if not chunks:
        raise RuntimeError("No questionnaire text found")

    print("Programme:", programme["official_name"])
    print("Knowledge chunks:", len(chunks))

    embeddings = model.encode(
        ["passage: " + chunk for chunk in chunks],
        normalize_embeddings=True,
        batch_size=16,
        show_progress_bar=True,
    )

    # Re-running ingestion replaces only this programme's
    # questionnaire chunks.
    connection.execute(
        text("""
            DELETE FROM public.knowledge_chunks
            WHERE programme_id = :programme_id
              AND source_type = 'questionnaire'
        """),
        {"programme_id": programme["id"]},
    )

    for chunk, embedding in zip(chunks, embeddings):
        vector_value = (
            "[" + ",".join(str(float(x)) for x in embedding) + "]"
        )

        connection.execute(
            text("""
                INSERT INTO public.knowledge_chunks (
                    programme_id,
                    source_type,
                    source_reference,
                    chunk_text,
                    embedding,
                    embedding_model
                )
                VALUES (
                    :programme_id,
                    'questionnaire',
                    :source_reference,
                    :chunk_text,
                    CAST(:embedding AS vector),
                    :embedding_model
                )
            """),
            {
                "programme_id": programme["id"],
                "source_reference": PROGRAMME_CODE,
                "chunk_text": chunk,
                "embedding": vector_value,
                "embedding_model": MODEL_NAME,
            },
        )

    print("Successfully stored embeddings in Supabase!")

engine.dispose()
