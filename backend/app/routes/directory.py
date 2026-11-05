"""Directory API endpoints for India Cancer Support Directory tables in Supabase."""

from datetime import date
from typing import Any
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.routes.schemes import engine

router = APIRouter(tags=["Cancer Support Directory"])


@router.get("/api/directory/ngos")
@router.get("/api/ngos")
def list_ngos(
    state: str | None = Query(default=None, description="Filter by state or coverage"),
    support_type: str | None = Query(default=None, description="Filter by support type"),
    direct_aid: str | None = Query(default=None, description="Filter by direct financial aid (Yes/No)"),
    search: str | None = Query(default=None, description="Search organization name or city"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    try:
        with engine.connect() as conn:
            clauses = ["1=1"]
            params: dict[str, Any] = {"limit": limit, "offset": offset}

            if state:
                clauses.append("(state_coverage ILIKE :state OR state_coverage ILIKE '%All India%' OR state_coverage ILIKE '%Multiple states%')")
                params["state"] = f"%{state.strip()}%"

            if support_type:
                clauses.append("support_type ILIKE :support_type")
                params["support_type"] = f"%{support_type.strip()}%"

            if direct_aid:
                clauses.append("direct_financial_aid ILIKE :direct_aid")
                params["direct_aid"] = f"%{direct_aid.strip()}%"

            if search:
                clauses.append("(organization_name ILIKE :search OR city_district ILIKE :search OR what_support_offered ILIKE :search)")
                params["search"] = f"%{search.strip()}%"

            where_sql = " AND ".join(clauses)

            total = conn.execute(
                text(f"SELECT COUNT(*) FROM public.ngo_directory WHERE {where_sql}"),
                params
            ).scalar_one()

            rows = conn.execute(
                text(f"""
                    SELECT id, organization_name, organization_type, state_coverage,
                           city_district, support_type, what_support_offered,
                           direct_financial_aid, aid_amount_limit, eligibility,
                           hospital_restrictions, contact_phone, contact_email,
                           address, website_url, application_route,
                           verification_status, last_checked, source_notes
                    FROM public.ngo_directory
                    WHERE {where_sql}
                    ORDER BY organization_name ASC
                    LIMIT :limit OFFSET :offset
                """),
                params
            ).mappings().all()

        return {
            "total": total,
            "count": len(rows),
            "limit": limit,
            "offset": offset,
            "ngos": [dict(r) for r in rows],
        }
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.get("/api/directory/schemes")
def list_directory_schemes(
    level: str | None = Query(default=None, description="Central or State"),
    state: str | None = Query(default=None, description="State coverage"),
    search: str | None = Query(default=None, description="Search scheme name or benefits"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    try:
        with engine.connect() as conn:
            clauses = ["1=1"]
            params: dict[str, Any] = {"limit": limit, "offset": offset}

            if level:
                clauses.append("government_level ILIKE :level")
                params["level"] = f"%{level.strip()}%"

            if state:
                clauses.append("(state_coverage ILIKE :state OR state_coverage ILIKE '%All India%' OR state_coverage ILIKE '%Participating%')")
                params["state"] = f"%{state.strip()}%"

            if search:
                clauses.append("(scheme_name ILIKE :search OR benefit_type ILIKE :search OR published_benefit_limit ILIKE :search)")
                params["search"] = f"%{search.strip()}%"

            where_sql = " AND ".join(clauses)

            total = conn.execute(
                text(f"SELECT COUNT(*) FROM public.government_schemes_directory WHERE {where_sql}"),
                params
            ).scalar_one()

            rows = conn.execute(
                text(f"""
                    SELECT id, scheme_name, government_level, state_coverage,
                           benefit_type, published_benefit_limit, cancer_covered,
                           eligibility_summary, documents_required, application_route,
                           official_link, helpline_contact, verification_status,
                           last_checked, source_notes
                    FROM public.government_schemes_directory
                    WHERE {where_sql}
                    ORDER BY government_level ASC, scheme_name ASC
                    LIMIT :limit OFFSET :offset
                """),
                params
            ).mappings().all()

        return {
            "total": total,
            "count": len(rows),
            "limit": limit,
            "offset": offset,
            "schemes": [dict(r) for r in rows],
        }
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.get("/api/directory/states")
@router.get("/api/states")
def list_states():
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT id, state_name, local_ngo_records, known_national_ngo_coverage,
                           state_government_scheme_lead, research_completeness, next_action_notes,
                           updated_at
                    FROM public.state_research_tracker
                    ORDER BY state_name ASC
                """)
            ).mappings().all()
        return {
            "count": len(rows),
            "states": [dict(r) for r in rows],
        }
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.get("/api/directory/sources")
def list_sources():
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT id, source_publisher, source_type, url,
                           what_it_supports, checked_date, notes
                    FROM public.source_registry
                    ORDER BY source_publisher ASC
                """)
            ).mappings().all()
        return {
            "count": len(rows),
            "sources": [dict(r) for r in rows],
        }
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.get("/api/directory/taxonomies")
@router.get("/api/taxonomies")
def list_taxonomies():
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT category, value
                    FROM public.controlled_taxonomies
                    ORDER BY category ASC, value ASC
                """)
            ).mappings().all()

        grouped: dict[str, list[str]] = {}
        for r in rows:
            cat = r["category"]
            grouped.setdefault(cat, []).append(r["value"])

        return {
            "categories": grouped
        }
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.get("/api/directory/metadata")
def list_metadata():
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("SELECT key, value, category, updated_at FROM public.directory_metadata ORDER BY key ASC")
            ).mappings().all()
        return {
            "metadata": [dict(r) for r in rows]
        }
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error

