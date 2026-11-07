"""Index cancer insurance procedures and scheme details from Excel into supplemental_knowledge_chunks."""

import hashlib
import io
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

import httpx
import openpyxl
from sqlalchemy import text

from app.db.config import get_database_engine
from app.services.hybrid_rag import get_embedding_model

EMBEDDING_MODEL = "intfloat/multilingual-e5-small"
BUCKET_NAME = "neravu"
EXCEL_FILE = "cancer_insurances_with_12_stepwise_procedures.xlsx"


def _download_excel(bucket: str, object_path: str) -> bytes:
    supabase_url = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
    if not supabase_url or not service_key:
        raise RuntimeError("Supabase credentials missing.")

    encoded_bucket = quote(bucket, safe="")
    encoded_path = quote(object_path, safe="/")
    url = f"{supabase_url}/storage/v1/object/{encoded_bucket}/{encoded_path}"
    with httpx.Client(timeout=60.0) as client:
        response = client.get(
            url,
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
            },
        )
        response.raise_for_status()
        return response.content


def extract_chunks(raw_bytes: bytes) -> list[dict]:
    wb = openpyxl.load_workbook(io.BytesIO(raw_bytes), data_only=True)
    chunks = []
    page_counter = 1

    # 1. Parse Sheet1 (Scheme Overview, Benefits, Exclusions, Clinical Coverage)
    if "Sheet1" in wb.sheetnames:
        s1 = wb["Sheet1"]
        headers = [str(c).strip() if c is not None else "" for c in next(s1.iter_rows(values_only=True))]
        for row_idx, row in enumerate(s1.iter_rows(values_only=True), start=2):
            if row_idx == 2:  # Skip header row
                continue
            values = [str(c).strip() if c is not None else "" for c in row]
            if not any(values):
                continue
            name = values[0] if len(values) > 0 else ""
            if not name:
                continue

            row_dict = dict(zip(headers, values))
            source_url = row_dict.get("Link (to document/information)", "").split("\n")[0].strip()

            # Profile overview chunk
            overview_text = (
                f"Scheme/Programme: {name}\n"
                f"Type: {row_dict.get('Type (Central/State/NGO)', '')}\n"
                f"Location/State Covered: {row_dict.get('Location/State covered', '')}\n"
                f"Eligibility Criteria: {row_dict.get('Eligibility', '')}\n"
                f"Cancer Types Covered: {row_dict.get('Cancer types covered', '')}\n"
                f"Benefit Cover & Limits: {row_dict.get('Benefit cover', '')}\n"
                f"Official Links: {row_dict.get('Link (to document/information)', '')}"
            )
            chunks.append({
                "page_number": page_counter,
                "chunk_number": len(chunks),
                "source_url": source_url,
                "chunk_text": overview_text[:2500],
            })

            # Clinical & Exclusions chunk
            clinical_text = (
                f"Scheme/Programme: {name}\n"
                f"Radiation Oncology Covered: {row_dict.get('Is radiation oncology covered? ', '')}\n"
                f"Day-Care Chemotherapy Covered: {row_dict.get('Is day-care chemotherapy covered?', '')}\n"
                f"Pre/Post Hospitalization Days: {row_dict.get('Pre/post-hospitalization days officially 3 pre / 15 post', '')}\n"
                f"Official Exclusions List: {row_dict.get('What is official exclusion list (OPD, cosmetic, rehab + what else)?', '')}\n"
                f"Exceptions & Nuances: {row_dict.get('Exceptions', '')}"
            )
            chunks.append({
                "page_number": page_counter,
                "chunk_number": len(chunks),
                "source_url": source_url,
                "chunk_text": clinical_text[:2500],
            })
            page_counter += 1

    # 2. Parse Application Journey (12 Stepwise Procedures)
    if "Application Journey" in wb.sheetnames:
        aj = wb["Application Journey"]
        rows = list(aj.iter_rows(values_only=True))
        # Find header index
        header_row_idx = 0
        for idx, r in enumerate(rows):
            if any(str(c).startswith("Programme") for c in r if c is not None):
                header_row_idx = idx
                break

        aj_headers = [str(c).strip() if c is not None else "" for c in rows[header_row_idx]]
        programme_steps: dict[str, list[dict]] = {}

        for r in rows[header_row_idx + 1:]:
            if not any(r):
                continue
            r_dict = dict(zip(aj_headers, [str(c).strip() if c is not None else "" for c in r]))
            prog = r_dict.get("Programme", "")
            if not prog or "Step" in prog:
                continue
            programme_steps.setdefault(prog, []).append(r_dict)

        for prog, steps in programme_steps.items():
            # Create a chunk summarizing the multi-step application workflow
            step_lines = []
            for s in steps:
                step_no = s.get("Step No.", "")
                action = s.get("Step / Action", "")
                who = s.get("Who Does It", "")
                details = s.get("Detailed Procedure / Instructions", "") or s.get("What Happens / Outcome", "")
                step_lines.append(f"Step {step_no}: {action} (Responsible: {who}). {details}")

            # Group steps in batches of 4 for granular context
            for i in range(0, len(step_lines), 4):
                batch = step_lines[i:i + 4]
                procedure_text = (
                    f"Application Procedure for {prog}:\n"
                    + "\n".join(batch)
                )
                chunks.append({
                    "page_number": page_counter,
                    "chunk_number": len(chunks),
                    "source_url": "",
                    "chunk_text": procedure_text[:2500],
                })
            page_counter += 1

    # 3. Parse Patient Document Checklist
    if "Patient Document Checklist" in wb.sheetnames:
        dc = wb["Patient Document Checklist"]
        rows = list(dc.iter_rows(values_only=True))
        checklist_lines = []
        for r in rows:
            non_empty = [str(c).strip() for c in r if c is not None and str(c).strip()]
            if non_empty:
                checklist_lines.append(" | ".join(non_empty))

        # Chunk the checklist into pages of ~1500 chars
        current_chunk = []
        current_len = 0
        for line in checklist_lines:
            current_chunk.append(line)
            current_len += len(line)
            if current_len >= 1200:
                chunks.append({
                    "page_number": page_counter,
                    "chunk_number": len(chunks),
                    "source_url": "",
                    "chunk_text": "Patient Document Checklist & Verification Requirements:\n" + "\n".join(current_chunk),
                })
                current_chunk = []
                current_len = 0
                page_counter += 1
        if current_chunk:
            chunks.append({
                "page_number": page_counter,
                "chunk_number": len(chunks),
                "source_url": "",
                "chunk_text": "Patient Document Checklist & Verification Requirements:\n" + "\n".join(current_chunk),
            })
            page_counter += 1

    return chunks


