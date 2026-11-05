"""Small, separate general cancer education corpus from official sources."""

import re


MEDICAL_EVIDENCE = [
    {
        "source_reference": "National Cancer Institute (NCI), What Is Cancer?",
        "source_url": "https://www.cancer.gov/about-cancer/understanding/what-is-cancer",
        "source_locator": "The Definition of Cancer; How Does Cancer Develop?",
        "keywords": {"cancer", "tumor", "tumour", "cells", "spread", "metastasis", "definition"},
        "chunk_text": "Cancer is a group of diseases in which some body cells grow uncontrollably and can invade nearby tissue or spread to other parts of the body. A tumor can be benign or cancerous, and some cancers such as leukemia do not form solid tumors. This general description cannot diagnose an individual.",
    },
    {
        "source_reference": "National Cancer Institute (NCI), Types of Cancer Treatment",
        "source_url": "https://www.cancer.gov/about-cancer/treatment/types",
        "source_locator": "Types of Cancer Treatment; treatment depends on cancer type and how advanced it is",
        "keywords": {"treatment", "therapy", "chemotherapy", "radiation", "radiotherapy", "surgery", "immunotherapy", "targeted"},
        "chunk_text": "Cancer treatment can include surgery, chemotherapy, radiation therapy, immunotherapy, hormone therapy, targeted therapy, and other approaches. Some people receive one type of treatment and others receive a combination. The treatment choice depends on the cancer type, how advanced it is, and individual health factors; a treating oncology team should discuss the options.",
    },
    {
        "source_reference": "World Health Organization (WHO), Cancer",
        "source_url": "https://www.who.int/news-room/fact-sheets/detail/cancer",
        "source_locator": "Treatment; Palliative care",
        "keywords": {"palliative", "pain", "symptom", "quality", "comfort", "supportive", "care"},
        "chunk_text": "Palliative care aims to relieve symptoms and suffering and improve quality of life for people with cancer and their families. It can support physical, psychosocial, and spiritual needs. Ask the oncology team what supportive and palliative services are available for the person's situation.",
    },
    {
        "source_reference": "National Cancer Institute (NCI), Infection and Neutropenia during Cancer Treatment",
        "source_url": "https://www.cancer.gov/about-cancer/treatment/side-effects/infection",
        "source_locator": "Signs and symptoms of infection; when to call your health care team",
        "keywords": {"infection", "fever", "chills", "neutropenia", "urgent", "38", "100.5"},
        "chunk_text": "NCI identifies a fever of 100.5 degrees Fahrenheit (38 degrees Celsius) or higher as a possible sign of infection during cancer treatment and says to call the health care team. Infection during cancer treatment can be life-threatening and needs urgent medical attention. Follow the treating team's instructions; ask before taking fever medicine.",
    },
]


def retrieve_medical_evidence(question: str, top_k: int = 3) -> list[dict]:
    tokens = set(re.findall(r"[a-z0-9]+", question.lower()))
    unsupported_personal_topics = {"diagnose", "diagnosis", "prognosis", "cure", "cured", "stage", "symptoms", "symptom", "medicine", "medicines", "dose", "dosage"}
    if tokens & unsupported_personal_topics:
        return []
    candidates = []
    for item in MEDICAL_EVIDENCE:
        overlap = len(tokens & item["keywords"])
        matched_specific = (tokens & item["keywords"]) - {"cancer", "treatment", "care"}
        if not matched_specific and not (item["source_reference"].startswith("National Cancer Institute") and "cancer" in tokens):
            continue
        phrase_bonus = sum(2 for keyword in item["keywords"] if len(keyword) > 5 and keyword in question.lower())
        score = overlap + phrase_bonus
        if score > 0:
            candidates.append({**item, "retrieval_score": score})
    candidates.sort(key=lambda item: item["retrieval_score"], reverse=True)
    if not candidates:
        return []
    return candidates[:top_k]


def chat_with_medical_knowledge(question: str, language: str = "en") -> dict:
    chunks = retrieve_medical_evidence(question)
    if not chunks:
        fallback = {
            "en": "I do not have a curated source for that cancer question yet. Please ask your oncology team. I cannot diagnose or recommend changing treatment.",
            "hi": "इस कैंसर-संबंधी प्रश्न के लिए इस सेवा में सत्यापित स्रोत उपलब्ध नहीं है। कृपया अपनी ऑन्कोलॉजी टीम से पूछें। मैं निदान नहीं कर सकता और उपचार बदलने की सलाह नहीं दे सकता।",
            "te": "ఈ క్యాన్సర్ ప్రశ్నకు ఈ సేవలో ధృవీకరించిన ఆధారం లేదు. దయచేసి మీ ఆంకాలజీ బృందాన్ని అడగండి. నేను నిర్ధారణ చేయలేను లేదా చికిత్స మార్చమని సలహా ఇవ్వలేను.",
        }
        return {
            "answer": fallback[language],
            "language": language,
            "sources": [],
            "verification_status": "no_curated_medical_evidence",
            "disclaimer": "General information only; not a diagnosis or treatment plan.",
        }
    from app.services.llm_service import generate_answer, validate_cited_answer

    answer = generate_answer(question, language, chunks, domain="medical")
    answer = validate_cited_answer(answer, chunks, question=question)
    if answer is None:
        return {
            "answer": "The available source passages were not sufficient for a verifiable answer. Please ask your oncology team.",
            "language": language,
            "sources": [{"source_reference": c["source_reference"], "source_url": c["source_url"], "source_locator": c["source_locator"]} for c in chunks],
            "verification_status": "insufficient_evidence",
            "disclaimer": "General information only; not a diagnosis or treatment plan.",
        }
    return {
        "answer": answer,
        "language": language,
        "sources": [
            {"citation_number": i, "source_reference": chunk["source_reference"], "source_url": chunk["source_url"], "source_locator": chunk["source_locator"], "excerpt": chunk["chunk_text"]}
            for i, chunk in enumerate(chunks, start=1)
        ],
        "verification_status": "curated_official_sources",
        "disclaimer": "General education only. This is not a diagnosis or an individual treatment recommendation.",
    }
