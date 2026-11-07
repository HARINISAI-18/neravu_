import logging
import os
import re
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

logger = logging.getLogger(__name__)

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"

# Mapping between Sarvam BCP-47 tags and Neravu language codes
SARVAM_TO_NERAVU_LANG = {
    "te-IN": "te",
    "hi-IN": "hi",
    "en-IN": "en",
    "ta-IN": "ta",
    "kn-IN": "kn",
    "ml-IN": "ml",
    "bn-IN": "bn",
    "mr-IN": "mr",
    "gu-IN": "gu",
    "pa-IN": "pa",
    "od-IN": "od",
    "ur-IN": "ur",
}

NERAVU_TO_SARVAM_LANG = {
    "te": "te-IN",
    "hi": "hi-IN",
    "en": "en-IN",
    "ta": "ta-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "bn": "bn-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
    "pa": "pa-IN",
    "od": "od-IN",
    "ur": "ur-IN",
}


INDIC_SCRIPTS = [
    (re.compile(r'[\u0C00-\u0C7F]'), 'te'),  # Telugu
    (re.compile(r'[\u0900-\u097F]'), 'hi'),  # Devanagari (Hindi)
    (re.compile(r'[\u0B80-\u0BFF]'), 'ta'),  # Tamil
    (re.compile(r'[\u0C80-\u0CFF]'), 'kn'),  # Kannada
    (re.compile(r'[\u0D00-\u0D7F]'), 'ml'),  # Malayalam
    (re.compile(r'[\u0980-\u09FF]'), 'bn'),  # Bengali
    (re.compile(r'[\u0A80-\u0AFF]'), 'gu'),  # Gujarati
    (re.compile(r'[\u0A00-\u0A7F]'), 'pa'),  # Gurmukhi (Punjabi)
    (re.compile(r'[\u0B00-\u0B7F]'), 'od'),  # Odia
    (re.compile(r'[\u0600-\u06FF]'), 'ur'),  # Urdu / Arabic
]


def detect_indic_script(text: str) -> str | None:
    """Detect spoken Indic language directly from the unicode script of the transcribed query."""
    if not text:
        return None
    for pattern, code in INDIC_SCRIPTS:
        if pattern.search(text):
            return code
    return None


def _get_api_key() -> str:
    key = os.getenv("SARVAM_API_KEY")
    if not key:
        raise RuntimeError("SARVAM_API_KEY environment variable is not configured.")
    return key.strip()


def normalize_to_neravu_lang(sarvam_code: str | None) -> str:
    if not sarvam_code:
        return "en"
    code = sarvam_code.strip()
    if code in SARVAM_TO_NERAVU_LANG:
        return SARVAM_TO_NERAVU_LANG[code]
    prefix = code.split("-")[0].lower()
    return prefix if prefix in NERAVU_TO_SARVAM_LANG else "en"


def normalize_to_sarvam_lang(neravu_code: str | None) -> str:
    if not neravu_code:
        return "en-IN"
    code = neravu_code.strip().lower()
    if code in NERAVU_TO_SARVAM_LANG:
        return NERAVU_TO_SARVAM_LANG[code]
    if code in SARVAM_TO_NERAVU_LANG:
        return code
    return "en-IN"


