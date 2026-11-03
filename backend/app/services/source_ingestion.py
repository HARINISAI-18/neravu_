
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import fitz


def ingest_pdf(
    pdf_path: str,
    source_url: str,
    output_directory: str = "data/extracted",
) -> dict:
    path = Path(pdf_path)

    if not path.is_file():
        raise FileNotFoundError(path)

    if path.suffix.lower() != ".pdf":
        raise ValueError("Only PDF files are supported")

    if not source_url.startswith("https://"):
        raise ValueError("Official source URL must use HTTPS")

    raw_bytes = path.read_bytes()
    document_hash = hashlib.sha256(raw_bytes).hexdigest()

    pages = []

    with fitz.open(stream=raw_bytes, filetype="pdf") as doc:
        for page_number, page in enumerate(doc, start=1):
            text = page.get_text("text").strip()

            pages.append({
                "page": page_number,
                "text": text,
                "has_extractable_text": bool(text),
            })

    result = {
        "document_name": path.name,
        "source_url": source_url,
        "sha256": document_hash,
        "extracted_at": datetime.now(
            timezone.utc
        ).isoformat(),
        "page_count": len(pages),
        "pages": pages,
        "verification_status": "unverified",
    }

    output_path = Path(output_directory)
    output_path.mkdir(parents=True, exist_ok=True)

    destination = output_path / f"{document_hash}.json"

    destination.write_text(
        json.dumps(result, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return {
        "output_file": str(destination),
        "pages": len(pages),
        "pages_with_text": sum(
            page["has_extractable_text"] for page in pages
        ),
        "sha256": document_hash,
    }
