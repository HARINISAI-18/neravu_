import json
import os
from collections.abc import AsyncIterator
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


class DifyServiceError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def _source_items(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    sources: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        title = item.get("document_name") or item.get("title") or item.get("dataset_name")
        url = item.get("url") or item.get("source_url") or ""
        if not isinstance(title, str) or not title.strip():
            continue
        if not isinstance(url, str) or not url.startswith(("https://", "http://")):
            url = ""
        sources.append({"title": title.strip(), "url": url})
    return sources


def _extract_sources(payload: dict[str, Any]) -> list[dict[str, str]]:
    metadata = payload.get("metadata")
    if isinstance(metadata, dict):
        sources = _source_items(metadata.get("retriever_resources"))
        if sources:
            return sources
    data = payload.get("data")
    if isinstance(data, dict):
        sources = _source_items(data.get("retriever_resources"))
        if sources:
            return sources
    outputs = payload.get("outputs")
    if isinstance(outputs, dict):
        return _source_items(outputs.get("retriever_resources") or outputs.get("sources"))
    return _source_items(payload.get("retriever_resources") or payload.get("sources"))


def _workflow_answer(payload: dict[str, Any]) -> str:
    data = payload.get("data")
    outputs = data.get("outputs") if isinstance(data, dict) else payload.get("outputs")
    if not isinstance(outputs, dict):
        raise DifyServiceError("The guidance service returned no answer.")
    for key in ("answer", "text", "result", "response"):
        value = outputs.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    text_outputs = [value.strip() for value in outputs.values() if isinstance(value, str) and value.strip()]
    if len(text_outputs) == 1:
        return text_outputs[0]
    raise DifyServiceError("The workflow response does not contain a configured answer output.")


class DifyService:
    def __init__(self) -> None:
        self.base_url = os.getenv("DIFY_API_BASE_URL", "https://api.dify.ai/v1").rstrip("/")
        self.api_key = os.getenv("DIFY_API_KEY", "")
        self.app_type = os.getenv("DIFY_APP_TYPE", "advanced-chat").strip().lower()
        self.language_input = os.getenv("DIFY_LANGUAGE_INPUT", "language").strip()
        self.workflow_query_input = os.getenv("DIFY_WORKFLOW_QUERY_INPUT", "query").strip()
        self.timeout = httpx.Timeout(
            connect=10.0,
            read=float(os.getenv("DIFY_READ_TIMEOUT_SECONDS", "90")),
            write=20.0,
            pool=10.0,
        )

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.app_type in {"advanced-chat", "chatbot", "workflow"})

    def _request(self, message: str, language: str, user_id: str, conversation_id: str | None, stream: bool) -> tuple[str, dict[str, Any]]:
        if self.app_type == "workflow":
            inputs: dict[str, Any] = {self.workflow_query_input: message}
            endpoint = "workflows/run"
        else:
            inputs = {}
            endpoint = "chat-messages"
        if self.language_input:
            inputs[self.language_input] = language
        payload: dict[str, Any] = {
            "inputs": inputs,
            "response_mode": "streaming" if stream else "blocking",
            "user": user_id,
        }
        if self.app_type != "workflow":
            payload["query"] = message
            if conversation_id:
                payload["conversation_id"] = conversation_id
        return endpoint, payload

    async def _post(self, endpoint: str, payload: dict[str, Any]) -> httpx.Response:
        if not self.configured:
            raise DifyServiceError("The guidance service is not configured.", 503)
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/{endpoint}",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                        "Accept": "application/json, text/event-stream",
                    },
                    json=payload,
                )
                if response.is_error:
                    if response.status_code == 401 or response.status_code == 403:
                        raise DifyServiceError("The guidance service rejected its server credentials.", 502)
                    if response.status_code == 429:
                        raise DifyServiceError("The guidance service is busy. Please try again shortly.", 503)
                    raise DifyServiceError("The guidance service could not complete this request.", 502)
                return response
        except DifyServiceError:
            raise
        except httpx.TimeoutException as exc:
            raise DifyServiceError("The guidance service timed out. Please try again.", 504) from exc
        except httpx.HTTPError as exc:
            raise DifyServiceError("The guidance service is temporarily unavailable.", 502) from exc

    async def answer(
        self,
        message: str,
        language: str,
        user_id: str,
        conversation_id: str | None = None,
    ) -> dict[str, Any]:
        endpoint, payload = self._request(message, language, user_id, conversation_id, False)
        response = await self._post(endpoint, payload)
        try:
            result = response.json()
        except ValueError as exc:
            raise DifyServiceError("The guidance service returned an invalid response.") from exc
        if not isinstance(result, dict):
            raise DifyServiceError("The guidance service returned an invalid response.")
        if self.app_type == "workflow":
            answer = _workflow_answer(result)
            new_conversation_id = None
            message_id = result.get("data", {}).get("id") if isinstance(result.get("data"), dict) else None
        else:
            answer = result.get("answer")
            new_conversation_id = result.get("conversation_id")
            message_id = result.get("message_id")
            if not isinstance(answer, str) or not answer.strip():
                raise DifyServiceError("The guidance service returned no answer.")
        return {
            "answer": answer.strip(),
            "conversation_id": new_conversation_id,
            "message_id": message_id if isinstance(message_id, str) else None,
            "sources": _extract_sources(result),
            "status": "success",
        }

    async def stream(
        self,
        message: str,
        language: str,
        user_id: str,
        conversation_id: str | None = None,
    ) -> AsyncIterator[str]:
        endpoint, payload = self._request(message, language, user_id, conversation_id, True)
        if not self.configured:
            raise DifyServiceError("The guidance service is not configured.", 503)
        answer_parts: list[str] = []
        latest_conversation_id = None if self.app_type == "workflow" else conversation_id
        message_id: str | None = None
        sources: list[dict[str, str]] = []
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/{endpoint}",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                        "Accept": "text/event-stream",
                    },
                    json=payload,
                ) as response:
                    if response.is_error:
                        if response.status_code in (401, 403):
                            raise DifyServiceError("The guidance service rejected its server credentials.", 502)
                        if response.status_code == 429:
                            raise DifyServiceError("The guidance service is busy. Please try again shortly.", 503)
                        raise DifyServiceError("The guidance service could not complete this request.", 502)
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        raw = line[5:].strip()
                        if not raw or raw == "[DONE]":
                            continue
                        try:
                            event = json.loads(raw)
                        except json.JSONDecodeError as exc:
                            raise DifyServiceError("The guidance service returned an invalid stream event.") from exc
                        if not isinstance(event, dict):
                            continue
                        event_type = event.get("event")
                        if event_type == "error":
                            raise DifyServiceError("The guidance service could not generate a response.")
                        if event.get("conversation_id") and self.app_type != "workflow":
                            latest_conversation_id = event["conversation_id"]
                        if event.get("message_id"):
                            message_id = event["message_id"]
                        event_sources = _extract_sources(event)
                        if event_sources:
                            sources = event_sources
                        chunk = ""
                        if self.app_type == "workflow":
                            if event_type in {"text_chunk", "node_finished"}:
                                data = event.get("data")
                                if isinstance(data, dict) and isinstance(data.get("text"), str):
                                    chunk = data["text"]
                            if event_type == "workflow_finished":
                                try:
                                    if not answer_parts:
                                        chunk = _workflow_answer(event)
                                except DifyServiceError:
                                    chunk = ""
                        elif event_type in {"message", "agent_message"}:
                            chunk = event.get("answer") or ""
                        if isinstance(chunk, str) and chunk:
                            answer_parts.append(chunk)
                            yield _sse("delta", {"text": chunk})
                        if event_type in {"message_end", "workflow_finished"}:
                            if not sources:
                                sources = _extract_sources(event)
            answer = "".join(answer_parts).strip()
            if not answer:
                raise DifyServiceError("The guidance service returned no answer.")
            yield _sse("done", {
                "answer": answer,
                "conversation_id": latest_conversation_id,
                "message_id": message_id,
                "sources": sources,
                "status": "success",
            })
        except DifyServiceError:
            raise
        except httpx.TimeoutException as exc:
            raise DifyServiceError("The guidance service timed out. Please try again.", 504) from exc
        except httpx.HTTPError as exc:
            raise DifyServiceError("The guidance service is temporarily unavailable.", 502) from exc


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


dify_service = DifyService()
