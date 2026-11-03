
from app.services.hybrid_rag import hybrid_retrieve
from app.services.llm_service import generate_answer


def chat_with_neravu(question: str, language: str = "en"):
    # Retrieve and rerank relevant knowledge chunks
    chunks = hybrid_retrieve(
        question=question,
        candidate_count=15,
        top_k=5,
    )

    if not chunks:
        return {
            "answer": "No relevant information was found in the current knowledge base.",
            "language": language,
            "sources": [],
            "verification_status": "unverified",
            "disclaimer": "Please verify information with official sources.",
        }

    # Generate a grounded answer using Sarvam AI
    answer = generate_answer(
        question=question,
        language=language,
        chunks=chunks,
    )

    return {
        "answer": answer,
        "language": language,
        "sources": [
            {
                "chunk_id": str(chunk.get("chunk_id", "")),
                "source_reference": chunk.get("source_reference"),
                "excerpt": chunk.get("chunk_text", "")[:500],
            }
            for chunk in chunks
        ],
        "verification_status": "unverified",
        "disclaimer": (
            "This information is based on draft programme data. "
            "Eligibility and benefits must be verified using official sources."
        ),
    }
