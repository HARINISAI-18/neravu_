import json
import os
from pathlib import Path

if os.getenv("HF_HUB_OFFLINE") == "1":
    os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

import re
from functools import lru_cache

from sqlalchemy import text
from sentence_transformers import SentenceTransformer

from app.db.config import get_database_engine

EMBEDDING_MODEL = "intfloat/multilingual-e5-small"
RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"
RECOMMENDATION_PATTERN = re.compile(
    r"\b(recommend|recommendation|suggest|suggestion|options|what help is available|"
    r"which scheme|which schemes|what schemes|schemes available|scheme options|"
    r"list schemes|which ngo|which ngos|ngo options)\b|"
    r"सुझाव|सुझाएं|कौन सी योजना|సూచించండి|సిఫార్సు|ఏ పథకం",
    re.IGNORECASE,
)
HOSPITAL_QUERY_PATTERN = re.compile(
    r"\b(hospitals?|hospital list|empanelled|empaneled|network hospitals?|"
    r"provider network|treat(?:ment)? at which|where can .* (?:treatment|treated))\b|"
    r"ఆసుపత్రి|ఆసుపత్రుల|హాస్పిటల్|చికిత్స ఎక్కడ",
    re.IGNORECASE,
)
HOSPITAL_PROGRAMME_ALIASES = {
    "ics-cancer-cure": ("ics cancer cure", "indian cancer society", "cancer cure fund"),
    "cuddles-foundation": ("cuddles",),
    "cankids": ("cankids", "can kids"),
    "st-jude": ("st jude",),
    "pmjay": ("pm jay", "pmjay", "ayushman bharat"),
    "ntr-vaidya-seva": ("ntr vaidya seva", "aarogyasri"),
    "hmcpf": ("hmcpf", "rashtriya arogya nidhi"),
    "tata-trusts": ("tata trusts", "tata trust"),
    "cpaa": ("cpaa", "cancer patients aid association"),
    "cansupport": ("cansupport",),
    "pallium-india": ("pallium",),
    "dhanvantari-cancer-foundation": ("dhanvantari",),
    "bengal-cancer-foundation": ("bengal cancer foundation",),
    "kdfcc": ("kdfcc", "kalpana datta"),
    "garia-welfare-society": ("garia welfare society",),
    "hitaishini": ("hitaishini",),
    "kamlesh-cancer-foundation": ("kamlesh cancer foundation",),
    "ganga-prem-hospice": ("ganga prem",),
    "can-protect-foundation": ("can protect",),
    "him-samvad": ("him samvad",),
}


def is_hospital_request(question: str) -> bool:
    return bool(HOSPITAL_QUERY_PATTERN.search(question))


@lru_cache(maxsize=1)
def _hospital_research():
    path = Path(__file__).resolve().parents[1] / "data" / "hospitalResearch.json"
    with path.open(encoding="utf-8") as source:
        return json.load(source)


