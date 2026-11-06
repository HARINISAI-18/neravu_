
from app.services.hybrid_rag import hybrid_retrieve
from app.services.llm_service import generate_answer, validate_cited_answer


def chat_with_neravu(question: str, language: str = "en"):
    from app.services.hybrid_rag import is_recommendation_request

    is_recommendation = is_recommendation_request(question)
    # Retrieve and rerank relevant knowledge chunks
    chunks = hybrid_retrieve(
        question=question,
        candidate_count=30,
        top_k=15 if is_recommendation else 5,
    )

    if not chunks:
        return {
            "answer": "No relevant information was found in the current knowledge base.",
            "language": language,
            "sources": [],
            "verification_status": "no_published_evidence",
            "disclaimer": "Please verify information with official sources.",
        }

    # Generate a grounded answer using Sarvam AI
    answer = generate_answer(
        question=question,
        language=language,
        chunks=chunks,
    )

    answer = validate_cited_answer(answer, chunks, question=question)
    if answer is None:
        return {
            "answer": "The retrieved evidence was not sufficient to produce a verifiable answer. Please consult the official source or contact the programme authority.",
            "language": language,
            "sources": [
                {
                    "source_reference": chunk.get("source_reference"),
                    "source_url": chunk.get("source_url"),
                    "source_locator": chunk.get("source_locator"),
                    "source_status": chunk.get("source_status"),
                }
                for chunk in chunks
            ],
            "verification_status": "insufficient_evidence",
            "disclaimer": "This service cannot determine official eligibility.",
        }

    has_unverified_evidence = any(
        "unverified" in str(chunk.get("source_status", "")).lower()
        or "unverified" in str(chunk.get("chunk_text", "")[:250]).lower()
        for chunk in chunks
    )
    return {
        "answer": answer,
        "language": language,
        "sources": [
            {
                "citation_number": index,
                "chunk_id": str(chunk.get("chunk_id", "")),
                "source_reference": chunk.get("source_reference"),
                "source_url": chunk.get("source_url"),
                "source_locator": chunk.get("source_locator"),
                "field_path": chunk.get("field_path"),
                "source_status": chunk.get("source_status"),
                "excerpt": chunk.get("chunk_text", "")[:500],
            }
            for index, chunk in enumerate(chunks, start=1)
        ],
        "verification_status": (
            "mixed_evidence_includes_unverified"
            if has_unverified_evidence
            else "published_evidence"
        ),
        "disclaimer": (
            "Some cited information comes from unverified directory, legacy, or user-provided "
            "documents. Confirm it with the linked official source before acting."
            if has_unverified_evidence
            else (
                "This answer is grounded in currently published, reviewed programme evidence. "
                "Confirm eligibility and current rules with the official issuing authority."
            )
        ),
    }
