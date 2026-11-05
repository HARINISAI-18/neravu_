"""Conservative intent routing for backend chat requests."""

import re
from typing import Literal

Intent = Literal["urgent_medical", "greeting", "cancer_knowledge", "eligibility", "documents", "scheme"]

_URGENT_PATTERNS = (
    r"\b(chest pain|trouble breathing|difficulty breathing|cannot breathe|"
    r"uncontrolled bleeding|severe bleeding|seizure|unconscious|confusion|"
    r"high fever|severe allergic reaction|suicidal|self harm)\b",
    r"\bfever\b.*\b(38|100\.5)\b|\b(chills|shaking chills)\b.*\b(chemotherapy|cancer treatment)\b",
    r"(saans nahi|saans lene mein dikkat|behosh| दौरा|खून नहीं रुक|तेज बुखार)",
    r"(శ్వాస తీసుకోవడం కష్టం|ఊపిరి ఆడక|స్పృహ కోల్పో|తీవ్రమైన రక్తస్రావం)",
)

_GREETING_PATTERN = (
    r"^(hi|hey|hello|namaste|namaskar|namaskara|namaskaram|vanakkam|good\s+(?:morning|afternoon|evening)|"
    r"howdy|sup|hola|who\s+are\s+you|what\s+can\s+you\s+do|what\s+is\s+neravu|help|start)[\s!?.~]*$"
)

_ELIGIBILITY = r"\b(eligible|eligibility|qualify|qualification|income limit|who can apply)\b|पात्र|అర్హత"
_DOCUMENTS = r"\b(document|documents|paperwork|certificate|proof|application form)\b|दस्तावेज|పత్రాలు"
_SCHEME = r"\b(scheme|programme|program|government aid|financial assistance|hospital empanel|pm[- ]?jay|pmnrf|hmdg)\b|योजना|పథకం"
_MEDICAL = r"\b(cancer|tumou?r|chemotherapy|radiation|immunotherapy|symptom|side effect|treatment|medicine|drug|diagnos)\b|कैंसर|इलाज|लक्षण|చికిత్స|క్యాన్సర్|లక్షణాలు"


def classify_intent(question: str) -> Intent:
    value = question.strip().lower()
    if any(re.search(pattern, value, re.IGNORECASE) for pattern in _URGENT_PATTERNS):
        return "urgent_medical"
    if re.match(_GREETING_PATTERN, value, re.IGNORECASE):
        return "greeting"
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


def greeting_response(language: str = "en") -> dict:
    messages = {
        "en": (
            "Hello! I am Neravu, your cancer care financial assistance assistant.\n\n"
            "I can help you:\n"
            "• **Explore Government Schemes**: Learn about Ayushman Bharat PM-JAY, HMCPF (under RAN), PMNRF, and HMDG.\n"
            "• **Check Eligibility**: Find out income limits, hospital requirements, and patient criteria.\n"
            "• **Required Documents**: Get official checklists (income certificates, treatment estimates, ration cards).\n"
            "• **Application Steps**: Follow step-by-step guidance from hospital counters to ministry approval.\n\n"
            "What would you like to explore today?"
        ),
        "hi": (
            "नमस्ते! मैं नेरावु हूँ, आपका कैंसर उपचार वित्तीय सहायता सहायक।\n\n"
            "मैं इसमें आपकी सहायता कर सकता हूँ:\n"
            "• **सरकारी योजनाएँ खोजें**: आयुष्मान भारत PM-JAY, HMCPF (RAN के तहत), PMNRF, और HMDG के बारे में जानें।\n"
            "• **पात्रता की जाँच**: आय सीमा, अस्पताल की शर्तें और रोगी मानदंड समझें।\n"
            "• **आवश्यक दस्तावेज़**: आधिकारिक सूची प्राप्त करें (आय प्रमाण पत्र, उपचार अनुमान, राशन कार्ड)।\n"
            "• **आवेदन प्रक्रिया**: अस्पताल स्तर से मंत्रालय तक चरणबद्ध मार्गदर्शन प्राप्त करें।\n\n"
            "आज आप क्या जानना चाहते हैं?"
        ),
        "te": (
            "నమస్కారం! నేను నెరవు, మీ క్యాన్సర్ చికిత్స ఆర్థిక సహాయ సహాయకుడిని.\n\n"
            "నేను మీకు ఈ క్రింది అంశాలలో సహాయపడగలను:\n"
            "• **ప్రభుత్వ పథకాల అన్వేషణ**: ఆయుష్మాన్ భారత్ PM-JAY, HMCPF (RAN కింద), PMNRF, మరియు HMDG గురించి తెలుసుకోండి.\n"
            "• **అర్హత పరిశీలన**: ఆదాయ పరిమితులు, ఆసుపత్రి అవసరాలు మరియు రోగి ప్రమాణాలను తెలుసుకోండి.\n"
            "• **అవసరమైన పత్రాలు**: అధికారిక చెక్‌లిస్ట్‌ను పొందండి (ఆదాయ ధ్రువీకరణ పత్రం, చికిత్స అంచనా, రేషన్ కార్డు).\n"
            "• **దరఖాస్తు విధానం**: ఆసుపత్రి కౌంటర్ నుండి మంత్రిత్వ శాఖ వరకు దశల వారీ మార్గదర్శకత్వం.\n\n"
            "ఈరోజు మీరు దేని గురించి తెలుసుకోవాలనుకుంటున్నారు?"
        ),
    }
    lang = language if language in messages else "en"
    return {
        "answer": messages[lang],
        "intent": "greeting",
        "verification_status": "conversational",
        "sources": [
            {"title": "National Health Authority (PM-JAY)", "url": "https://nha.gov.in"},
            {"title": "Ministry of Health & Family Welfare (RAN/HMCPF)", "url": "https://mohfw.gov.in"},
            {"title": "Prime Minister's National Relief Fund (PMNRF)", "url": "https://pmnrf.gov.in"},
            {"title": "Health Minister's Discretionary Grant (HMDG)", "url": "https://mohfw.gov.in"}
        ],
    }


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
