
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.engine import make_url

from dotenv import load_dotenv
from pathlib import Path
import os

from app.services.rule_repository import get_verified_rules


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

with Session(engine) as db:
    rules = get_verified_rules(
        db,
        "CSV-F64FDF5C58ACCF8E2112",
    )

    print("Programme: PM-JAY")
    print("Verified rules found:", len(rules))

    for rule in rules:
        print(rule)

engine.dispose()
