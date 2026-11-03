
import sys

from app.services.source_ingestion import ingest_pdf


if len(sys.argv) != 3:
    raise SystemExit(
        "Usage: python test_source_ingestion.py "
        "<pdf_path> <official_source_url>"
    )

result = ingest_pdf(
    pdf_path=sys.argv[1],
    source_url=sys.argv[2],
)

print("PDF extraction completed")
print("Pages:", result["pages"])
print("Pages with text:", result["pages_with_text"])
print("SHA256:", result["sha256"])
print("Saved:", result["output_file"])
