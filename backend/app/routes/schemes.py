
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.db.config import get_database_engine

router = APIRouter(
    prefix="/api/schemes",
    tags=["Scheme Management"],
)

engine = get_database_engine()


@router.get("")
def list_schemes():
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT
                        p.id,
                        v.snapshot #>> '{programme,programme_code}' AS programme_code,
                        v.snapshot #>> '{programme,official_name}' AS official_name,
                        v.snapshot #>> '{programme,programme_type}' AS programme_type,
                        v.snapshot #>> '{programme,description}' AS description,
                        'verified'::text AS review_status,
                        p.current_published_version AS version,
                        p.last_verified_at
                    FROM public.programmes p
                    JOIN public.scheme_publication_versions v
                      ON v.programme_id = p.id
                     AND v.version_number = p.current_published_version
                     AND v.index_status = 'ready'
                    WHERE NOT EXISTS (
                        SELECT 1 FROM jsonb_array_elements(v.snapshot -> 'sources') source
                        WHERE source ->> 'evidence_status' <> 'approved'
                           OR (source ->> 'review_expires_at')::date < CURRENT_DATE
                    )
                    ORDER BY v.snapshot #>> '{programme,official_name}'
                    LIMIT 100
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
                        p.id,
                        v.snapshot #>> '{programme,programme_code}' AS programme_code,
                        v.snapshot #>> '{programme,official_name}' AS official_name,
                        v.snapshot #>> '{programme,programme_type}' AS programme_type,
                        v.snapshot #>> '{programme,description}' AS description,
                        v.snapshot #> '{programme,coverage}' AS coverage,
                        v.snapshot #> '{programme,details}' AS details,
                        'verified'::text AS review_status,
                        p.current_published_version AS version,
                        v.published_at AS last_verified_at,
                        v.snapshot #> '{sources}' AS evidence_sources
                    FROM public.programmes p
                    JOIN public.scheme_publication_versions v
                      ON v.programme_id = p.id
                     AND v.version_number = p.current_published_version
                     AND v.index_status = 'ready'
                    WHERE p.id = :scheme_id
                      AND NOT EXISTS (
                          SELECT 1 FROM jsonb_array_elements(v.snapshot -> 'sources') source
                          WHERE source ->> 'evidence_status' <> 'approved'
                             OR (source ->> 'review_expires_at')::date < CURRENT_DATE
                      )
                """),
                {"scheme_id": str(scheme_id)},
            ).mappings().first()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Scheme not found",
            )

        return dict(row)

    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        )
