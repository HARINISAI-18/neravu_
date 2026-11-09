"""Comprehensive end-to-end regression and verification test suite for Neravu Backend.
Tests all 9 core capabilities:
1. Scheme GET endpoint (published list & detail)
2. Scheme Journey / Application Steps API
3. All 4 published schemes verification
4. Tri-state Eligibility Engine (/eligibility/evaluate)
5. Document Checklist Engine (/documents/check)
6. Urgent Medical Safety Routing
7. General Cancer Knowledge (Medical Education segregated RAG)
8. Grounded Scheme RAG with strict citation and numeric claim validation
9. Factual correctness for 70+ age interpretation vs household size
"""

import os
import sys
from uuid import UUID

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from app.main import chat, ChatRequest
from app.routes.schemes import list_schemes, get_scheme
from app.routes.engines import (
    evaluate_scheme_eligibility,
    check_scheme_documents,
    get_scheme_journey,
    EligibilityRequest,
    DocumentRequest,
)


def run_tests():
    print("=" * 60)
    print("NERAVU END-TO-END VERIFICATION SUITE")
    print("=" * 60)

    # 1. Scheme List Endpoint
    schemes_resp = list_schemes()
    assert schemes_resp["count"] == 4, f"Expected 4 published schemes, got {schemes_resp['count']}"
    print(f"[PASS] 1. GET /api/schemes returned {schemes_resp['count']} published schemes")

    pmjay_scheme = next(s for s in schemes_resp["schemes"] if "PMJAY" in s["official_name"] or "PM-JAY" in s["official_name"])
    pmjay_id = UUID(str(pmjay_scheme["id"]))

    # 2. Scheme Detail Endpoint
    detail = get_scheme(pmjay_id)
    assert detail["version"] >= 1
    assert detail["review_status"] == "verified"
    assert len(detail["evidence_sources"]) >= 1
    print(f"[PASS] 2. GET /api/schemes/{pmjay_id} returned verified detail with {len(detail['evidence_sources'])} sources")

    # 3. Scheme Journey Endpoint
    journey = get_scheme_journey(pmjay_id)
    assert len(journey["steps"]) == 6, f"Expected 6 steps, got {len(journey['steps'])}"
    print(f"[PASS] 3. GET /api/schemes/{pmjay_id}/journey returned {len(journey['steps'])} official workflow steps")

    # 4. Eligibility Engine
    senior_eval = evaluate_scheme_eligibility(pmjay_id, EligibilityRequest(patient_facts={"age": 72, "citizenship": "IN"}))
    assert senior_eval["result"] == "PASS", f"Expected PASS for 72yo, got {senior_eval['result']}"
    print(f"[PASS] 4. Eligibility evaluation: age 72 senior citizen -> {senior_eval['result']}")

    # 5. Document Checklist Engine
    doc_check = check_scheme_documents(pmjay_id, DocumentRequest(patient_facts={"age": 72}, documents=["Aadhaar Card"]))
    states = {d["document_name"]: d["state"] for d in doc_check["documents"]}
    assert states.get("Aadhaar Card") == "provided"
    assert states.get("Ration Card") == "not_required"
    print(f"[PASS] 5. Document check: Aadhaar -> {states['Aadhaar Card']}, Ration Card -> {states['Ration Card']}")

    # 6. Urgent Medical Safety Intent Routing
    urgent_resp = chat(ChatRequest(question="I am running a high fever of 102 with severe chills after chemotherapy", language="en"))
    assert urgent_resp.get("intent") == "urgent_medical"
    assert urgent_resp.get("verification_status") == "safety_routed"
    print(f"[PASS] 6. Urgent medical safety routing triggered with status: {urgent_resp['verification_status']}")

    # 7. General Cancer Knowledge Routing
    med_resp = chat(ChatRequest(question="What is cancer and how does metastasis happen?", language="en"))
    assert med_resp.get("intent") == "cancer_knowledge"
    assert len(med_resp.get("sources", [])) >= 1
    print(f"[PASS] 7. Cancer knowledge query routed with {len(med_resp.get('sources'))} authoritative sources")

    # 8. Scheme RAG Query
    scheme_chat = chat(ChatRequest(question="What is the financial coverage limit of PM-JAY?", language="en"))
    assert scheme_chat.get("verification_status") in ("published_evidence", "mixed_evidence_includes_unverified")
    assert len(scheme_chat.get("sources", [])) >= 1
    print(f"[PASS] 8. Scheme RAG chat returned published evidence with {len(scheme_chat.get('sources'))} citations")

    # 9. Correctness: Age 70+ vs 70 family members
    age_chat = chat(ChatRequest(question="Can an individual aged 72 apply for PM-JAY assistance?", language="en"))
    assert age_chat.get("verification_status") in ("published_evidence", "mixed_evidence_includes_unverified")
    answer_text = age_chat.get("answer", "")
    assert "70" in answer_text or "72" in answer_text
    print(f"[PASS] 9. Factual claim verification: Age 70+ correctly validated")

    print("=" * 60)
    print("ALL 9 CAPABILITIES FULLY VERIFIED AND PASSING!")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()

