import base64
import hashlib
import hmac
import os
import time
import uuid
from collections import defaultdict, deque
from pathlib import Path
from typing import Annotated

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from app.services.dify_service import DifyServiceError, dify_service

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

app = FastAPI(title="Neravu API", version="1.0.0")
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type", "X-Guest-Session"],
)

SUPPORTED_LANGUAGES = {"en", "te", "hi", "ta", "kn", "ml", "bn", "mr", "gu", "pa", "ur"}
RATE_LIMIT_REQUESTS = int(os.getenv("CHAT_RATE_LIMIT_REQUESTS", "20"))
RATE_LIMIT_WINDOW = int(os.getenv("CHAT_RATE_LIMIT_WINDOW_SECONDS", "60"))
recent_requests: dict[str, deque[float]] = defaultdict(deque)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = Field(default=None, max_length=256)
    language: str = "en"
    stream: bool = True


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _guest_secret() -> bytes:
    secret = os.getenv("GUEST_SESSION_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(status_code=503, detail="Guest chat is not configured.")
    return secret.encode("utf-8")


def _make_guest_token() -> tuple[str, str]:
    guest_id = str(uuid.uuid4())
    expires_at = int(time.time()) + 60 * 60 * 24 * 30
    payload = f"{guest_id}|{expires_at}".encode("utf-8")
    encoded = _b64url_encode(payload)
    signature = hmac.new(_guest_secret(), encoded.encode("ascii"), hashlib.sha256).digest()
    return f"{encoded}.{_b64url_encode(signature)}", guest_id


def _verify_guest_token(token: str | None) -> str:
    if not token or len(token) > 1024:
        raise HTTPException(status_code=401, detail="A guest session is required.")
    try:
        encoded, supplied_signature = token.split(".", 1)
        expected = hmac.new(_guest_secret(), encoded.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64url_decode(supplied_signature)):
            raise ValueError("Invalid signature")
        guest_id, expires_at = _b64url_decode(encoded).decode("utf-8").split("|", 1)
        uuid.UUID(guest_id)
        if int(expires_at) < int(time.time()):
            raise ValueError("Expired token")
        return f"guest:{guest_id}"
    except HTTPException:
        raise
    except (ValueError, UnicodeDecodeError, TypeError) as exc:
        raise HTTPException(status_code=401, detail="The guest session is invalid or expired.") from exc


async def _authenticated_user_id(access_token: str) -> str:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    if not supabase_url or not anon_key:
        raise HTTPException(status_code=503, detail="Signed-in chat verification is not configured.")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            response = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={"apikey": anon_key, "Authorization": f"Bearer {access_token}"},
            )
        if response.status_code == 401:
            raise HTTPException(status_code=401, detail="Your session expired. Please sign in again.")
        if response.is_error:
            raise HTTPException(status_code=502, detail="Could not verify the signed-in session.")
        user = response.json()
        user_id = user.get("id") if isinstance(user, dict) else None
        if not isinstance(user_id, str) or not user_id:
            raise HTTPException(status_code=401, detail="The signed-in session is invalid.")
        return user_id
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Could not verify the signed-in session.") from exc


async def _resolve_identity(authorization: str | None, guest_session: str | None) -> str:
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(status_code=401, detail="The authorization header is invalid.")
        return await _authenticated_user_id(token)
    return _verify_guest_token(guest_session)


def _enforce_rate_limit(user_id: str, request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"{user_id}:{client_ip}"
    now = time.monotonic()
    requests = recent_requests[key]
    while requests and now - requests[0] > RATE_LIMIT_WINDOW:
        requests.popleft()
    if len(requests) >= RATE_LIMIT_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many chat requests. Please wait before trying again.")
    requests.append(now)


def _validate_chat_request(payload: ChatRequest) -> None:
    if payload.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=422, detail="Select a supported response language.")
    if not payload.message.strip():
        raise HTTPException(status_code=422, detail="Enter a question before sending.")
    if not dify_service.configured:
        raise HTTPException(status_code=503, detail="The guidance service is not configured.")


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "guidance": "configured" if dify_service.configured else "not_configured"}


@app.post("/api/guest-session")
async def create_guest_session() -> dict[str, str]:
    token, guest_id = _make_guest_token()
    return {"session_token": token, "user_id": f"guest:{guest_id}"}


@app.post("/api/chat")
async def chat(
    payload: ChatRequest,
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    guest_session: Annotated[str | None, Header(alias="X-Guest-Session")] = None,
):
    _validate_chat_request(payload)
    user_id = await _resolve_identity(authorization, guest_session)
    _enforce_rate_limit(user_id, request)
    message = payload.message.strip()
    if not payload.stream:
        try:
            return await dify_service.answer(message, payload.language, user_id, payload.conversation_id)
        except DifyServiceError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    async def events():
        try:
            async for event in dify_service.stream(
                message,
                payload.language,
                user_id,
                payload.conversation_id,
            ):
                yield event
        except DifyServiceError as exc:
            import json

            yield f"event: error\ndata: {json.dumps({'message': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
