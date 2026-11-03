
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.models.knowledge import Programme


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

database_url = os.getenv("SUPABASE_DATABASE_URL")

if not database_url:
    raise RuntimeError("SUPABASE_DATABASE_URL missing")

host = (make_url(database_url).host or "").lower()

if not host.endswith(".supabase.com"):
    raise RuntimeError("Expected a Supabase database host")

engine = create_engine(
    database_url,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 10},
)

programme_code = "CSV-F64FDF5C58ACCF8E2112"

questions = [
    "What age or demographic requirements apply?",
    "What income or socioeconomic criteria apply?",
    "What residence or citizenship requirements apply?",
    "What cancer diagnosis or medical criteria apply?",
    "Which structured eligibility-rule definitions apply?",
]

with Session(engine) as db:
    programme = db.scalar(
        select(Programme).where(
            Programme.programme_code == programme_code
        )
    )

    if programme is None:
        raise RuntimeError("PM-JAY programme not found")

    print("Programme:", programme.official_name)
    print("Review status:", programme.review_status)

    details = programme.details or {}

    # Support both direct questionnaire JSON and nested answers.
    if "answers" in details and isinstance(details["answers"], dict):
        answers = details["answers"]
    else:
        answers = details

    print("Stored top-level fields:", len(details))

    for question in questions:
        print("\nQUESTION:", question)
        print("ANSWER:", answers.get(question, "NOT FOUND"))

engine.dispose()