def ingest_excel_procedures():
    print(f"Downloading {EXCEL_FILE} from bucket '{BUCKET_NAME}'...")
    raw_bytes = _download_excel(BUCKET_NAME, EXCEL_FILE)
    document_hash = hashlib.sha256(raw_bytes).hexdigest()

    print("Extracting procedure and scheme chunks...")
    chunks = extract_chunks(raw_bytes)
    print(f"Extracted {len(chunks)} chunks.")

    print(f"Generating embeddings using {EMBEDDING_MODEL}...")
    model = get_embedding_model()
    vectors = model.encode(
        ["passage: " + str(c["chunk_text"]) for c in chunks],
        normalize_embeddings=True,
        batch_size=16,
        show_progress_bar=False,
    )

    print("Saving to public.supplemental_knowledge_chunks...")
    engine = get_database_engine()
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM public.supplemental_knowledge_chunks WHERE document_name = :doc"),
            {"doc": EXCEL_FILE},
        )
        for chunk, vector in zip(chunks, vectors):
            vector_val = "[" + ",".join(str(float(v)) for v in vector) + "]"
            conn.execute(
                text("""
                    INSERT INTO public.supplemental_knowledge_chunks (
                        document_name, document_hash, page_number, chunk_number,
                        source_url, chunk_text, verification_status,
                        embedding, embedding_model
                    ) VALUES (
                        :document_name, :document_hash, :page_number, :chunk_number,
                        :source_url, :chunk_text, 'verified',
                        CAST(:embedding AS vector(384)), :embedding_model
                    )
                """),
                {
                    "document_name": EXCEL_FILE,
                    "document_hash": document_hash,
                    "page_number": chunk["page_number"],
                    "chunk_number": chunk["chunk_number"],
                    "source_url": chunk["source_url"],
                    "chunk_text": chunk["chunk_text"],
                    "embedding": vector_val,
                    "embedding_model": EMBEDDING_MODEL,
                },
            )

    print(f"Successfully ingested {len(chunks)} chunks from {EXCEL_FILE}!")


if __name__ == "__main__":
    ingest_excel_procedures()

