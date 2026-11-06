import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_voice_transcribe_empty_file():
    response = client.post(
        "/api/voice/transcribe",
        files={"file": ("empty.wav", b"", "audio/wav")},
    )
    assert response.status_code == 422


def test_voice_chat_empty_file():
    response = client.post(
        "/api/voice/chat",
        files={"file": ("empty.wav", b"", "audio/wav")},
        data={"language": "en"},
    )
    assert response.status_code == 422


def test_voice_synthesize_validation():
    # Missing required 'text' field
    response = client.post(
        "/api/voice/synthesize",
        json={"language": "en"},
    )
    assert response.status_code == 422

