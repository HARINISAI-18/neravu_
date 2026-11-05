import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logger = logging.getLogger(__name__)

# Lifespan: Scheme Publication Background Sync Worker
@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.workers.sync_worker import run_sync_worker

    worker = asyncio.create_task(run_sync_worker(), name="scheme-publication-sync")
    app.state.scheme_sync_worker = worker
    try:
        yield
    finally:
        worker.cancel()
        with suppress(asyncio.CancelledError):
            await worker


app = FastAPI(title="Neravu API", version="1.0.0", lifespan=lifespan)

# CORS Configuration
allowed_origins_env = os.getenv("CORS_ORIGINS", "*")
if allowed_origins_env == "*":
    allowed_origins = ["*"]
else:
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins != ["*"] else ["*"],
    allow_credentials=True if allowed_origins != ["*"] else False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public & Admin Routers
from app.routes.admin_schemes import router as admin_schemes_router
from app.routes.engines import router as engines_router
from app.routes.schemes import router as schemes_router

app.include_router(schemes_router)
app.include_router(admin_schemes_router)
app.include_router(engines_router)

# Rate Limiting & Guest Tokens
RATE_LIMIT_REQUESTS = int(os.getenv("CHAT_RATE_LIMIT_REQUESTS", "60"))
RATE_LIMIT_WINDOW = int(os.getenv("CHAT_RATE_LIMIT_WINDOW_SECONDS", "60"))
recent_requests: dict[str, deque[float]] = defaultdict(deque)

SUPPORTED_LANGUAGES = {"en", "te", "hi", "ta", "kn", "ml", "bn", "mr", "gu", "pa", "ur"}


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message: str | None = Field(default=None, max_length=2000)
    question: str | None = Field(default=None, max_length=2000)
    conversation_id: str | None = Field(default=None, max_length=256)
    language: str = "en"
    stream: bool = False
    scheme_id: UUID | None = None
    patient_facts: dict | None = None
    document_names: list[str] | None = None

    @property
    def query(self) -> str:
        text = self.message or self.question or ""
        return text.strip()


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _guest_secret() -> bytes:
    secret = os.getenv("GUEST_SESSION_SECRET", "")
    if len(secret) < 32:
        secret = "neravu-default-guest-secret-token-key-for-local-dev-32chars"
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
        return f"guest:{uuid.uuid4()}"
    try:
        encoded, supplied_signature = token.split(".", 1)
        expected = hmac.new(_guest_secret(), encoded.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64url_decode(supplied_signature)):
            return f"guest:{uuid.uuid4()}"
        guest_id, expires_at = _b64url_decode(encoded).decode("utf-8").split("|", 1)
        uuid.UUID(guest_id)
        if int(expires_at) < int(time.time()):
            return f"guest:{uuid.uuid4()}"
        return f"guest:{guest_id}"
    except Exception:
        return f"guest:{uuid.uuid4()}"


def _authenticated_user_id(access_token: str) -> str:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    if not supabase_url or not anon_key:
        return "dev-authenticated-user"
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(
                f"{supabase_url}/auth/v1/user",
                headers={"apikey": anon_key, "Authorization": f"Bearer {access_token}"},
            )
        if response.status_code == 200:
            user = response.json()
            return user.get("id", "user")
        return "user"
    except Exception:
        return "user"


def _resolve_identity(authorization: str | None, guest_session: str | None) -> str:
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token:
            return _authenticated_user_id(token)
    return _verify_guest_token(guest_session)


def _enforce_rate_limit(user_id: str, request: Request | None) -> None:
    if request is None:
        return
    client_ip = request.client.host if request.client else "unknown"
    key = f"{user_id}:{client_ip}"
    now = time.monotonic()
    requests = recent_requests[key]
    while requests and now - requests[0] > RATE_LIMIT_WINDOW:
        requests.popleft()
    if len(requests) >= RATE_LIMIT_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many chat requests. Please wait before trying again.")
    requests.append(now)


# Health Check Endpoints
@app.get("/health")
@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "neravu-backend"}


# Guest Session Creation
@app.post("/api/guest-session")
def create_guest_session() -> dict[str, str]:
    token, guest_id = _make_guest_token()
    return {"session_token": token, "user_id": f"guest:{guest_id}"}