def _retrieve_hospital_research(question: str) -> list[dict]:
    data = _hospital_research()
    normalized_question = re.sub(r"[^a-z0-9]+", " ", question.casefold()).strip()
    question_words = set(normalized_question.split())
    matched_programmes = {
        key
        for key, aliases in HOSPITAL_PROGRAMME_ALIASES.items()
        if any(alias in normalized_question for alias in aliases)
    }

    mappings = []
    for record in data.get("hospitalMappings", []):
        matching_keys = set(record.get("programmeKeys", [])) & matched_programmes
        if matched_programmes:
            if not matching_keys:
                continue
        else:
            searchable = " ".join(
                str(record.get(key, ""))
                for key in ("hospitalOrNetwork", "cityState", "programme")
            ).casefold()
            searchable_words = set(re.sub(r"[^a-z0-9]+", " ", searchable).split())
            if len(question_words & searchable_words) == 0:
                continue
            matching_keys = set(record.get("programmeKeys", []))
        mappings.append((record, matching_keys))

    results = []
    for record, _matching_keys in mappings:
        source_reference = record.get("programme") or "Hospital access research"
        results.append({
            "chunk_id": f"hospital-map-{record['sourceRow']}",
            "source_reference": source_reference,
            "source_url": record.get("primarySourceUrl", ""),
            "source_locator": f"{record.get('sourceSheet', 'Hospital Mapping')} row {record['sourceRow']}",
            "field_path": "hospital_research",
            "source_status": "Unverified research workbook; confirm current hospital participation",
            "chunk_text": "\n".join(
                f"{label}: {record[key]}"
                for key, label in (
                    ("hospitalOrNetwork", "Hospital or network"),
                    ("cityState", "City and state"),
                    ("relationshipEvidence", "Relationship evidence"),
                    ("assistanceType", "Assistance type"),
                    ("eligibilityConditions", "Patient eligibility and conditions"),
                    ("hospitalAccessSteps", "How the hospital facilitates access"),
                    ("evidenceConfidence", "Evidence confidence"),
                    ("caveat", "Important caveat and next verification"),
                )
                if record.get(key)
            ),
            "rrf_score": 1.0,
            "rerank_score": 1.0,
        })

    for rule in data.get("programmeRules", []):
        if matched_programmes and not (set(rule.get("programmeKeys", [])) & matched_programmes):
            continue
        results.append({
            "chunk_id": f"hospital-rule-{rule['sourceRow']}",
            "source_reference": rule.get("programme") or "Programme hospital access rule",
            "source_url": rule.get("officialSource", ""),
            "source_locator": f"{rule.get('sourceSheet', 'Programme Rules')} row {rule['sourceRow']}",
            "field_path": "hospital_research",
            "source_status": "Unverified research workbook; confirm current hospital participation",
            "chunk_text": "\n".join(
                f"{label}: {rule[key]}"
                for key, label in (
                    ("programmeType", "Programme type"),
                    ("publishedBenefit", "Published benefit"),
                    ("hospitalAccessRule", "Hospital access rule"),
                    ("whoHelpsApply", "Who helps the patient apply"),
                    ("criticalCaution", "Critical caution"),
                )
                if rule.get(key)
            ),
            "rrf_score": 0.9,
            "rerank_score": 0.9,
        })
    return results


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


def is_recommendation_request(question: str) -> bool:
    return bool(RECOMMENDATION_PATTERN.search(question))


def _directory_chunk(
    *,
    record_id: object,
    source_reference: str,
    source_url: str | None,
    source_status: str | None,
    field_path: str,
    fields: list[tuple[str, object]],
    rrf_score: float = 0.0,
) -> dict:
    values = [
        f"{label}: {str(value).strip()}"
        for label, value in fields
        if value is not None and str(value).strip()
    ]
    status = str(source_status or "Unverified").strip()
    status_is_verified = (
        ("verified" in status.lower() and "unverified" not in status.lower())
        or "approved" in status.lower()
    )
    display_status = (
        status
        if status_is_verified or "unverified" in status.lower()
        else f"Unverified ({status})"
    )
    text_value = (
        f"Directory record status: {display_status}\n"
        f"Source: {source_reference}\n"
        + "\n".join(values)
    )
    return {
        "chunk_id": str(record_id),
        "source_reference": source_reference,
        "source_url": source_url or "",
        "source_locator": f"{field_path} record {record_id}",
        "field_path": field_path,
        "chunk_text": text_value,
        "source_status": display_status,
        "rrf_score": float(rrf_score),
        "rerank_score": float(rrf_score),
    }


