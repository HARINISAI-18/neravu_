
from app.services.hybrid_rag import hybrid_retrieve

questions = [
    "What cancer treatment expenses does PM-JAY cover?",
    "Can a person aged 72 receive PM-JAY benefits?",
    "PM-JAY ద్వారా క్యాన్సర్ చికిత్సకు సహాయం లభిస్తుందా?",
    "पीएम-जय में कैंसर के इलाज के लिए क्या सहायता मिलती है?",
]

for question in questions:
    print("\n" + "=" * 60)
    print("QUESTION:", question)

    results = hybrid_retrieve(
        question=question,
        candidate_count=15,
        top_k=5,
    )

    print("RESULTS:", len(results))

    for index, item in enumerate(results, start=1):
        print(f"\n--- Result {index} ---")
        print("RRF:", round(item["rrf_score"], 5))
        print("Reranker:", round(item["rerank_score"], 4))
        print("Source:", item["source_reference"])
        print("Text:", item["chunk_text"][:400])
