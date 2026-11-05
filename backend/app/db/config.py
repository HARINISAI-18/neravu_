"""Shared backend database configuration and bounded connection setup."""

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url


BACKEND_ROOT = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_ROOT.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_ROOT / ".env")


def get_database_target() -> str:
    target = os.getenv("NERAVU_DB_TARGET", "local").strip().lower()
    if target not in {"local", "supabase"}:
        raise RuntimeError("NERAVU_DB_TARGET must be 'local' or 'supabase'")
    return target


def get_database_url() -> URL:
    target = get_database_target()
    variable = "DATABASE_URL" if target == "local" else "SUPABASE_DATABASE_URL"
    value = os.getenv(variable)
    if not value:
        raise RuntimeError(f"{variable} is missing")

    url = make_url(value)
    hostname = (url.host or "").lower()
    if target == "local" and hostname not in {"localhost", "127.0.0.1"}:
        raise RuntimeError("Local database target must use localhost or 127.0.0.1")
    if target == "supabase" and not hostname.endswith(".supabase.com"):
        raise RuntimeError("Supabase database target must use a Supabase host")
    return url


@lru_cache(maxsize=1)
def get_database_engine():
    url = get_database_url()
    connect_args = {}
    if url.get_backend_name() == "postgresql":
        connect_args = {
            "connect_timeout": 15,
            "options": "-c statement_timeout=10000",
        }
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_timeout=15,
        pool_recycle=900,
        connect_args=connect_args,
    )
