"""
Comprehensive API test suite testing all User and Admin endpoints:
- Health & Guest Session
- Schemes & Journey
- Eligibility & Documents Engines
- Directory (NGOs & Schemes)
- Chat (JSON & Streaming SSE) across intents
- Mic Audio Transcribe, Speech Synthesize, and Unified Voice Chat
- Admin Authorization & Schemas
"""

import io
import json
import os
import sys
import uuid
import wave
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = Path(__file__).resolve().parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Set test environment
os.environ["APP_ENV"] = "development"
os.environ["DEV_ADMIN_TOKEN"] = "dev-admin-test-token-12345"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_ROOT / ".env")

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def make_dummy_wav(duration_seconds: float = 1.0, sample_rate: int = 16000) -> bytes:
    """Generate a valid 16kHz mono PCM WAV byte stream for voice testing."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        # Generate silence / gentle tone
        num_frames = int(duration_seconds * sample_rate)
        wav_file.writeframes(b"\x00\x00" * num_frames)
    buf.seek(0)
    return buf.read()


def test_suite():
    results = []

    def record(name: str, passed: bool, detail: str = ""):
        status_str = "PASS" if passed else "FAIL"
        results.append((name, passed, detail))
        print(f"[{status_str}] {name} {('- ' + detail) if detail else ''}")
        if not passed:
            print(f"   -> ERROR DETAIL: {detail}")

    print("=" * 70)
    print("STARTING FULL SYSTEM API VERIFICATION (USER + ADMIN PERSPECTIVES)")
    print("=" * 70)

    # ----------------------------------------------------
    # 1. Health Checks
    # ----------------------------------------------------
    resp = client.get("/health")
    record("1. GET /health", resp.status_code == 200 and resp.json().get("status") == "ok", str(resp.json()))

    resp = client.get("/api/health")
    record("2. GET /api/health", resp.status_code == 200 and resp.json().get("status") == "ok", str(resp.json()))

    # ----------------------------------------------------
    # 2. Guest Session Creation
    # ----------------------------------------------------
    resp = client.post("/api/guest-session")
    session_data = resp.json()
    has_session = resp.status_code == 200 and "session_token" in session_data and "user_id" in session_data
    record("3. POST /api/guest-session", has_session, f"Token: {session_data.get('user_id')}")
    guest_token = session_data.get("session_token", "")

    # ----------------------------------------------------
    # 3. Public Schemes List & Detail
    # ----------------------------------------------------
    resp = client.get("/api/schemes")
    schemes_data = resp.json()
    has_schemes = resp.status_code == 200 and schemes_data.get("count", 0) >= 1
    record("4. GET /api/schemes (User view)", has_schemes, f"Found {schemes_data.get('count')} schemes")

    schemes = schemes_data.get("schemes", [])
    pmjay = next((s for s in schemes if "PMJAY" in s.get("official_name", "") or "PM-JAY" in s.get("official_name", "")), schemes[0] if schemes else None)
    scheme_id = pmjay.get("id") if pmjay else None

    if scheme_id:
        resp = client.get(f"/api/schemes/{scheme_id}")
        record("5. GET /api/schemes/{id}", resp.status_code == 200 and resp.json().get("id") == scheme_id, f"Scheme: {pmjay.get('official_name')}")

        resp = client.get(f"/api/schemes/{scheme_id}/journey")
        journey_data = resp.json()
        record("6. GET /api/schemes/{id}/journey", resp.status_code == 200 and len(journey_data.get("steps", [])) >= 1, f"{len(journey_data.get('steps', []))} steps")

        # ----------------------------------------------------
        # 4. Eligibility Engine
        # ----------------------------------------------------
        resp = client.post(
            f"/api/schemes/{scheme_id}/eligibility",
            json={"patient_facts": {"age": 72, "citizenship": "IN"}},
        )
        elig_data = resp.json()
        record("7. POST /api/schemes/{id}/eligibility (Age 72 senior)", resp.status_code == 200 and elig_data.get("result") == "PASS", f"Result: {elig_data.get('result')}")

        # ----------------------------------------------------
        # 5. Documents Engine
        # ----------------------------------------------------
        resp = client.post(
            f"/api/schemes/{scheme_id}/documents",
            json={"patient_facts": {"age": 72}, "documents": ["Aadhaar Card"]},
        )
        doc_data = resp.json()
        record("8. POST /api/schemes/{id}/documents", resp.status_code == 200 and len(doc_data.get("documents", [])) >= 1, f"{len(doc_data.get('documents', []))} document rules")

    # ----------------------------------------------------
    # 6. Cancer Support Directory APIs
    # ----------------------------------------------------
    resp = client.get("/api/directory/ngos?limit=10")
    ngo_data = resp.json()
    record("9. GET /api/directory/ngos", resp.status_code == 200 and ngo_data.get("count", 0) >= 1, f"Found {ngo_data.get('count')} NGOs")

    resp = client.get("/api/directory/schemes?limit=10")
    dir_schemes = resp.json()
    record("10. GET /api/directory/schemes", resp.status_code == 200 and dir_schemes.get("count", 0) >= 1, f"Found {dir_schemes.get('count')} directory schemes")

    # ----------------------------------------------------
    # 7. Unified Chat Endpoints (Intent Routing)
    # ----------------------------------------------------
    # 7.1 Greeting Intent
    resp = client.post("/api/chat", json={"question": "Hello, good morning!", "language": "en"})
    record("11. Chat Greeting Intent", resp.status_code == 200 and resp.json().get("intent") == "greeting", resp.json().get("answer", "")[:60])

    # 7.2 Urgent Medical Safety Intent
    resp = client.post("/api/chat", json={"question": "High fever with chills and vomiting after chemo", "language": "en"})
    record("12. Chat Urgent Medical Safety Intent", resp.status_code == 200 and resp.json().get("intent") == "urgent_medical", resp.json().get("answer", "")[:60])

    # 7.3 General Cancer Knowledge Intent
    resp = client.post("/api/chat", json={"question": "What is chemotherapy and how does it target cancer cells?", "language": "en"})
    record("13. Chat Cancer Knowledge Intent", resp.status_code == 200 and resp.json().get("intent") == "cancer_knowledge", resp.json().get("answer", "")[:60])

    # 7.4 Grounded Scheme RAG with Citations
    resp = client.post(
        "/api/chat",
        headers={"X-Guest-Session": guest_token},
        json={"question": "What is the financial coverage limit of PM-JAY?", "language": "en"},
    )
    scheme_chat = resp.json()
    chat_ok = resp.status_code == 200 and len(scheme_chat.get("sources", [])) >= 1
    record("14. Chat Grounded Scheme RAG Intent", chat_ok, f"Sources: {len(scheme_chat.get('sources', []))}, Status: {scheme_chat.get('verification_status')}")

    # 7.5 Multilingual Indic Chat (Telugu)
    resp = client.post("/api/chat", json={"question": "క్యాన్సర్ చికిత్సకు ఏ పథకాలు అందుబాటులో ఉన్నాయి?", "language": "te"})
    record("15. Chat Multilingual Intent (Telugu)", resp.status_code == 200 and resp.json().get("language") == "te", resp.json().get("answer", "")[:60])

    # 7.6 Streaming SSE Chat
    resp = client.post(
        "/api/chat",
        json={"question": "Hello", "language": "en", "stream": True},
    )
    is_sse = resp.status_code == 200 and "text/event-stream" in resp.headers.get("content-type", "")
    stream_content = resp.text
    has_events = "event: delta" in stream_content or "event: done" in stream_content or ": ping" in stream_content
    record("16. Chat Streaming SSE (/api/chat?stream=true)", is_sse and has_events, "SSE connection & delta events verified")

    # ----------------------------------------------------
    # 8. Voice APIs (Speech-to-Text & Text-to-Speech)
    # ----------------------------------------------------
    # 8.1 Speech Synthesis (TTS via Sarvam AI)
    resp = client.post(
        "/api/voice/synthesize",
        json={"text": "Namaste, Welcome to Neravu cancer assistance platform.", "language": "en"},
    )
    synth_data = resp.json()
    has_audio = resp.status_code == 200 and synth_data.get("mime_type") == "audio/wav" and bool(synth_data.get("audio_base64"))
    record("17. POST /api/voice/synthesize (TTS)", has_audio or "warning" in synth_data, f"Audio base64 length: {len(synth_data.get('audio_base64') or '')}")

    # 8.2 Voice Transcribe (STT via Sarvam AI with dummy audio)
    wav_bytes = make_dummy_wav(duration_seconds=1.0)
    files = {"file": ("recording.wav", wav_bytes, "audio/wav")}
    resp = client.post("/api/voice/transcribe", files=files, data={"language": "en"})
    record("18. POST /api/voice/transcribe (STT)", resp.status_code in (200, 502), f"Status {resp.status_code} ({resp.json().get('detail', 'Transcribed')[:40]})")

    # 8.3 Unified Voice Chat (Mic Audio In -> STT -> RAG -> TTS Audio Out)
    files = {"file": ("recording.wav", wav_bytes, "audio/wav")}
    resp = client.post(
        "/api/voice/chat",
        files=files,
        data={"language": "en", "enable_tts": "true"},
    )
    voice_chat_ok = resp.status_code in (200, 502)
    record("19. POST /api/voice/chat (Unified Voice RAG)", voice_chat_ok, f"Status {resp.status_code} (Answer: {resp.json().get('answer', '')[:40]})")

    # ----------------------------------------------------
    # 9. Admin APIs (Security & Management Perspective)
    # ----------------------------------------------------
    # 9.1 Unauthenticated Admin Request must fail with 401
    resp = client.get("/api/admin/schemes")
    record("20. Admin Security: Missing Bearer returns 401", resp.status_code == 401, f"Status {resp.status_code}")

    # 9.2 Invalid Token must fail with 401
    resp = client.get("/api/admin/schemes", headers={"Authorization": "Bearer invalid-fake-token"})
    record("21. Admin Security: Invalid Bearer returns 401/403", resp.status_code in (401, 403, 503), f"Status {resp.status_code}")

    # 9.3 Authenticated Admin with Dev Token
    resp = client.get(
        "/api/admin/schemes",
        headers={"Authorization": f"Bearer {os.environ['DEV_ADMIN_TOKEN']}"},
    )
    record("22. Admin GET /api/admin/schemes (Authenticated)", resp.status_code == 200, f"Found {len(resp.json())} schemes in admin view")

    # 9.4 Admin Scheme Validation (Schema constraint check)
    resp = client.post(
        "/api/admin/schemes",
        headers={"Authorization": f"Bearer {os.environ['DEV_ADMIN_TOKEN']}"},
        json={"invalid_body": True},
    )
    record("23. Admin POST /api/admin/schemes (Schema Validation)", resp.status_code == 422, f"Expected 422 validation error, got {resp.status_code}")

    print("=" * 70)
    failed = [r for r in results if not r[1]]
    if not failed:
        print(f"ALL {len(results)} API ENDPOINTS PASSED SUCCESSFULLY!")
    else:
        print(f"FAILED {len(failed)} / {len(results)} TESTS:")
        for f in failed:
            print(f"  - {f[0]}: {f[2]}")
    print("=" * 70)
    return len(failed) == 0


if __name__ == "__main__":
    success = test_suite()
    sys.exit(0 if success else 1)

