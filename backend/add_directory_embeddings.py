"""Add vector embeddings to government_schemes_directory and ngo_directory for semantic retrieval."""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = Path(__file__).resolve().parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_ROOT / ".env")

from sqlalchemy import text
from app.db.config import get_database_engine
from app.services.hybrid_rag import get_embedding_model


def update_directory_embeddings():
    engine = get_database_engine()
    model = get_embedding_model()

    print("Adding embedding columns if not present...")
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE public.government_schemes_directory ADD COLUMN IF NOT EXISTS embedding vector(384);"))
        conn.execute(text("ALTER TABLE public.ngo_directory ADD COLUMN IF NOT EXISTS embedding vector(384);"))

    print("Embedding government_schemes_directory rows...")
    with engine.connect() as conn:
        schemes = conn.execute(text("""
            SELECT id, scheme_name, government_level, state_coverage,
                   benefit_type, published_benefit_limit, cancer_covered,
                   eligibility_summary, documents_required, application_route
            FROM public.government_schemes_directory
        """)).mappings().all()

    if schemes:
        texts = [
            f"passage: Government Scheme: {s['scheme_name']}. Level: {s['government_level']}. "
            f"Coverage: {s['state_coverage']}. Benefit: {s['benefit_type']} ({s['published_benefit_limit']}). "
            f"Cancer covered: {s['cancer_covered']}. Eligibility: {s['eligibility_summary']}. "
            f"Documents required: {s['documents_required']}. Application route: {s['application_route']}."
            for s in schemes
        ]
        vectors = model.encode(texts, normalize_embeddings=True, batch_size=16, show_progress_bar=False)
        with engine.begin() as conn:
            for s, vec in zip(schemes, vectors):
                vec_str = "[" + ",".join(str(float(v)) for v in vec) + "]"
                conn.execute(
                    text("UPDATE public.government_schemes_directory SET embedding = CAST(:vec AS vector(384)) WHERE id = :id"),
                    {"vec": vec_str, "id": s["id"]},
                )
        print(f"Updated {len(schemes)} government scheme embeddings.")

    print("Embedding ngo_directory rows...")
    with engine.connect() as conn:
        ngos = conn.execute(text("""
            SELECT id, organization_name, organization_type, state_coverage,
                   city_district, support_type, what_support_offered,
                   direct_financial_aid, aid_amount_limit, eligibility,
                   hospital_restrictions, application_route
            FROM public.ngo_directory
        """)).mappings().all()

    if ngos:
        texts = [
            f"passage: Organization: {n['organization_name']}. Type: {n['organization_type']}. "
            f"State/City: {n['state_coverage']}, {n['city_district']}. Support: {n['support_type']} - {n['what_support_offered']}. "
            f"Financial aid: {n['direct_financial_aid']} ({n['aid_amount_limit']}). "
            f"Eligibility: {n['eligibility']}. Hospitals: {n['hospital_restrictions']}."
            for n in ngos
        ]
        vectors = model.encode(texts, normalize_embeddings=True, batch_size=16, show_progress_bar=False)
        with engine.begin() as conn:
            for n, vec in zip(ngos, vectors):
                vec_str = "[" + ",".join(str(float(v)) for v in vec) + "]"
                conn.execute(
                    text("UPDATE public.ngo_directory SET embedding = CAST(:vec AS vector(384)) WHERE id = :id"),
                    {"vec": vec_str, "id": n["id"]},
                )
        print(f"Updated {len(ngos)} NGO directory embeddings.")

    print("All directory embeddings successfully updated!")


if __name__ == "__main__":
    update_directory_embeddings()