def _retrieve_directory_records(
    connection,
    question: str,
    recommendations: bool,
    embedding: str | None = None,
) -> list[dict]:
    records: list[dict] = []
    limit = 20 if recommendations else 8

    # 1. Government Schemes Directory
    scheme_rows = []
    if embedding and not recommendations:
        try:
            scheme_rows = connection.execute(
                text("""
                    WITH vector_ranked AS (
                        SELECT id, row_number() OVER (ORDER BY embedding <=> CAST(:embedding AS vector(384))) AS v_rank
                        FROM public.government_schemes_directory
                        WHERE embedding IS NOT NULL
                        ORDER BY embedding <=> CAST(:embedding AS vector(384))
                        LIMIT :limit
                    ), lexical_ranked AS (
                        SELECT id, row_number() OVER (
                            ORDER BY ts_rank_cd(
                                to_tsvector('simple', concat_ws(' ', scheme_name, government_level, state_coverage, benefit_type, published_benefit_limit, cancer_covered, eligibility_summary, documents_required, application_route, official_link, helpline_contact, verification_status, source_notes)),
                                plainto_tsquery('simple', :question)
                            ) DESC
                        ) AS l_rank
                        FROM public.government_schemes_directory
                        WHERE to_tsvector('simple', concat_ws(' ', scheme_name, government_level, state_coverage, benefit_type, published_benefit_limit, cancer_covered, eligibility_summary, documents_required, application_route, official_link, helpline_contact, verification_status, source_notes)) @@ plainto_tsquery('simple', :question)
                        LIMIT :limit
                    ), candidate_ids AS (
                        SELECT id, v_rank, NULL::bigint AS l_rank FROM vector_ranked
                        UNION ALL
                        SELECT id, NULL::bigint AS v_rank, l_rank FROM lexical_ranked
                    ), scored AS (
                        SELECT id,
                               SUM(COALESCE(1.0 / (60 + v_rank), 0) + COALESCE(1.0 / (60 + l_rank), 0)) AS rrf_score
                        FROM candidate_ids
                        GROUP BY id
                    )
                    SELECT g.*, s.rrf_score
                    FROM scored s
                    JOIN public.government_schemes_directory g ON g.id = s.id
                    ORDER BY s.rrf_score DESC
                    LIMIT :limit
                """),
                {"embedding": embedding, "question": question, "limit": limit},
            ).mappings().all()
        except Exception:
            scheme_rows = []

    if not scheme_rows:
        search_condition = (
            ""
            if recommendations
            else """
                WHERE to_tsvector('simple', searchable_text)
                      @@ plainto_tsquery('simple', :question)
            """
        )
        scheme_order_condition = (
            "ORDER BY scheme_name"
            if recommendations
            else """
                ORDER BY ts_rank_cd(
                    to_tsvector('simple', searchable_text),
                    plainto_tsquery('simple', :question)
                ) DESC, scheme_name
            """
        )
        scheme_rows = connection.execute(
            text(f"""
                WITH records AS (
                  SELECT id, scheme_name, government_level, state_coverage,
                       benefit_type, published_benefit_limit, cancer_covered,
                       eligibility_summary, documents_required, application_route,
                       official_link, helpline_contact, verification_status,
                       last_checked, source_notes,
                       concat_ws(' ', scheme_name, government_level, state_coverage,
                           benefit_type, published_benefit_limit, cancer_covered,
                           eligibility_summary, documents_required, application_route,
                           official_link, helpline_contact, verification_status,
                           source_notes) AS searchable_text
                  FROM public.government_schemes_directory
                )
                SELECT *, 0.0 AS rrf_score FROM records
                {search_condition}
                {scheme_order_condition}
                LIMIT :record_limit
            """),
            {"question": question, "record_limit": limit},
        ).mappings().all()

    for row in scheme_rows:
        records.append(_directory_chunk(
            record_id=row["id"],
            source_reference=row["scheme_name"],
            source_url=row["official_link"],
            source_status=row["verification_status"],
            field_path="government_schemes_directory",
            rrf_score=float(row.get("rrf_score") or 0.0),
            fields=[
                ("Government level", row["government_level"]),
                ("State coverage", row["state_coverage"]),
                ("Benefit type", row["benefit_type"]),
                ("Published benefit limit", row["published_benefit_limit"]),
                ("Cancer covered", row["cancer_covered"]),
                ("Eligibility summary", row["eligibility_summary"]),
                ("Documents required", row["documents_required"]),
                ("Application route", row["application_route"]),
                ("Helpline", row["helpline_contact"]),
                ("Last checked", row["last_checked"]),
                ("Source notes", row["source_notes"]),
            ],
        ))

    # 2. NGO Directory
    ngo_rows = []
    if embedding and not recommendations:
        try:
            ngo_rows = connection.execute(
                text("""
                    WITH vector_ranked AS (
                        SELECT id, row_number() OVER (ORDER BY embedding <=> CAST(:embedding AS vector(384))) AS v_rank
                        FROM public.ngo_directory
                        WHERE embedding IS NOT NULL
                        ORDER BY embedding <=> CAST(:embedding AS vector(384))
                        LIMIT :limit
                    ), lexical_ranked AS (
                        SELECT id, row_number() OVER (
                            ORDER BY ts_rank_cd(
                                to_tsvector('simple', concat_ws(' ', organization_name, organization_type, state_coverage, city_district, support_type, what_support_offered, direct_financial_aid, aid_amount_limit, eligibility, hospital_restrictions, address, application_route, verification_status, source_notes)),
                                plainto_tsquery('simple', :question)
                            ) DESC
                        ) AS l_rank
                        FROM public.ngo_directory
                        WHERE to_tsvector('simple', concat_ws(' ', organization_name, organization_type, state_coverage, city_district, support_type, what_support_offered, direct_financial_aid, aid_amount_limit, eligibility, hospital_restrictions, address, application_route, verification_status, source_notes)) @@ plainto_tsquery('simple', :question)
                        LIMIT :limit
                    ), candidate_ids AS (
                        SELECT id, v_rank, NULL::bigint AS l_rank FROM vector_ranked
                        UNION ALL
                        SELECT id, NULL::bigint AS v_rank, l_rank FROM lexical_ranked
                    ), scored AS (
                        SELECT id,
                               SUM(COALESCE(1.0 / (60 + v_rank), 0) + COALESCE(1.0 / (60 + l_rank), 0)) AS rrf_score
                        FROM candidate_ids
                        GROUP BY id
                    )
                    SELECT n.*, s.rrf_score
                    FROM scored s
                    JOIN public.ngo_directory n ON n.id = s.id
                    ORDER BY s.rrf_score DESC
                    LIMIT :limit
                """),
                {"embedding": embedding, "question": question, "limit": limit},
            ).mappings().all()
        except Exception:
            ngo_rows = []

    if not ngo_rows:
        search_cond = (
            ""
            if recommendations
            else """
                WHERE to_tsvector('simple', searchable_text)
                      @@ plainto_tsquery('simple', :question)
            """
        )
        ngo_order = (
            "ORDER BY organization_name"
            if recommendations
            else """
                ORDER BY ts_rank_cd(
                    to_tsvector('simple', searchable_text),
                    plainto_tsquery('simple', :question)
                ) DESC, organization_name
            """
        )
        ngo_rows = connection.execute(
            text(f"""
                WITH records AS (
                  SELECT id, organization_name, organization_type, state_coverage,
                       city_district, support_type, what_support_offered,
                       direct_financial_aid, aid_amount_limit, eligibility,
                       hospital_restrictions, contact_phone, contact_email,
                       address, website_url, application_route,
                       verification_status, last_checked, source_notes,
                       concat_ws(' ', organization_name, organization_type,
                           state_coverage, city_district, support_type,
                           what_support_offered, direct_financial_aid,
                           aid_amount_limit, eligibility, hospital_restrictions,
                           address, application_route, verification_status,
                           source_notes) AS searchable_text
                  FROM public.ngo_directory
                )
                SELECT *, 0.0 AS rrf_score FROM records
                {search_cond}
                {ngo_order}
                LIMIT :record_limit
            """),
            {"question": question, "record_limit": limit},
        ).mappings().all()

    for row in ngo_rows:
        records.append(_directory_chunk(
            record_id=row["id"],
            source_reference=row["organization_name"],
            source_url=row["website_url"],
            source_status=row["verification_status"],
            field_path="ngo_directory",
            rrf_score=float(row.get("rrf_score") or 0.0),
            fields=[
                ("Organization type", row["organization_type"]),
                ("State coverage", row["state_coverage"]),
                ("City or district", row["city_district"]),
                ("Support type", row["support_type"]),
                ("Support offered", row["what_support_offered"]),
                ("Direct financial aid", row["direct_financial_aid"]),
                ("Aid amount limit", row["aid_amount_limit"]),
                ("Eligibility", row["eligibility"]),
                ("Hospital restrictions", row["hospital_restrictions"]),
                ("Application route", row["application_route"]),
                ("Contact phone", row["contact_phone"]),
                ("Contact email", row["contact_email"]),
                ("Address", row["address"]),
                ("Last checked", row["last_checked"]),
                ("Source notes", row["source_notes"]),
            ],
        ))

    state_rows = connection.execute(
        text(f"""
            WITH records AS (
              SELECT id, state_name, local_ngo_records,
                   known_national_ngo_coverage, state_government_scheme_lead,
                   research_completeness,
                   concat_ws(' ', state_name, local_ngo_records,
                       known_national_ngo_coverage, state_government_scheme_lead,
                       research_completeness) AS searchable_text
              FROM public.state_research_tracker
            )
            SELECT * FROM records
            WHERE to_tsvector('simple', searchable_text)
                  @@ plainto_tsquery('simple', :question)
            ORDER BY state_name
            LIMIT :record_limit
        """),
        {"question": question, "record_limit": 10 if recommendations else 5},
    ).mappings().all()
    for row in state_rows:
        records.append(_directory_chunk(
            record_id=row["id"],
            source_reference=f"State support research: {row['state_name']}",
            source_url=None,
            source_status=row["research_completeness"] or "Unverified research",
            field_path="state_research_tracker",
            fields=[
                ("Local NGO records", row["local_ngo_records"]),
                ("National NGO coverage", row["known_national_ngo_coverage"]),
                ("State government scheme lead", row["state_government_scheme_lead"]),
                ("Research completeness", row["research_completeness"]),
            ],
        ))

    if not recommendations:
        source_rows = connection.execute(
            text("""
                SELECT id, source_publisher, source_type, url,
                       what_it_supports, checked_date, notes
                FROM public.source_registry
                WHERE to_tsvector(
                    'simple',
                    concat_ws(' ', source_publisher, source_type, url,
                              what_it_supports, notes)
                ) @@ plainto_tsquery('simple', :question)
                ORDER BY checked_date DESC NULLS LAST
                LIMIT 5
            """),
            {"question": question},
        ).mappings().all()
        for row in source_rows:
            records.append(_directory_chunk(
                record_id=row["id"],
                source_reference=row["source_publisher"],
                source_url=row["url"],
                source_status=f"Source register; checked {row['checked_date'] or 'date unknown'}",
                field_path="source_registry",
                fields=[
                    ("Source type", row["source_type"]),
                    ("Supports", row["what_it_supports"]),
                    ("Notes", row["notes"]),
                ],
            ))

    return records