def ensure_wav_bytes(audio_bytes: bytes) -> bytes:
    """
    Ensure audio bytes are valid 16kHz mono PCM WAV.
    If the audio is already a WAV file (starts with b'RIFF'), return it as-is.
    Otherwise, transcode from WebM/Opus/MP4/OGG to 16kHz mono WAV using PyAV.
    """
    if audio_bytes.startswith(b"RIFF") and len(audio_bytes) > 44:
        return audio_bytes

    try:
        import io
        import wave
        import av

        input_buf = io.BytesIO(audio_bytes)
        output_buf = io.BytesIO()

        with av.open(input_buf) as container:
            audio_streams = [s for s in container.streams if s.type == "audio"]
            if not audio_streams:
                return audio_bytes
            stream = audio_streams[0]
            resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)

            with wave.open(output_buf, "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(16000)

                for packet in container.demux(stream):
                    for frame in packet.decode():
                        for r_frame in resampler.resample(frame):
                            wav_file.writeframes(r_frame.to_ndarray().tobytes())

        output_buf.seek(0)
        wav_data = output_buf.read()
        if len(wav_data) > 44:
            return wav_data
    except Exception as exc:
        logger.warning(f"Audio transcoding to WAV failed: {exc}. Using original bytes.")

    return audio_bytes


def transcribe_audio(
    file_bytes: bytes,
    filename: str = "audio.wav",
    content_type: str = "audio/wav",
    language_code: str = "unknown",
) -> dict[str, Any]:
    """
    Transcribe speech using Sarvam AI STT API (Saaras).
    Detects language automatically when language_code='unknown'.
    """
    api_key = _get_api_key()
    model = os.getenv("SARVAM_STT_MODEL", "saaras:v3")

    # Ensure audio format is valid 16kHz PCM WAV for Sarvam AI
    processed_bytes = ensure_wav_bytes(file_bytes)

    files = {
        "file": ("recording.wav", processed_bytes, "audio/wav")
    }
    data = {
        "model": model,
        "mode": "transcribe",
    }
    if language_code and language_code not in ("auto", "unknown"):
        data["language_code"] = normalize_to_sarvam_lang(language_code)
    else:
        data["language_code"] = "unknown"

    headers = {
        "api-subscription-key": api_key,
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(
                SARVAM_STT_URL,
                headers=headers,
                files=files,
                data=data,
            )
        if response.status_code != 200:
            logger.error(f"Sarvam STT failed ({response.status_code}): {response.text}")
            raise RuntimeError(f"Speech transcription failed ({response.status_code}): {response.text[:200]}")

        res_json = response.json()
        transcript = res_json.get("transcript", "").strip()
        detected_sarvam_lang = res_json.get("language_code", "en-IN")
        neravu_lang = normalize_to_neravu_lang(detected_sarvam_lang)

        # High-confidence script check: if the transcript has native Telugu, Hindi, Tamil, etc., script
        script_lang = detect_indic_script(transcript)
        if script_lang:
            neravu_lang = script_lang
            detected_sarvam_lang = normalize_to_sarvam_lang(script_lang)

        return {
            "transcript": transcript,
            "sarvam_language_code": detected_sarvam_lang,
            "language": neravu_lang,
            "request_id": res_json.get("request_id"),
        }
    except Exception as e:
        logger.exception("Error during Sarvam audio transcription")
        raise e


def clean_text_for_speech(text: str, max_chars: int = 400) -> str:
    """
    Sanitize answer text so speech synthesis sounds fluent and natural:
    - Removes citations like [1], [2], [1, 2]
    - Removes raw URLs and markdown links [text](url)
    - Strips markdown formatting (*, #, _, `, etc.)
    - Truncates to a comfortable reading length at sentence boundaries.
    """
    if not text:
        return ""

    # Replace markdown links with just link text: [PM-JAY](https://...) -> PM-JAY
    cleaned = re.sub(r'\[([^\]]+)\]\(https?://[^\)]+\)', r'\1', text)
    # Remove raw URLs
    cleaned = re.sub(r'https?://\S+', '', cleaned)
    # Remove citation markers: [1], [2], [1, 2], [1][2]
    cleaned = re.sub(r'\[\s*\d+(?:\s*,\s*\d+)*\s*\]', '', cleaned)
    # Remove bullet symbols and markdown header symbols
    cleaned = re.sub(r'^[\s*#\-•]+', '', cleaned, flags=re.MULTILINE)
    # Remove asterisks, underscores, backticks
    cleaned = re.sub(r'[*_`~]', '', cleaned)
    # Normalize multiple whitespace and newlines into clean pauses
    cleaned = re.sub(r'\n{2,}', '. ', cleaned)
    cleaned = re.sub(r'\n+', ' ', cleaned)
    cleaned = re.sub(r'\s{2,}', ' ', cleaned).strip()

    if len(cleaned) <= max_chars:
        return cleaned

    # Truncate at last complete sentence within limit
    truncated = cleaned[:max_chars]
    sentence_ends = [m.end() for m in re.finditer(r'[.!?।]\s', truncated)]
    if sentence_ends:
        last_end = sentence_ends[-1]
        if last_end > max_chars // 2:
            return truncated[:last_end].strip()

    return truncated.strip()


def synthesize_speech(
    text: str,
    language: str = "en",
    speaker: str | None = None,
) -> str | None:
    """
    Synthesize text to speech using Sarvam AI Bulbul TTS.
    Returns base64-encoded WAV audio string, or None if failed.
    """
    if not text or not text.strip():
        return None

    cleaned_text = clean_text_for_speech(text)
    if not cleaned_text:
        return None

    api_key = _get_api_key()
    sarvam_lang = normalize_to_sarvam_lang(language)
    model = os.getenv("SARVAM_TTS_MODEL", "bulbul:v4-flash")

    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "text": cleaned_text,
        "language_code": sarvam_lang,
        "model": model,
        "speech_sample_rate": 24000,
    }
    if speaker:
        payload["speaker"] = speaker

    try:
        with httpx.Client(timeout=12.0) as client:
            response = client.post(
                SARVAM_TTS_URL,
                headers=headers,
                json=payload,
            )
        if response.status_code != 200:
            logger.warning(f"Sarvam TTS failed ({response.status_code}): {response.text[:200]}")
            return None

        data = response.json()
        audios = data.get("audios") or []
        if audios and isinstance(audios, list) and len(audios) > 0:
            return audios[0]
        return None
    except Exception as e:
        logger.warning(f"Failed to synthesize speech via Sarvam TTS: {e}")
        return None
