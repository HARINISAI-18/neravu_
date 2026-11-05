import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from uuid import UUID

logger = logging.getLogger(__name__)

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


app = FastAPI(title="Neravu API", version="0.1.0", lifespan=lifespan)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routes.schemes import router as schemes_router
from app.routes.admin_schemes import router as admin_schemes_router
from app.routes.engines import router as engines_router

app.include_router(schemes_router)
app.include_router(admin_schemes_router)
app.include_router(engines_router)
class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    language: Literal["en", "te", "hi"] = "en"
    scheme_id: UUID | None = None
    patient_facts: dict | None = None
    document_names: list[str] | None = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/chat")
def chat(request: ChatRequest):
    try:
        from app.services.question_intent import classify_intent, safe_medical_response
        from app.services.rag_chat import chat_with_neravu

        intent = classify_intent(request.question)
        safe_response = safe_medical_response(intent, request.language)
        if intent == "urgent_medical" and safe_response is not None:
            return safe_response
        if intent == "cancer_knowledge":
            from app.services.medical_knowledge import chat_with_medical_knowledge
            return {**chat_with_medical_knowledge(request.question, request.language), "intent": intent}
        if intent == "eligibility":
            if request.scheme_id is None or request.patient_facts is None:
                return {
                    "answer": "To screen against a published scheme, provide its scheme_id and structured patient_facts. Missing facts remain unknown; do not send identity numbers or medical records.",
                    "intent": intent,
                    "verification_status": "needs_structured_input",
                }
            from app.routes.engines import EligibilityRequest, evaluate_scheme_eligibility
            result = evaluate_scheme_eligibility(
                request.scheme_id,
                EligibilityRequest(patient_facts=request.patient_facts),
            )
            return {**result, "intent": intent}
        if intent == "documents":
            if request.scheme_id is None:
                return {
                    "answer": "Provide the published scheme_id to check its evidence-backed document checklist.",
                    "intent": intent,
                    "verification_status": "needs_scheme_id",
                }
            from app.routes.engines import DocumentRequest, check_scheme_documents
            result = check_scheme_documents(
                request.scheme_id,
                DocumentRequest(
                    patient_facts=request.patient_facts or {},
                    documents=request.document_names or [],
                ),
            )
            return {**result, "intent": intent}
        response = chat_with_neravu(
            question=request.question,
            language=request.language,
        )
        return {**response, "intent": intent}

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    except HTTPException:
        raise

    except Exception:
        logger.exception("Neravu chat failed")
        raise HTTPException(
            status_code=503,
            detail="Chat service temporarily unavailable",
        )