def _retrieve_document_chunks(connection, embedding: str, question: str, limit: int) -> list[dict]:
    try:
        rows = connection.execute(
            text("""
                WITH vector_ranked AS (
                    SELECT id, row_number() OVER (ORDER BY embedding <=> CAST(:embedding AS vector(384))) AS rank
                    FROM public.supplemental_knowledge_chunks
                    ORDER BY embedding <=> CAST(:embedding AS vector(384))
                    LIMIT :limit
                ), lexical_ranked AS (
                    SELECT id, row_number() OVER (
                        ORDER BY ts_rank_cd(search_vector, plainto_tsquery('simple', :question)) DESC
                    ) AS rank
                    FROM public.supplemental_knowledge_chunks
                    WHERE search_vector @@ plainto_tsquery('simple', :question)
                    ORDER BY ts_rank_cd(search_vector, plainto_tsquery('simple', :question)) DESC
                    LIMIT :limit
                ), candidate_ids AS (
                    SELECT id FROM vector_ranked
                    UNION
                    SELECT id FROM lexical_ranked
                )
                SELECT d.id AS chunk_id, d.document_name,
                       d.source_url, d.page_number, d.chunk_text,
                       d.verification_status,
                       COALESCE(1.0 / (60 + v.rank), 0)
                         + COALESCE(1.0 / (60 + l.rank), 0) AS rrf_score
                FROM candidate_ids c
                JOIN public.supplemental_knowledge_chunks d ON d.id = c.id
                LEFT JOIN vector_ranked v ON v.id = d.id
                LEFT JOIN lexical_ranked l ON l.id = d.id
                ORDER BY rrf_score DESC
                LIMIT :limit
            """),
            {"embedding": embedding, "question": question, "limit": limit},
        ).mappings().all()
    except Exception:
        return []
    return [
        {
            "chunk_id": str(row["chunk_id"]),
            "source_reference": row["document_name"],
            "source_url": row["source_url"] or "",
            "source_locator": f"Page {row['page_number']}",
            "field_path": "supplemental_pdf",
            "source_status": row["verification_status"],
            "chunk_text": (
                f"Document verification status: {row['verification_status']}\n"
                f"Document: {row['document_name']}\n"
                f"Page: {row['page_number']}\n{row['chunk_text']}"
            ),
            "rrf_score": float(row["rrf_score"]),
            "rerank_score": float(row["rrf_score"]),
        }
        for row in rows
    ]