# Core Unified Chat Endpoint
@app.post("/api/chat", response_model=None)
def chat(
    payload: ChatRequest,
    request: Request = None,
    authorization: Annotated[str | None, Header()] = None,
    guest_session: Annotated[str | None, Header(alias="X-Guest-Session")] = None,
):
    query = payload.query
    if not query:
        raise HTTPException(status_code=422, detail="Enter a question before sending.")

    user_id = _resolve_identity(authorization, guest_session)
    _enforce_rate_limit(user_id, request)

    # Normalize response language
    lang = payload.language if payload.language in {"en", "te", "hi"} else "en"

    def execute_query() -> dict:
        from app.services.question_intent import classify_intent, safe_medical_response
        from app.services.rag_chat import chat_with_neravu

        intent = classify_intent(query)
        safe_response = safe_medical_response(intent, lang)
        if intent == "urgent_medical" and safe_response is not None:
            return {**safe_response, "intent": intent}

        if intent == "cancer_knowledge":
            from app.services.medical_knowledge import chat_with_medical_knowledge
            res = chat_with_medical_knowledge(query, lang)
            return {**res, "intent": intent}

        if intent == "eligibility":
            if payload.scheme_id is None or payload.patient_facts is None:
                return {
                    "answer": "To screen against a published scheme, provide its scheme_id and structured patient_facts. Missing facts remain unknown; do not send identity numbers or medical records.",
                    "intent": intent,
                    "verification_status": "needs_structured_input",
                    "sources": [],
                }
            from app.routes.engines import EligibilityRequest, evaluate_scheme_eligibility
            res = evaluate_scheme_eligibility(
                payload.scheme_id,
                EligibilityRequest(patient_facts=payload.patient_facts),
            )
            return {**res, "intent": intent}

        if intent == "documents":
            if payload.scheme_id is None:
                return {
                    "answer": "Provide the published scheme_id to check its evidence-backed document checklist.",
                    "intent": intent,
                    "verification_status": "needs_scheme_id",
                    "sources": [],
                }
            from app.routes.engines import DocumentRequest, check_scheme_documents
            res = check_scheme_documents(
                payload.scheme_id,
                DocumentRequest(
                    patient_facts=payload.patient_facts or {},
                    documents=payload.document_names or [],
                ),
            )
            return {**res, "intent": intent}

        # Scheme Hybrid RAG + Sarvam 105b
        res = chat_with_neravu(question=query, language=lang)
        return {**res, "intent": intent}

    def format_result(res: dict) -> dict:
        raw_sources = res.get("sources") or []
        normalized_sources = []
        for s in raw_sources:
            if isinstance(s, dict):
                normalized_sources.append({
                    "title": s.get("source_url") or s.get("title") or s.get("claim_text", "Official Evidence"),
                    "url": s.get("source_url") or s.get("url", ""),
                })
            elif isinstance(s, str):
                normalized_sources.append({"title": s, "url": ""})

        return {
            **res,
            "answer": res.get("answer", ""),
            "conversation_id": payload.conversation_id or str(uuid.uuid4()),
            "message_id": str(uuid.uuid4()),
            "sources": normalized_sources,
            "status": res.get("verification_status", "verified"),
            "intent": res.get("intent", "scheme_qa"),
            "verification_status": res.get("verification_status", "verified"),
        }

    # Handle non-streaming request
    if not payload.stream:
        try:
            raw_res = execute_query()
            return format_result(raw_res)
        except ValueError as err:
            raise HTTPException(status_code=400, detail=str(err))
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Neravu chat processing failed")
            raise HTTPException(status_code=503, detail="Chat service temporarily unavailable")

    # Handle streaming SSE request
    def sse_generator():
        try:
            raw_res = execute_query()
            formatted = format_result(raw_res)
            full_text = formatted["answer"]

            # Stream words/chunks in delta events
            words = full_text.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                yield f"event: delta\ndata: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
                time.sleep(0.015)

            # Stream final done event
            yield f"event: done\ndata: {json.dumps(formatted, ensure_ascii=False)}\n\n"
        except Exception as exc:
            logger.exception("Streaming chat failed")
            yield f"event: error\ndata: {json.dumps({'message': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
