
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

print("1. Python script started", flush=True)

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

print("2. ENV file:", ENV_PATH, flush=True)
print("3. ENV exists:", ENV_PATH.exists(), flush=True)

load_dotenv(ENV_PATH, override=True)

DATABASE_URL = os.getenv("DATABASE_URL")

print("4. DATABASE_URL configured:", bool(DATABASE_URL), flush=True)

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing from .env")

print("5. Connecting to PostgreSQL...", flush=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"connect_timeout": 5},
)

with engine.connect() as connection:
    result = connection.execute(
        text("SELECT current_database(), current_user")
    )
    print("6. PostgreSQL connected:", result.fetchone(), flush=True)
