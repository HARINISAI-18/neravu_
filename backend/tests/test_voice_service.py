import pytest
from app.services.voice_service import (
    clean_text_for_speech,
    normalize_to_neravu_lang,
    normalize_to_sarvam_lang,
)


def test_language_mappings():
    assert normalize_to_sarvam_lang("te") == "te-IN"
    assert normalize_to_sarvam_lang("hi") == "hi-IN"
    assert normalize_to_sarvam_lang("en") == "en-IN"
    assert normalize_to_sarvam_lang("ta") == "ta-IN"
    assert normalize_to_sarvam_lang("kn") == "kn-IN"
    assert normalize_to_sarvam_lang("unknown_lang") == "en-IN"

    assert normalize_to_neravu_lang("te-IN") == "te"
    assert normalize_to_neravu_lang("hi-IN") == "hi"
    assert normalize_to_neravu_lang("en-IN") == "en"
    assert normalize_to_neravu_lang("ta-IN") == "ta"
    assert normalize_to_neravu_lang("kn-IN") == "kn"
    assert normalize_to_neravu_lang(None) == "en"


def test_clean_text_for_speech():
    raw_rag_text = (
        "Under PM-JAY [1], cancer patients get free treatment up to ₹5 lakh per family per year [2]. "
        "Official guidelines can be found at [National Health Authority](https://pmjay.gov.in/guidelines). "
        "**Key benefits:**\n"
        "- Hospitalization coverage [1, 3]\n"
        "- Diagnostic procedures\n\n"
        "Contact your nearest empanelled hospital for enrollment."
    )
    cleaned = clean_text_for_speech(raw_rag_text)

    # Citations like [1], [2], [1, 3] should be removed
    assert "[1]" not in cleaned
    assert "[2]" not in cleaned
    assert "[1, 3]" not in cleaned
    # Markdown links and raw URLs should be converted/stripped
    assert "https://" not in cleaned
    assert "National Health Authority" in cleaned
    # Asterisks should be removed
    assert "**" not in cleaned
    assert "Key benefits" in cleaned


def test_clean_text_truncation():
    long_text = "This is a sentence about cancer care support in India. " * 50
    cleaned = clean_text_for_speech(long_text, max_chars=200)
    assert len(cleaned) <= 200
    assert cleaned.endswith(".")



def test_detect_indic_script():
    from app.services.voice_service import detect_indic_script
    assert detect_indic_script("నమస్తే, ఆరోగ్యశ్రీ పథకం వివరాలు కావాలి") == "te"
    assert detect_indic_script("नमस्ते, कैंसर के इलाज के लिए सहायता चाहिए") == "hi"
    assert detect_indic_script("வணக்கம், புற்றுநோய் சிகிச்சை உதவி") == "ta"
    assert detect_indic_script("ನಮಸ್ಕಾರ, ಚಿಕಿತ್ಸೆ ಮಾಹಿತಿ") == "kn"
    assert detect_indic_script("Hello, how to apply for PMJAY?") is None
