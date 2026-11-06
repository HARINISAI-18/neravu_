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
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logger = logging.getLogger(__name__)

# Lifespan: Scheme Publication Background Sync Worker & Model Pre-warming
@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.workers.sync_worker import run_sync_worker

    worker = asyncio.create_task(run_sync_worker(), name="scheme-publication-sync")
    app.state.scheme_sync_worker = worker

    async def warm_models():
        try:
            loop = asyncio.get_running_loop()
            from app.services.hybrid_rag import get_embedding_model
            await loop.run_in_executor(None, get_embedding_model)
            logger.info("Hybrid RAG embedding model pre-warmed successfully.")
        except Exception as e:
            logger.warning(f"Could not pre-warm embedding model: {e}")

    asyncio.create_task(warm_models())
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
from app.routes.directory import router as directory_router

app.include_router(schemes_router)
app.include_router(admin_schemes_router)
app.include_router(engines_router)
app.include_router(directory_router)

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
    supabase_url = (os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL", "")).rstrip("/")
    anon_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY", "")
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
    lang = payload.language if payload.language in SUPPORTED_LANGUAGES else "en"

    def execute_query() -> dict:
        from app.services.question_intent import classify_intent, safe_medical_response, greeting_response
        from app.services.rag_chat import chat_with_neravu

        intent = classify_intent(query)
        if intent == "greeting":
            return {**greeting_response(lang), "intent": intent}

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
                title = (
                    s.get("source_reference")
                    or s.get("title")
                    or s.get("claim_text")
                    or "Evidence"
                )
                locator = s.get("source_locator")
                if isinstance(locator, str) and locator.startswith("Page "):
                    title = f"{title} - {locator}"
                source_status = s.get("source_status")
                if source_status and "unverified" in str(source_status).lower():
                    title = f"{title} (Unverified source)"
                normalized_sources.append({
                    "title": title,
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
            # Immediate keep-alive ping to establish HTTP SSE connection without buffering
            yield ": ping\n\n"
            raw_res = execute_query()
            formatted = format_result(raw_res)
            full_text = formatted["answer"]

            # Stream words/chunks in delta events
            words = full_text.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                yield f"event: delta\ndata: {json.dumps({'text': chunk}, ensure_ascii=False)}\n\n"
                time.sleep(0.01)

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


# ---------------------------------------------------------
# Voice APIs (Sarvam AI STT & TTS Integration)
# ---------------------------------------------------------

VOICE_RATE_LIMIT_REQUESTS = int(os.getenv("VOICE_RATE_LIMIT_REQUESTS", "20"))
VOICE_RATE_LIMIT_WINDOW = int(os.getenv("VOICE_RATE_LIMIT_WINDOW_SECONDS", "60"))
MAX_AUDIO_BYTES = int(os.getenv("MAX_AUDIO_BYTES", str(8 * 1024 * 1024)))  # 8 MB max
recent_voice_requests: dict[str, deque[float]] = defaultdict(deque)


def _enforce_voice_rate_limit(user_id: str, request: Request | None) -> None:
    if request is None:
        return
    client_ip = request.client.host if request.client else "unknown"
    key = f"voice:{user_id}:{client_ip}"
    now = time.monotonic()
    requests = recent_voice_requests[key]
    while requests and now - requests[0] > VOICE_RATE_LIMIT_WINDOW:
        requests.popleft()
    if len(requests) >= VOICE_RATE_LIMIT_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail="Too many voice requests. Please wait a moment before speaking again.",
        )
    requests.append(now)


class SynthesizeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    text: str = Field(..., max_length=5000)
    language: str = "en"
    speaker: str | None = None


@app.post("/api/voice/transcribe")
async def voice_transcribe(
    file: UploadFile = File(...),
    language: str = Form(default="auto"),
    request: Request = None,
    authorization: Annotated[str | None, Header()] = None,
    guest_session: Annotated[str | None, Header(alias="X-Guest-Session")] = None,
):
    """Transcribes an uploaded audio file and detects its spoken Indian language."""
    user_id = _resolve_identity(authorization, guest_session)
    _enforce_voice_rate_limit(user_id, request)

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="Audio file cannot be empty.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail=f"Audio file exceeds maximum size of {MAX_AUDIO_BYTES // (1024 * 1024)}MB.")

    from app.services.voice_service import transcribe_audio

    try:
        res = transcribe_audio(
            file_bytes=audio_bytes,
            filename=file.filename or "recording.webm",
            content_type=file.content_type or "audio/webm",
            language_code=language if language != "auto" else "unknown",
        )
        return res
    except Exception as exc:
        logger.exception("Voice transcription endpoint failed")
        raise HTTPException(status_code=502, detail=f"Speech transcription failed: {exc}")


@app.post("/api/voice/synthesize")
def voice_synthesize(
    payload: SynthesizeRequest,
    request: Request = None,
    authorization: Annotated[str | None, Header()] = None,
    guest_session: Annotated[str | None, Header(alias="X-Guest-Session")] = None,
):
    """Synthesizes text into high-quality speech using Sarvam AI Bulbul TTS."""
    user_id = _resolve_identity(authorization, guest_session)
    _enforce_voice_rate_limit(user_id, request)

    from app.services.voice_service import synthesize_speech

    audio_base64 = synthesize_speech(
        text=payload.text,
        language=payload.language,
        speaker=payload.speaker,
    )
    if not audio_base64:
        raise HTTPException(status_code=502, detail="Speech synthesis failed or produced no audio.")

    return {
        "audio_base64": audio_base64,
        "language": payload.language,
        "mime_type": "audio/wav",
    }


@app.post("/api/voice/chat")
async def voice_chat(
    file: UploadFile = File(...),
    conversation_id: str | None = Form(default=None),
    language: str = Form(default="auto"),
    enable_tts: bool = Form(default=True),
    scheme_id: UUID | None = Form(default=None),
    patient_facts_json: str | None = Form(default=None),
    request: Request = None,
    authorization: Annotated[str | None, Header()] = None,
    guest_session: Annotated[str | None, Header(alias="X-Guest-Session")] = None,
):
    """
    Unified Voice RAG Pipeline:
    1. Transcribes incoming audio in user's native language using Sarvam STT.
    2. Runs hybrid RAG query in the exact same language.
    3. Synthesizes the evidence-grounded answer to speech using Sarvam Bulbul TTS.
    """
    user_id = _resolve_identity(authorization, guest_session)
    _enforce_voice_rate_limit(user_id, request)

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="Audio file cannot be empty.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail=f"Audio file exceeds maximum size of {MAX_AUDIO_BYTES // (1024 * 1024)}MB.")

    from app.services.voice_service import transcribe_audio, synthesize_speech

    # Step 1: Transcribe Speech & Detect Language
    try:
        stt_res = transcribe_audio(
            file_bytes=audio_bytes,
            filename=file.filename or "recording.wav",
            content_type=file.content_type or "audio/wav",
            language_code=language if (language and language not in ("auto", "en")) else "unknown",
        )
    except Exception as exc:
        logger.exception("STT transcription step failed in voice_chat")
        raise HTTPException(status_code=502, detail=f"Could not transcribe voice audio: {exc}")

    query = stt_res.get("transcript", "").strip()
    detected_lang = stt_res.get("language")

    # Determine response language: prioritize the language the user actually spoke!
    from app.services.voice_service import detect_indic_script
    script_lang = detect_indic_script(query)
    if script_lang:
        active_lang = script_lang
    elif detected_lang and detected_lang != "en":
        active_lang = detected_lang
    elif language and language != "auto" and language in SUPPORTED_LANGUAGES and language != "en":
        active_lang = language
    else:
        active_lang = detected_lang or "en"

    if active_lang not in SUPPORTED_LANGUAGES:
        active_lang = "en"

    # Handle case where user audio was completely empty / silence / unintelligible
    if not query:
        unclear_msg = (
            "క్షమించండి, మీ వాయిస్ స్పష్టంగా వినబడలేదు. దయచేసి మళ్లీ ప్రయత్నించండి."
            if active_lang == "te"
            else (
                "क्षमा करें, आपकी आवाज़ स्पष्ट रूप से सुनाई नहीं दी। कृपया फिर से बोलें।"
                if active_lang == "hi"
                else "Sorry, we could not clearly capture your voice. Please try speaking again."
            )
        )
        audio_base64 = synthesize_speech(unclear_msg, language=active_lang) if enable_tts else None
        return {
            "transcript": "",
            "answer": unclear_msg,
            "language": active_lang,
            "audio_base64": audio_base64,
            "sources": [],
            "verification_status": "unclear_audio",
            "intent": "audio_error",
            "conversation_id": conversation_id or str(uuid.uuid4()),
            "message_id": str(uuid.uuid4()),
        }

    # Step 2: Execute RAG Pipeline with the transcribed query and detected language
    from app.services.question_intent import classify_intent, safe_medical_response, greeting_response
    from app.services.rag_chat import chat_with_neravu

    patient_facts = None
    if patient_facts_json:
        try:
            patient_facts = json.loads(patient_facts_json)
        except Exception:
            patient_facts = None

    intent = classify_intent(query)
    if intent == "greeting":
        rag_res = {**greeting_response(active_lang), "intent": intent}
    elif intent == "urgent_medical" and safe_medical_response(intent, active_lang) is not None:
        rag_res = {**safe_medical_response(intent, active_lang), "intent": intent}
    elif intent == "cancer_knowledge":
        from app.services.medical_knowledge import chat_with_medical_knowledge
        rag_res = {**chat_with_medical_knowledge(query, active_lang), "intent": intent}
    elif intent == "eligibility" and scheme_id is not None and patient_facts is not None:
        from app.routes.engines import EligibilityRequest, evaluate_scheme_eligibility
        rag_res = {
            **evaluate_scheme_eligibility(scheme_id, EligibilityRequest(patient_facts=patient_facts)),
            "intent": intent,
        }
    else:
        # Standard Scheme Hybrid RAG in the user's language
        rag_res = {**chat_with_neravu(question=query, language=active_lang), "intent": intent}

    # Step 3: Format and normalize sources
    raw_sources = rag_res.get("sources") or []
    normalized_sources = []
    for s in raw_sources:
        if isinstance(s, dict):
            title = (
                s.get("source_reference")
                or s.get("title")
                or s.get("claim_text")
                or "Evidence"
            )
            locator = s.get("source_locator")
            if isinstance(locator, str) and locator.startswith("Page "):
                title = f"{title} - {locator}"
            source_status = s.get("source_status")
            if source_status and "unverified" in str(source_status).lower():
                title = f"{title} (Unverified source)"
            normalized_sources.append({
                "title": title,
                "url": s.get("source_url") or s.get("url", ""),
            })
        elif isinstance(s, str):
            normalized_sources.append({"title": s, "url": ""})

    answer_text = rag_res.get("answer", "").strip()

    # Step 4: Synthesize text response into speech via Sarvam TTS
    audio_base64 = None
    if enable_tts and answer_text:
        try:
            audio_base64 = synthesize_speech(
                text=answer_text,
                language=active_lang,
            )
        except Exception as exc:
            logger.warning(f"Voice chat TTS synthesis step warning: {exc}")

    return {
        "transcript": query,
        "answer": answer_text,
        "language": active_lang,
        "audio_base64": audio_base64,
        "sources": normalized_sources,
        "verification_status": rag_res.get("verification_status", "verified"),
        "intent": rag_res.get("intent", "scheme_qa"),
        "conversation_id": conversation_id or str(uuid.uuid4()),
        "message_id": str(uuid.uuid4()),
    }

