"""Index a PDF stored in a Supabase Storage bucket for chat retrieval."""

import argparse
import hashlib
import os
import sys
from pathlib import Path
from urllib.parse import quote

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = Path(__file__).resolve().parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_ROOT / ".env")

import fitz
import httpx
from sqlalchemy import text

from app.db.config import get_database_engine
from app.services.hybrid_rag import get_embedding_model

MAX_PDF_BYTES = 25 * 1024 * 1024
MAX_CHUNK_CHARS = 1000
CHUNK_OVERLAP_CHARS = 120
EMBEDDING_MODEL = "intfloat/multilingual-e5-small"


def _chunks_for_page(page_text: str) -> list[str]:
    text_value = " ".join(page_text.split())
    chunks = []
    start = 0
    while start < len(text_value):
        end = min(start + MAX_CHUNK_CHARS, len(text_value))
        if end < len(text_value):
            boundary = text_value.rfind(" ", start, end)
            if boundary > start:
                end = boundary
        chunks.append(text_value[start:end].strip())
        if end == len(text_value):
            break
        start = max(start + 1, end - CHUNK_OVERLAP_CHARS)
    return [chunk for chunk in chunks if chunk]


def _download_pdf(bucket: str, object_path: str) -> bytes:
    supabase_url = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
    if not supabase_url or not service_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured "
            "in the backend environment to read the private Storage object."
        )

    encoded_bucket = quote(bucket, safe="")
    encoded_path = quote(object_path, safe="/")
    with httpx.stream(
        "GET",
        f"{supabase_url}/storage/v1/object/{encoded_bucket}/{encoded_path}",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        },
        timeout=60.0,
    ) as response:
        response.raise_for_status()
        content = bytearray()
        for part in response.iter_bytes():
            content.extend(part)
            if len(content) > MAX_PDF_BYTES:
                raise ValueError(
                    f"PDF exceeds the {MAX_PDF_BYTES // (1024 * 1024)} MB size limit."
                )
    raw_bytes = bytes(content)
    if not raw_bytes.startswith(b"%PDF-"):
        raise ValueError("The Storage object is not a valid PDF file.")
    return raw_bytes


def ingest_storage_pdf(bucket: str, object_path: str) -> dict[str, int | str]:
    if not object_path.lower().endswith(".pdf"):
        raise ValueError("The Storage object path must end with .pdf.")

    raw_bytes = _download_pdf(bucket, object_path)
    document_hash = hashlib.sha256(raw_bytes).hexdigest()
    document_name = Path(object_path).name
    pages: list[dict[str, int | str]] = []

    with fitz.open(stream=raw_bytes, filetype="pdf") as document:
        for page_number, page in enumerate(document, start=1):
            for chunk_number, chunk_text in enumerate(_chunks_for_page(page.get_text("text"))):
                pages.append({
                    "page_number": page_number,
                    "chunk_number": chunk_number,
                    "chunk_text": chunk_text,
                })

    if not pages:
        raise ValueError(
            "No extractable text was found in the PDF. Scanned PDFs require OCR "
            "before they can be indexed."
        )

    model = get_embedding_model()
    vectors = model.encode(
        ["passage: " + str(chunk["chunk_text"]) for chunk in pages],
        normalize_embeddings=True,
        batch_size=16,
        show_progress_bar=False,
    )
    if len(vectors) != len(pages):
        raise RuntimeError("The embedding model returned an incomplete PDF index.")

    engine = get_database_engine()
    with engine.begin() as connection:
        connection.execute(
            text("""
                DELETE FROM public.supplemental_knowledge_chunks
                WHERE document_name = :document_name
            """),
            {"document_name": document_name},
        )
        for chunk, vector in zip(pages, vectors):
            vector_value = "[" + ",".join(str(float(value)) for value in vector) + "]"
            connection.execute(
                text("""
                    INSERT INTO public.supplemental_knowledge_chunks (
                        document_name, document_hash, page_number, chunk_number,
                        chunk_text, verification_status, embedding, embedding_model
                    ) VALUES (
                        :document_name, :document_hash, :page_number, :chunk_number,
                        :chunk_text, 'unverified', CAST(:embedding AS vector(384)),
                        :embedding_model
                    )
                """),
                {
                    "document_name": document_name,
                    "document_hash": document_hash,
                    **chunk,
                    "embedding": vector_value,
                    "embedding_model": EMBEDDING_MODEL,
                },
            )

    return {
        "document_name": document_name,
        "pages": len({chunk["page_number"] for chunk in pages}),
        "chunks": len(pages),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", default="neravu")
    parser.add_argument(
        "--object",
        default="Neravu_Scheme_Knowledge_and_Application_Guide.docx.pdf",
    )
    args = parser.parse_args()
    result = ingest_storage_pdf(args.bucket, args.object)
    print(
        f"Indexed {result['document_name']}: "
        f"{result['pages']} pages, {result['chunks']} chunks"
    )


if __name__ == "__main__":
    main()
