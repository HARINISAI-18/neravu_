import unittest
from unittest.mock import patch

from app.services.hybrid_rag import (
    _directory_chunk,
    _retrieve_hospital_research,
    _retrieve_legacy_knowledge,
    is_hospital_request,
    is_recommendation_request,
)
from app.services.rag_chat import chat_with_neravu
from ingest_storage_pdf import _chunks_for_page


class _Result:
    def __init__(self, rows=None, scalar=None):
        self.rows = rows or []
        self.scalar = scalar

    def scalar_one(self):
        return self.scalar

    def mappings(self):
        return self

    def all(self):
        return self.rows


class _LegacyConnection:
    def __init__(self):
        self.calls = 0

    def execute(self, *_args, **_kwargs):
        self.calls += 1
        if self.calls == 1:
            return _Result(scalar=True)
        return _Result(rows=[{
            "id": "chunk-1",
            "source_reference": "Imported questionnaire",
            "chunk_text": "Scheme support detail",
            "similarity": 0.81,
        }])


class HybridRagSourceTests(unittest.TestCase):
    def test_telugu_text_gets_telugu_fallback_when_answer_fails_validation(self):
        chunks = [{
            "chunk_id": "pdf-1",
            "source_reference": "Scheme guide",
            "source_url": "",
            "source_locator": "Page 1",
            "source_status": "published",
            "chunk_text": "The scheme covers treatment.",
        }]
        with (
            patch("app.services.rag_chat.hybrid_retrieve", return_value=chunks),
            patch("app.services.rag_chat.generate_answer", return_value="సమాధానం"),
            patch("app.services.rag_chat.validate_cited_answer", return_value=None),
        ):
            result = chat_with_neravu("ఈ పథకం ఏమి కవర్ చేస్తుంది?", language="te")

        self.assertIn("ధృవీకరించదగిన సమాధానం", result["answer"])
        self.assertEqual(result["language"], "te")
        self.assertEqual(result["verification_status"], "insufficient_evidence")
        self.assertEqual(len(result["sources"]), 1)

    def test_telugu_question_with_no_retrieved_chunks_gets_telugu_fallback(self):
        with patch("app.services.rag_chat.hybrid_retrieve", return_value=[]):
            result = chat_with_neravu("ఈ పథకం ఏమిటి?", language="te")

        self.assertIn("సంబంధిత సమాచారం", result["answer"])
        self.assertEqual(result["language"], "te")
        self.assertEqual(result["verification_status"], "no_published_evidence")

    def test_detects_broad_scheme_recommendations(self):
        self.assertTrue(is_recommendation_request("recommend me schemes"))
        self.assertTrue(is_recommendation_request("Which schemes can help?"))
        self.assertTrue(is_recommendation_request("నాకు పథకం సూచించండి"))
        self.assertFalse(is_recommendation_request("What does PM-JAY cover?"))

    def test_hospital_questions_retrieve_only_matching_programme_mappings(self):
        question = "Which hospitals are empanelled for PM-JAY?"
        self.assertTrue(is_hospital_request(question))

        chunks = _retrieve_hospital_research(question)

        self.assertTrue(chunks)
        self.assertTrue(all(chunk["field_path"] == "hospital_research" for chunk in chunks))
        self.assertTrue(any("pmjay" in chunk["source_reference"].casefold() for chunk in chunks))
        self.assertTrue(any("Homi Bhabha" in chunk["chunk_text"] for chunk in chunks))
        self.assertTrue(all("confirm current hospital participation" in chunk["source_status"] for chunk in chunks))

    def test_hospital_questions_find_telugu_queries_and_non_partner_caveats(self):
        self.assertTrue(is_hospital_request("PM-JAY పథకానికి ఏ ఆసుపత్రులు ఉన్నాయి?"))
        chunks = _retrieve_hospital_research("Which hospitals are partners for Dhanvantari?")

        self.assertTrue(chunks)
        self.assertTrue(any("do not name" in chunk["chunk_text"].casefold() or "not publish" in chunk["chunk_text"].casefold() for chunk in chunks))

    def test_hospital_questions_request_enough_evidence_for_hospital_lists(self):
        chunks = [{
            "chunk_id": "hospital-map-23",
            "source_reference": "PM-JAY / AB-PMJAY",
            "source_url": "https://nha.gov.in/example",
            "source_locator": "Hospital Mapping row 23",
            "field_path": "hospital_research",
            "source_status": "Unverified research workbook; confirm current hospital participation",
            "chunk_text": "Hospital or network: Homi Bhabha Cancer Hospital & Research Centre",
        }]
        with (
            patch("app.services.rag_chat.hybrid_retrieve", return_value=chunks) as retrieve,
            patch("app.services.rag_chat.generate_answer", return_value="Homi Bhabha [1]."),
            patch("app.services.rag_chat.validate_cited_answer", return_value="Homi Bhabha [1]."),
        ):
            result = chat_with_neravu("Which hospitals are listed for PM-JAY?")

        self.assertEqual(retrieve.call_args.kwargs["top_k"], 15)
        self.assertEqual(result["sources"][0]["field_path"], "hospital_research")

    def test_unverified_directory_status_is_explicit_in_evidence(self):
        chunk = _directory_chunk(
            record_id="record-1",
            source_reference="Local cancer support group",
            source_url=None,
            source_status="Unverified",
            field_path="ngo_directory",
            fields=[("Support offered", "Travel assistance")],
        )

        self.assertIn("Directory record status: Unverified", chunk["chunk_text"])
        self.assertEqual(chunk["source_status"], "Unverified")
        self.assertIn("Travel assistance", chunk["chunk_text"])

    def test_verified_directory_status_is_preserved(self):
        chunk = _directory_chunk(
            record_id="record-2",
            source_reference="Published programme",
            source_url="https://example.org",
            source_status="Verified",
            field_path="government_schemes_directory",
            fields=[("Benefit", "Cashless treatment")],
        )

        self.assertIn("Directory record status: Verified", chunk["chunk_text"])
        self.assertEqual(chunk["source_url"], "https://example.org")

    def test_legacy_knowledge_is_retrieved_and_labeled_unverified(self):
        chunks = _retrieve_legacy_knowledge(_LegacyConnection(), "[0,0]", 5)

        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0]["field_path"], "knowledge_chunks")
        self.assertEqual(chunks[0]["source_status"], "Unverified legacy knowledge")
        self.assertIn("Scheme support detail", chunks[0]["chunk_text"])

    def test_pdf_page_chunking_keeps_text_within_limit(self):
        chunks = _chunks_for_page("word " * 500)

        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(0 < len(chunk) <= 1000 for chunk in chunks))

    def test_recommendation_requests_retrieve_broader_comparison_and_label_sources(self):
        chunks = [{
            "chunk_id": "pdf-1",
            "source_reference": "Scheme guide",
            "source_url": "",
            "source_locator": "Page 1",
            "field_path": "supplemental_pdf",
            "source_status": "unverified",
            "chunk_text": "Document verification status: unverified\nAssistance details.",
        }]
        with (
            patch("app.services.rag_chat.hybrid_retrieve", return_value=chunks) as retrieve,
            patch("app.services.rag_chat.generate_answer", return_value="Consider these options [1]."),
            patch("app.services.rag_chat.validate_cited_answer", return_value="Consider these options [1]."),
        ):
            result = chat_with_neravu("recommend me schemes")

        self.assertEqual(retrieve.call_args.kwargs["top_k"], 15)
        self.assertEqual(result["verification_status"], "mixed_evidence_includes_unverified")
        self.assertIn("unverified", result["disclaimer"])
        self.assertEqual(result["sources"][0]["source_status"], "unverified")


if __name__ == "__main__":
    unittest.main()