def _retrieve_legacy_knowledge(connection, embedding: str, limit: int) -> list[dict]:
    available = connection.execute(
        text("SELECT to_regprocedure('public.search_knowledge(vector,integer)') IS NOT NULL")
    ).scalar_one()
    if not available:
        return []

    rows = connection.execute(
        text("""
            SELECT *
            FROM public.search_knowledge(
                CAST(:embedding AS vector(384)),
                :match_count
            )
        """),
        {"embedding": embedding, "match_count": limit},
    ).mappings().all()
    results = []
    for rank, row in enumerate(rows, start=1):
        item = dict(row)
        similarity = float(item.pop("similarity", 0.0) or 0.0)
        item["chunk_id"] = str(item.get("id") or f"legacy-{rank}")
        item["source_reference"] = item.get("source_reference") or "Legacy knowledge chunk"
        item["source_url"] = item.get("source_url") or ""
        item["source_locator"] = item.get("source_locator") or "knowledge_chunks"
        item["field_path"] = "knowledge_chunks"
        item["source_status"] = "Unverified legacy knowledge"
        item["chunk_text"] = (
            "Source status: Unverified legacy knowledge.\n"
            + str(item.get("chunk_text") or "")
        )
        item["rrf_score"] = similarity
        item["rerank_score"] = similarity
        results.append(item)
    return results


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

    try:
        embedding = get_embedding_model().encode(
            "query: " + question,
            normalize_embeddings=True,
        )
    except Exception as exc:
        logger.warning(f"Embedding model unavailable, falling back to zero vector: {exc}")
        embedding = [0.0] * 384

    vector_value = (
        "[" +
        ",".join(str(float(x)) for x in embedding) +
        "]"
    )
    recommendations = is_recommendation_request(question)

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
        supplemental = _retrieve_document_chunks(
            connection,
            vector_value,
            question,
            min(candidate_count, 10),
        )
        legacy = _retrieve_legacy_knowledge(
            connection,
            vector_value,
            min(candidate_count, 10),
        )
        directory = _retrieve_directory_records(
            connection,
            question,
            recommendations,
            embedding=vector_value,
        )

    candidates = [dict(row) for row in rows] + supplemental + legacy + directory
    hospital_research = _retrieve_hospital_research(question) if is_hospital_request(question) else []
    candidates.extend(hospital_research)
    if not candidates:
        return []

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
            ranked = candidates
        except Exception:
            ranked = candidates
    else:
        ranked = candidates

    for item in ranked:
        item.setdefault("rerank_score", float(item.get("rrf_score", 0.0)))
    ranked.sort(key=lambda item: item["rerank_score"], reverse=True)

    if recommendations:
        # Recommendations need a comparison set, not just the single best-scoring programme.
        selected = [
            item
            for item in ranked
            if item.get("field_path") in {
                "government_schemes_directory",
                "ngo_directory",
            }
        ]
        selected.extend(
            item
            for item in ranked
            if item.get("field_path") not in {
                "government_schemes_directory",
                "ngo_directory",
            }
        )
        return selected[:30]

    if is_hospital_request(question):
        selected = [
            item for item in ranked
            if item.get("field_path") == "hospital_research"
        ]
        selected_ids = {item.get("chunk_id") for item in selected}
        for item in ranked:
            if item.get("chunk_id") not in selected_ids:
                selected.append(item)
                selected_ids.add(item.get("chunk_id"))
            if len(selected) >= top_k:
                break
        return selected[:top_k]

    selected = []
    selected_ids = set()
    for category in (
        "government_schemes_directory",
        "ngo_directory",
        "state_research_tracker",
        "supplemental_pdf",
        "source_registry",
    ):
        match = next(
            (item for item in ranked if item.get("field_path") == category),
            None,
        )
        if match is not None:
            selected.append(match)
            selected_ids.add(match.get("chunk_id"))
    for item in ranked:
        if item.get("chunk_id") not in selected_ids:
            selected.append(item)
            selected_ids.add(item.get("chunk_id"))
        if len(selected) >= top_k:
            break
    return selected[:top_k]
