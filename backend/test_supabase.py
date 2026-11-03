import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(
    Path(__file__).resolve().parents[1] / ".env"
)

url = os.getenv("SUPABASE_DATABASE_URL")

if not url:
    raise RuntimeError("SUPABASE_DATABASE_URL is missing")

engine = create_engine(
    url,
    connect_args={"connect_timeout": 10},
    pool_pre_ping=True,
)

print("Connecting to Supabase...", flush=True)

with engine.connect() as conn:
    result = conn.execute(
        text("SELECT current_database(), current_user")
    ).one()

    print("Connected successfully!", flush=True)
    print("Database:", result[0])
    print("User:", result[1])

engine.dispose()