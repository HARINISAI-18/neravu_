import os
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app, recent_requests
from app.services.dify_service import DifyServiceError, dify_service


class ChatApiTests(unittest.TestCase):
    def setUp(self):
        self.previous_secret = os.environ.get("GUEST_SESSION_SECRET")
        os.environ["GUEST_SESSION_SECRET"] = "test-only-guest-session-secret-123456"
        self.previous_key = dify_service.api_key
        self.previous_type = dify_service.app_type
        dify_service.api_key = "test-only-dify-key"
        dify_service.app_type = "advanced-chat"
        recent_requests.clear()
        self.client = TestClient(app)

    def tearDown(self):
        dify_service.api_key = self.previous_key
        dify_service.app_type = self.previous_type
        if self.previous_secret is None:
            os.environ.pop("GUEST_SESSION_SECRET", None)
        else:
            os.environ["GUEST_SESSION_SECRET"] = self.previous_secret

    def test_guest_session_issues_stable_identity_token(self):
        response = self.client.post("/api/guest-session")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["session_token"])
        self.assertTrue(response.json()["user_id"].startswith("guest:"))

    def test_chat_validates_language_and_session(self):
        response = self.client.post("/api/chat", json={"message": "Question", "language": "xx"})
        self.assertEqual(response.status_code, 422)

    def test_guest_chat_returns_expected_payload(self):
        guest = self.client.post("/api/guest-session").json()
        expected = {
            "answer": "Grounded answer",
            "conversation_id": "conv-1",
            "message_id": "msg-1",
            "sources": [],
            "status": "success",
        }
        with patch("app.main.dify_service.answer", new=AsyncMock(return_value=expected)):
            response = self.client.post(
                "/api/chat",
                headers={"X-Guest-Session": guest["session_token"]},
                json={"message": "PM-JAY?", "language": "en", "stream": False},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), expected)

    def test_signed_in_chat_uses_verified_user_id(self):
        expected = {
            "answer": "Grounded answer",
            "conversation_id": None,
            "message_id": None,
            "sources": [],
            "status": "success",
        }
        with (
            patch("app.main._authenticated_user_id", new=AsyncMock(return_value="verified-user")),
            patch("app.main.dify_service.answer", new=AsyncMock(return_value=expected)) as answer,
        ):
            response = self.client.post(
                "/api/chat",
                headers={"Authorization": "Bearer test-token"},
                json={"message": "Question", "language": "te", "stream": False},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(answer.await_args.args[2], "verified-user")

    def test_dify_errors_are_sanitized(self):
        guest = self.client.post("/api/guest-session").json()
        failure = DifyServiceError("The guidance service rejected its server credentials.", 502)
        with patch("app.main.dify_service.answer", new=AsyncMock(side_effect=failure)):
            response = self.client.post(
                "/api/chat",
                headers={"X-Guest-Session": guest["session_token"]},
                json={"message": "Question", "language": "en", "stream": False},
            )
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("test-only-dify-key", response.text)

    def test_streaming_returns_deltas_and_final_sources(self):
        guest = self.client.post("/api/guest-session").json()

        async def fake_stream(message, language, user_id, conversation_id):
            yield 'event: delta\ndata: {"text":"Grounded "}\n\n'
            yield 'event: delta\ndata: {"text":"answer"}\n\n'
            yield (
                'event: done\ndata: {"answer":"Grounded answer","conversation_id":"conv-2",'
                '"message_id":"msg-2","sources":[{"title":"Guide","url":""}],"status":"success"}\n\n'
            )

        with patch("app.main.dify_service.stream", side_effect=fake_stream):
            with self.client.stream(
                "POST",
                "/api/chat",
                headers={"X-Guest-Session": guest["session_token"]},
                json={"message": "Question", "language": "en", "stream": True},
            ) as response:
                body = "".join(response.iter_text())

        self.assertEqual(response.status_code, 200)
        self.assertIn("event: delta", body)
        self.assertIn("event: done", body)
        self.assertIn('"conversation_id":"conv-2"', body)
        self.assertIn('"title":"Guide"', body)


if __name__ == "__main__":
    unittest.main()
