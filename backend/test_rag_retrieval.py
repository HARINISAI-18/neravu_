
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sentence_transformers import SentenceTransformer

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

database_url = os.getenv("SUPABASE_DATABASE_URL")

if not database_url:
    raise RuntimeError("SUPABASE_DATABASE_URL missing")

host = (make_url(database_url).host or "").lower()

if not host.endswith(".supabase.com"):
    raise RuntimeError("Expected Supabase database host")

model = SentenceTransformer(
    "intfloat/multilingual-e5-small"
)

engine = create_engine(
    database_url,
    pool_pre_ping=True,
)

question = "What financial assistance does PM-JAY provide for cancer treatment?"

query_embedding = model.encode(
    "query: " + question,
    normalize_embeddings=True,
)

vector_value = (
    "[" +
    ",".join(str(float(x)) for x in query_embedding) +
    "]"
)

with engine.connect() as connection:
    results = connection.execute(
        text("""
            SELECT *
            FROM public.search_knowledge(
                CAST(:embedding AS vector(384)),
                :match_count
            )
        """),
        {
            "embedding": vector_value,
            "match_count": 5,
        },
    ).mappings().all()

    print("\nQUESTION:", question)
    print("MATCHES:", len(results))

    for index, result in enumerate(results, start=1):
        print(f"\n--- Match {index} ---")
        print("Similarity:", round(result["similarity"], 4))
        print("Source:", result["source_reference"])
        print("Text:", result["chunk_text"][:600])

engine.dispose()
