import unittest

from app.services.dify_service import DifyService, DifyServiceError, _extract_sources, _workflow_answer


class DifyServiceTests(unittest.TestCase):
    def test_chatflow_request_uses_conversation_and_language_input(self):
        service = DifyService()
        service.app_type = "advanced-chat"
        service.language_input = "response_language"
        endpoint, payload = service._request("Follow-up?", "te", "patient-123", "conversation-456", True)

        self.assertEqual(endpoint, "chat-messages")
        self.assertEqual(payload["query"], "Follow-up?")
        self.assertEqual(payload["conversation_id"], "conversation-456")
        self.assertEqual(payload["inputs"], {"response_language": "te"})
        self.assertEqual(payload["response_mode"], "streaming")
        self.assertEqual(payload["user"], "patient-123")

    def test_workflow_request_uses_workflow_inputs_and_no_chat_conversation(self):
        service = DifyService()
        service.app_type = "workflow"
        endpoint, payload = service._request("Question", "hi", "patient-123", "ignored-id", False)

        self.assertEqual(endpoint, "workflows/run")
        self.assertEqual(payload["inputs"], {"query": "Question", "language": "hi"})
        self.assertNotIn("conversation_id", payload)
        self.assertEqual(payload["response_mode"], "blocking")

    def test_workflow_uses_a_single_text_output(self):
        self.assertEqual(
            _workflow_answer({"data": {"outputs": {"result": "Verified answer"}}}),
            "Verified answer",
        )

    def test_workflow_rejects_ambiguous_outputs(self):
        with self.assertRaises(DifyServiceError):
            _workflow_answer({"data": {"outputs": {"one": "First", "two": "Second"}}})

    def test_sources_keep_titles_and_only_http_urls(self):
        sources = _extract_sources({
            "metadata": {
                "retriever_resources": [
                    {"document_name": "Scheme guide.pdf", "url": "https://example.org/guide"},
                    {"document_name": "No URL", "url": "javascript:alert(1)"},
                    {"content": "No title"}
                ]
            }
        })
        self.assertEqual(sources, [
            {"title": "Scheme guide.pdf", "url": "https://example.org/guide"},
            {"title": "No URL", "url": ""},
        ])


if __name__ == "__main__":
    unittest.main()
