
import os
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

router = APIRouter(
    prefix="/api/schemes",
    tags=["Scheme Management"],
)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)


@router.get("")
def list_schemes():
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT
                        id,
                        programme_code,
                        official_name,
                        programme_type,
                        description,
                        review_status,
                        version,
                        last_verified_at
                    FROM public.programmes
                    ORDER BY official_name
                """)
            ).mappings().all()

        return {
            "count": len(rows),
            "schemes": [dict(row) for row in rows],
        }

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        )


@router.get("/{scheme_id}")
def get_scheme(scheme_id: UUID):
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("""
                    SELECT
                        id,
                        programme_code,
                        official_name,
                        programme_type,
                        description,
                        coverage,
                        details,
                        review_status,
                        version,
                        last_verified_at
                    FROM public.programmes
                    WHERE id = :scheme_id
                """),
                {"scheme_id": str(scheme_id)},
            ).mappings().first()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Scheme not found",
            )

        return dict(row)

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        )
