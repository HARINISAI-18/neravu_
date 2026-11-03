
import logging
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Neravu API",
    version="0.1.0",
)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    language: Literal["en", "te", "hi"] = "en"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/chat")
def chat(request: ChatRequest):
    try:
        from app.services.rag_chat import chat_with_neravu

        return chat_with_neravu(
            question=request.question,
            language=request.language,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception:
        logger.exception("Neravu chat failed")

        raise HTTPException(
            status_code=503,
            detail="Chat service temporarily unavailable",
        )
