"""Conservative intent routing for backend chat requests."""

import re
from typing import Literal

Intent = Literal["urgent_medical", "cancer_knowledge", "eligibility", "documents", "scheme"]

_URGENT_PATTERNS = (
    r"\b(chest pain|trouble breathing|difficulty breathing|cannot breathe|"
    r"uncontrolled bleeding|severe bleeding|seizure|unconscious|confusion|"
    r"high fever|severe allergic reaction|suicidal|self harm)\b",
    r"\bfever\b.*\b(38|100\.5)\b|\b(chills|shaking chills)\b.*\b(chemotherapy|cancer treatment)\b",
    r"(saans nahi|saans lene mein dikkat|behosh| दौरा|खून नहीं रुक|तेज बुखार)",
    r"(శ్వాస తీసుకోవడం కష్టం|ఊపిరి ఆడక|స్పృహ కోల్పో|తీవ్రమైన రక్తస్రావం)",
)
_ELIGIBILITY = r"\b(eligible|eligibility|qualify|qualification|income limit|who can apply)\b|पात्र|అర్హత"
_DOCUMENTS = r"\b(document|documents|paperwork|certificate|proof|application form)\b|दस्तावेज|పత్రాలు"
_SCHEME = r"\b(scheme|programme|program|government aid|financial assistance|hospital empanel|pm[- ]?jay|pmnrf|hmdg)\b|योजना|పథకం"
_MEDICAL = r"\b(cancer|tumou?r|chemotherapy|radiation|immunotherapy|symptom|side effect|treatment|medicine|drug|diagnos)\b|कैंसर|इलाज|लक्षण|చికిత్స|క్యాన్సర్|లక్షణాలు"


def classify_intent(question: str) -> Intent:
    value = question.strip().lower()
    if any(re.search(pattern, value, re.IGNORECASE) for pattern in _URGENT_PATTERNS):
        return "urgent_medical"
    scheme_context = re.search(_SCHEME, value, re.IGNORECASE) is not None
    medical_context = re.search(_MEDICAL, value, re.IGNORECASE) is not None
    if re.search(_ELIGIBILITY, value, re.IGNORECASE) and (scheme_context or not medical_context):
        return "eligibility"
    if re.search(_DOCUMENTS, value, re.IGNORECASE) and (scheme_context or not medical_context):
        return "documents"
    if re.search(_SCHEME, value, re.IGNORECASE):
        return "scheme"
    if re.search(_MEDICAL, value, re.IGNORECASE):
        return "cancer_knowledge"
    return "scheme"


def safe_medical_response(intent: Intent, language: str) -> dict | None:
    if intent == "urgent_medical":
        messages = {
            "en": "This may need urgent medical attention. Contact your oncology care team or local emergency services now. Do not wait for this chat to assess symptoms.",
            "hi": "यह स्थिति तुरंत चिकित्सा सहायता मांग सकती है। अभी अपने कैंसर उपचार दल या स्थानीय आपातकालीन सेवा से संपर्क करें। चैट में उत्तर की प्रतीक्षा न करें।",
            "te": "ఇది అత్యవసర వైద్య సహాయం అవసరమయ్యే పరిస్థితి కావచ్చు. వెంటనే మీ క్యాన్సర్ వైద్య బృందాన్ని లేదా స్థానిక అత్యవసర సేవలను సంప్రదించండి. ఈ చాట్ సమాధానం కోసం వేచి ఉండకండి.",
        }
        return {
            "answer": messages[language],
            "intent": intent,
            "verification_status": "safety_routed",
            "sources": [],
        }
    if intent == "cancer_knowledge":
        messages = {
            "en": "I can’t verify general cancer information from a curated medical source in this service yet. Please ask your oncology team or pharmacist, especially before changing treatment or medicines.",
            "hi": "इस सेवा में सामान्य कैंसर जानकारी के लिए सत्यापित चिकित्सा स्रोत अभी उपलब्ध नहीं है। उपचार या दवा बदलने से पहले अपनी ऑन्कोलॉजी टीम या फार्मासिस्ट से पूछें।",
            "te": "ఈ సేవలో సాధారణ క్యాన్సర్ సమాచారానికి ధృవీకరించిన వైద్య ఆధారాలు ప్రస్తుతం లేవు. చికిత్స లేదా మందులు మార్చే ముందు మీ ఆంకాలజీ బృందం లేదా ఫార్మసిస్ట్‌ను సంప్రదించండి.",
        }
        return {
            "answer": messages[language],
            "intent": intent,
            "verification_status": "no_curated_medical_evidence",
            "sources": [],
        }
    return None
