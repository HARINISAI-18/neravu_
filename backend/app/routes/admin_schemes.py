"""Authenticated draft scheme CRUD endpoints."""

import json
from datetime import date, datetime, timezone
from typing import Any, Literal
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.auth import AdminPrincipal, require_admin
from app.routes.schemes import engine


router = APIRouter(
    prefix="/api/admin/schemes",
    tags=["Admin Scheme Management"],
)


class OrganizationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=300)
    organization_type: str = Field(min_length=1, max_length=100)
    official_website: str | None = Field(default=None, max_length=2048)
    contact_email: str | None = Field(default=None, max_length=320)
    contact_phone: str | None = Field(default=None, max_length=50)

    @field_validator("name", "organization_type")
    @classmethod
    def strip_organization_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value cannot be blank")
        return cleaned


class SchemeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    programme_code: str = Field(min_length=1, max_length=100)
    organization_id: UUID | None = None
    organization: OrganizationInput | None = None
    official_name: str = Field(min_length=1, max_length=300)
    programme_type: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=10000)
    coverage: dict[str, Any] = Field(default_factory=dict)
    details: dict[str, Any] = Field(default_factory=dict)

    @field_validator("programme_code", "official_name", "programme_type")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value cannot be blank")
        return cleaned

    @model_validator(mode="after")
    def require_organization_reference(self):
        if (self.organization_id is None) == (self.organization is None):
            raise ValueError("Provide exactly one of organization_id or organization")
        return self


class SchemeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    programme_code: str | None = Field(default=None, min_length=1, max_length=100)
    organization_id: UUID | None = None
    official_name: str | None = Field(default=None, min_length=1, max_length=300)
    programme_type: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=10000)
    coverage: dict[str, Any] | None = None
    details: dict[str, Any] | None = None

    @field_validator("programme_code", "official_name", "programme_type")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value cannot be blank")
        return cleaned


class SourceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_title: str = Field(min_length=1, max_length=500)
    source_url: str = Field(min_length=1, max_length=2048)
    issuing_body: str = Field(min_length=1, max_length=300)
    storage_path: str | None = Field(default=None, max_length=2048)
    page_reference: str | None = Field(default=None, max_length=500)
    effective_date: date | None = None

    @field_validator("source_title", "issuing_body")
    @classmethod
    def strip_source_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Source title cannot be blank")
        return cleaned

    @field_validator("source_url")
    @classmethod
    def require_https_source_url(cls, value: str) -> str:
        parsed = urlparse(value.strip())
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Source URL must be an HTTPS URL without embedded credentials")
        return value.strip()


class SourceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_title: str | None = Field(default=None, min_length=1, max_length=500)
    source_url: str | None = Field(default=None, min_length=1, max_length=2048)
    issuing_body: str | None = Field(default=None, min_length=1, max_length=300)
    storage_path: str | None = Field(default=None, max_length=2048)
    page_reference: str | None = Field(default=None, max_length=500)
    effective_date: date | None = None

    @field_validator("source_title", "issuing_body")
    @classmethod
    def strip_optional_source_title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Source title cannot be blank")
        return cleaned

    @field_validator("source_url")
    @classmethod
    def validate_optional_source_url(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return SourceCreate.require_https_source_url(value)


class EvidenceClaimCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_id: UUID
    field_path: str = Field(min_length=1, max_length=300)
    claim_text: str = Field(min_length=1, max_length=5000)
    structured_value: Any = None
    source_locator: str = Field(min_length=1, max_length=500)
    is_critical: bool = True

    @field_validator("field_path", "claim_text", "source_locator")
    @classmethod
    def strip_claim_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value cannot be blank")
        return cleaned


class EvidenceClaimUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_id: UUID | None = None
    field_path: str | None = Field(default=None, min_length=1, max_length=300)
    claim_text: str | None = Field(default=None, min_length=1, max_length=5000)
    structured_value: Any = None
    source_locator: str | None = Field(default=None, min_length=1, max_length=500)
    is_critical: bool | None = None

    @field_validator("field_path", "claim_text", "source_locator")
    @classmethod
    def strip_optional_claim_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Value cannot be blank")
        return cleaned


class EligibilityRuleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rule_type: str = Field(min_length=1, max_length=100)
    source_id: UUID
    rule_definition: dict[str, Any]
    explanation: str = Field(min_length=1, max_length=5000)
    source_reference: str = Field(min_length=1, max_length=500)


class DocumentRequirementCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_name: str = Field(min_length=1, max_length=300)
    source_id: UUID
    required_when: dict[str, Any] | None = None
    accepted_alternatives: list[str] = Field(default_factory=list, max_length=20)
    source_reference: str = Field(min_length=1, max_length=500)


class EvidenceDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["approved", "rejected"]
    reason: str | None = Field(default=None, max_length=5000)
    review_expires_at: date | None = None


def _snapshot(row: dict[str, Any]) -> str:
    return json.dumps(jsonable_encoder(row), ensure_ascii=False)


def _write_audit(
    connection,
    *,
    programme_id: UUID,
    actor: AdminPrincipal,
    action: str,
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
) -> None:
    connection.execute(
        text("""
            INSERT INTO public.scheme_admin_audit_events (
                programme_id, actor_user_id, action,
                before_snapshot, after_snapshot
            ) VALUES (
                :programme_id, :actor_user_id, :action,
                CAST(:before_snapshot AS jsonb),
                CAST(:after_snapshot AS jsonb)
            )
        """),
        {
            "programme_id": str(programme_id),
            "actor_user_id": actor.user_id,
            "action": action,
            "before_snapshot": _snapshot(before) if before is not None else None,
            "after_snapshot": _snapshot(after) if after is not None else None,
        },
    )


def _get_draft_for_update(connection, scheme_id: UUID) -> dict[str, Any]:
    row = connection.execute(
        text("""
            SELECT id, programme_code, organization_id, official_name,
                   programme_type, description, coverage, details,
                   review_status, version, last_verified_at, created_at, updated_at
            FROM public.programmes
            WHERE id = :scheme_id
            FOR UPDATE
        """),
        {"scheme_id": str(scheme_id)},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="Scheme not found")
    result = dict(row)
    if result["review_status"] != "draft":
        raise HTTPException(
            status_code=409,
            detail="Only draft schemes can be edited or deleted",
        )
    return result


def _bump_scheme_version(connection, scheme_id: UUID) -> None:
    connection.execute(
        text("""
            UPDATE public.programmes
            SET version = version + 1, updated_at = now()
            WHERE id = :scheme_id
        """),
        {"scheme_id": str(scheme_id)},
    )


def _append_evidence_review(
    connection,
    *,
    programme_id: UUID,
    target_type: str,
    target_id: UUID,
    decision: str,
    actor: AdminPrincipal,
    reason: str | None,
    target_snapshot: dict[str, Any],
    source_snapshot: dict[str, Any] | None,
) -> None:
    connection.execute(
        text("""
            INSERT INTO public.scheme_evidence_reviews (
                programme_id, target_type, target_id, decision,
                reviewer_user_id, reason, target_snapshot, source_snapshot
            ) VALUES (
                :programme_id, :target_type, :target_id, :decision,
                :reviewer_user_id, :reason,
                CAST(:target_snapshot AS jsonb), CAST(:source_snapshot AS jsonb)
            )
        """),
        {
            "programme_id": str(programme_id),
            "target_type": target_type,
            "target_id": str(target_id),
            "decision": decision,
            "reviewer_user_id": actor.user_id,
            "reason": reason,
            "target_snapshot": _snapshot(target_snapshot),
            "source_snapshot": _snapshot(source_snapshot) if source_snapshot else None,
        },
    )


@router.get("")
def list_admin_schemes(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    actor: AdminPrincipal = Depends(require_admin),
):
    del actor
    try:
        with engine.connect() as connection:
            total = connection.execute(
                text("SELECT COUNT(*) FROM public.programmes")
            ).scalar_one()
            rows = connection.execute(
                text("""
                    SELECT id, programme_code, organization_id, official_name,
                           programme_type, description, review_status, version,
                           last_verified_at, created_at, updated_at
                    FROM public.programmes
                    ORDER BY official_name
                    LIMIT :limit OFFSET :offset
                """),
                {"limit": limit, "offset": offset},
            ).mappings().all()
        return {"count": total, "limit": limit, "offset": offset,
                "schemes": [dict(row) for row in rows]}
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.get("/{scheme_id}/history")
def get_admin_scheme_history(
    scheme_id: UUID,
    limit: int = Query(default=100, ge=1, le=500),
    actor: AdminPrincipal = Depends(require_admin),
):
    del actor
    try:
        with engine.connect() as connection:
            exists = connection.execute(
                text("SELECT EXISTS (SELECT 1 FROM public.programmes WHERE id = :id)"),
                {"id": str(scheme_id)},
            ).scalar_one()
            if not exists:
                raise HTTPException(404, "Scheme not found")
            events = connection.execute(text("""
                SELECT id, actor_user_id, action, before_snapshot,
                       after_snapshot, created_at
                FROM public.scheme_admin_audit_events
                WHERE programme_id = :programme_id
                ORDER BY created_at DESC, id DESC
                LIMIT :limit
            """), {"programme_id": str(scheme_id), "limit": limit}).mappings().all()
            publications = connection.execute(text("""
                SELECT version_number, published_by, published_at, index_status, indexed_at
                FROM public.scheme_publication_versions
                WHERE programme_id = :programme_id
                ORDER BY version_number DESC
                LIMIT :limit
            """), {"programme_id": str(scheme_id), "limit": limit}).mappings().all()
            reviews = connection.execute(text("""
                SELECT id, target_type, target_id, decision, reviewer_user_id,
                       reason, target_snapshot, source_snapshot, reviewed_at
                FROM public.scheme_evidence_reviews
                WHERE programme_id = :programme_id
                ORDER BY reviewed_at DESC, id DESC
                LIMIT :limit
            """), {"programme_id": str(scheme_id), "limit": limit}).mappings().all()
        return {
            "scheme_id": str(scheme_id),
            "audit_events": [dict(row) for row in events],
            "evidence_reviews": [dict(row) for row in reviews],
            "publication_versions": [dict(row) for row in publications],
        }
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.get("/{scheme_id}")
def get_admin_scheme(
    scheme_id: UUID,
    actor: AdminPrincipal = Depends(require_admin),
):
    del actor
    try:
        with engine.connect() as connection:
            row = connection.execute(
                text("""
                    SELECT id, programme_code, organization_id, official_name,
                           programme_type, description, coverage, details,
                           review_status, version, last_verified_at,
                           created_at, updated_at
                    FROM public.programmes WHERE id = :scheme_id
                """),
                {"scheme_id": str(scheme_id)},
            ).mappings().first()
        if row is None:
            raise HTTPException(404, "Scheme not found")
        return dict(row)
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.post("", status_code=status.HTTP_201_CREATED)
def create_admin_scheme(
    payload: SchemeCreate,
    actor: AdminPrincipal = Depends(require_admin),
):
    try:
        with engine.begin() as connection:
            organization_id = payload.organization_id
            if organization_id is None:
                organization_data = payload.organization.model_dump()
                organization_row = connection.execute(
                    text("""
                        SELECT id FROM public.organizations
                        WHERE name = :name AND organization_type = :organization_type
                        ORDER BY created_at LIMIT 1
                    """),
                    {
                        "name": organization_data["name"],
                        "organization_type": organization_data["organization_type"],
                    },
                ).first()
                if organization_row is None:
                    organization_id = connection.execute(
                        text("""
                            INSERT INTO public.organizations (
                                name, organization_type, official_website,
                                contact_email, contact_phone
                            ) VALUES (
                                :name, :organization_type, :official_website,
                                :contact_email, :contact_phone
                            ) RETURNING id
                        """),
                        organization_data,
                    ).scalar_one()
                else:
                    organization_id = organization_row[0]
            else:
                organization_exists = connection.execute(
                    text("SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = :id)"),
                    {"id": str(organization_id)},
                ).scalar_one()
                if not organization_exists:
                    raise HTTPException(404, "Organization not found")

            row = connection.execute(
                text("""
                    INSERT INTO public.programmes (
                        programme_code, organization_id, official_name,
                        programme_type, description, coverage, details,
                        review_status, version
                    ) VALUES (
                        :programme_code, :organization_id, :official_name,
                        :programme_type, :description,
                        CAST(:coverage AS jsonb), CAST(:details AS jsonb),
                        'draft', 1
                    ) RETURNING id, programme_code, organization_id,
                        official_name, programme_type, description, coverage,
                        details, review_status, version, last_verified_at,
                        created_at, updated_at
                """),
                {
                    **payload.model_dump(exclude={"coverage", "details", "organization", "organization_id"}),
                    "organization_id": str(organization_id),
                    "coverage": json.dumps(payload.coverage, ensure_ascii=False),
                    "details": json.dumps(payload.details, ensure_ascii=False),
                },
            ).mappings().one()
            created = dict(row)
            _write_audit(
                connection,
                programme_id=created["id"],
                actor=actor,
                action="created",
                before=None,
                after=created,
            )
        return created
    except IntegrityError as error:
        raise HTTPException(409, "Programme code already exists or violates a database constraint") from error
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.patch("/{scheme_id}")
def update_admin_scheme(
    scheme_id: UUID,
    payload: SchemeUpdate,
    actor: AdminPrincipal = Depends(require_admin),
):
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "At least one field must be provided")
    for field in ("programme_code", "organization_id", "official_name", "programme_type", "coverage", "details"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be null")

    try:
        with engine.begin() as connection:
            before = _get_draft_for_update(connection, scheme_id)
            if "organization_id" in changes:
                exists = connection.execute(
                    text("SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = :id)"),
                    {"id": str(changes["organization_id"])},
                ).scalar_one()
                if not exists:
                    raise HTTPException(404, "Organization not found")

            assignments = []
            parameters: dict[str, Any] = {"scheme_id": str(scheme_id)}
            for field, value in changes.items():
                if field in {"coverage", "details"}:
                    assignments.append(f"{field} = CAST(:{field} AS jsonb)")
                    parameters[field] = json.dumps(value, ensure_ascii=False)
                elif field == "organization_id":
                    assignments.append("organization_id = :organization_id")
                    parameters[field] = str(value)
                else:
                    assignments.append(f"{field} = :{field}")
                    parameters[field] = value

            row = connection.execute(
                text(f"""
                    UPDATE public.programmes
                    SET {', '.join(assignments)}, version = version + 1,
                        updated_at = now()
                    WHERE id = :scheme_id
                    RETURNING id, programme_code, organization_id,
                        official_name, programme_type, description, coverage,
                        details, review_status, version, last_verified_at,
                        created_at, updated_at
                """),
                parameters,
            ).mappings().one()
            after = dict(row)
            _write_audit(
                connection,
                programme_id=scheme_id,
                actor=actor,
                action="updated",
                before=before,
                after=after,
            )
        return after
    except HTTPException:
        raise
    except IntegrityError as error:
        raise HTTPException(409, "Programme code already exists or violates a database constraint") from error
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.delete("/{scheme_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_scheme(
    scheme_id: UUID,
    actor: AdminPrincipal = Depends(require_admin),
):
    try:
        with engine.begin() as connection:
            before = _get_draft_for_update(connection, scheme_id)
            _write_audit(
                connection,
                programme_id=scheme_id,
                actor=actor,
                action="deleted",
                before=before,
                after=None,
            )
            connection.execute(
                text("DELETE FROM public.programmes WHERE id = :scheme_id"),
                {"scheme_id": str(scheme_id)},
            )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.get("/{scheme_id}/sources")
def list_admin_scheme_sources(
    scheme_id: UUID,
    actor: AdminPrincipal = Depends(require_admin),
):
    del actor
    try:
        with engine.connect() as connection:
            exists = connection.execute(
                text("SELECT EXISTS (SELECT 1 FROM public.programmes WHERE id = :id)"),
                {"id": str(scheme_id)},
            ).scalar_one()
            if not exists:
                raise HTTPException(404, "Scheme not found")
            rows = connection.execute(
                text("""
                    SELECT id, programme_id, source_title, source_url,
                           issuing_body, storage_path, page_reference,
                           effective_date, evidence_status, reviewed_by,
                           reviewed_at, review_expires_at, verified_at, created_at
                    FROM public.programme_sources
                    WHERE programme_id = :programme_id
                    ORDER BY created_at, id
                """),
                {"programme_id": str(scheme_id)},
            ).mappings().all()
        return {"count": len(rows), "sources": [dict(row) for row in rows]}
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.post("/{scheme_id}/sources", status_code=status.HTTP_201_CREATED)
def create_admin_scheme_source(
    scheme_id: UUID,
    payload: SourceCreate,
    actor: AdminPrincipal = Depends(require_admin),
):
    try:
        with engine.begin() as connection:
            _get_draft_for_update(connection, scheme_id)
            row = connection.execute(
                text("""
                    INSERT INTO public.programme_sources (
                        programme_id, source_title, source_url, issuing_body,
                        storage_path, page_reference, effective_date
                    ) VALUES (
                        :programme_id, :source_title, :source_url, :issuing_body,
                        :storage_path, :page_reference, :effective_date
                    ) RETURNING id, programme_id, source_title, source_url,
                        issuing_body, storage_path, page_reference, effective_date,
                        evidence_status, reviewed_by, reviewed_at,
                        review_expires_at, verified_at, created_at
                """),
                {"programme_id": str(scheme_id), **payload.model_dump()},
            ).mappings().one()
            created = dict(row)
            _bump_scheme_version(connection, scheme_id)
            _write_audit(
                connection,
                programme_id=scheme_id,
                actor=actor,
                action="source_created",
                before=None,
                after=created,
            )
        return created
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.patch("/{scheme_id}/sources/{source_id}")
def update_admin_scheme_source(
    scheme_id: UUID,
    source_id: UUID,
    payload: SourceUpdate,
    actor: AdminPrincipal = Depends(require_admin),
):
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "At least one field must be provided")
    for field in ("source_title", "source_url", "issuing_body"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be null")

    try:
        with engine.begin() as connection:
            _get_draft_for_update(connection, scheme_id)
            before_row = connection.execute(
                text("""
                    SELECT id, programme_id, source_title, source_url,
                           issuing_body, storage_path, page_reference,
                           effective_date, evidence_status, reviewed_by,
                           reviewed_at, review_expires_at, verified_at, created_at
                    FROM public.programme_sources
                    WHERE id = :source_id AND programme_id = :programme_id
                    FOR UPDATE
                """),
                {"source_id": str(source_id), "programme_id": str(scheme_id)},
            ).mappings().first()
            if before_row is None:
                raise HTTPException(404, "Source not found")
            before = dict(before_row)
            assignments = [f"{field} = :{field}" for field in changes]
            row = connection.execute(
                text(f"""
                    UPDATE public.programme_sources
                    SET {', '.join(assignments)}, evidence_status = 'unverified',
                        reviewed_by = NULL, reviewed_at = NULL,
                        review_expires_at = NULL, verified_at = NULL
                    WHERE id = :source_id AND programme_id = :programme_id
                    RETURNING id, programme_id, source_title, source_url,
                        issuing_body, storage_path, page_reference, effective_date,
                        evidence_status, reviewed_by, reviewed_at,
                        review_expires_at, verified_at, created_at
                """),
                {**changes, "source_id": str(source_id), "programme_id": str(scheme_id)},
            ).mappings().one()
            after = dict(row)
            connection.execute(
                text("""
                    UPDATE public.scheme_evidence_claims
                    SET review_status = 'pending', reviewed_by = NULL,
                        reviewed_at = NULL, updated_at = now()
                    WHERE source_id = :source_id
                """),
                {"source_id": str(source_id)},
            )
            _bump_scheme_version(connection, scheme_id)
            _write_audit(
                connection,
                programme_id=scheme_id,
                actor=actor,
                action="source_updated",
                before=before,
                after=after,
            )
        return after
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.delete("/{scheme_id}/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_scheme_source(
    scheme_id: UUID,
    source_id: UUID,
    actor: AdminPrincipal = Depends(require_admin),
):
    try:
        with engine.begin() as connection:
            _get_draft_for_update(connection, scheme_id)
            row = connection.execute(
                text("""
                    SELECT id, programme_id, source_title, source_url,
                           issuing_body, storage_path, page_reference,
                           effective_date, evidence_status, reviewed_by,
                           reviewed_at, review_expires_at, verified_at, created_at
                    FROM public.programme_sources
                    WHERE id = :source_id AND programme_id = :programme_id
                    FOR UPDATE
                """),
                {"source_id": str(source_id), "programme_id": str(scheme_id)},
            ).mappings().first()
            if row is None:
                raise HTTPException(404, "Source not found")
            claim_exists = connection.execute(
                text("SELECT EXISTS (SELECT 1 FROM public.scheme_evidence_claims WHERE source_id = :id)"),
                {"id": str(source_id)},
            ).scalar_one()
            if claim_exists:
                raise HTTPException(409, "Remove or update linked evidence claims before deleting this source")
            _bump_scheme_version(connection, scheme_id)
            _write_audit(
                connection,
                programme_id=scheme_id,
                actor=actor,
                action="source_deleted",
                before=dict(row),
                after=None,
            )
            connection.execute(
                text("DELETE FROM public.programme_sources WHERE id = :id"),
                {"id": str(source_id)},
            )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.get("/{scheme_id}/claims")
def list_admin_evidence_claims(
    scheme_id: UUID,
    actor: AdminPrincipal = Depends(require_admin),
):
    del actor
    try:
        with engine.connect() as connection:
            exists = connection.execute(
                text("SELECT EXISTS (SELECT 1 FROM public.programmes WHERE id = :id)"),
                {"id": str(scheme_id)},
            ).scalar_one()
            if not exists:
                raise HTTPException(404, "Scheme not found")
            rows = connection.execute(
                text("""
                    SELECT id, programme_id, source_id, field_path, claim_text,
                           structured_value, source_locator, is_critical,
                           review_status, created_by, reviewed_by, reviewed_at,
                           created_at, updated_at
                    FROM public.scheme_evidence_claims
                    WHERE programme_id = :programme_id
                    ORDER BY field_path, id
                """),
                {"programme_id": str(scheme_id)},
            ).mappings().all()
        return {"count": len(rows), "claims": [dict(row) for row in rows]}
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.post("/{scheme_id}/claims", status_code=status.HTTP_201_CREATED)
def create_admin_evidence_claim(
    scheme_id: UUID,
    payload: EvidenceClaimCreate,
    actor: AdminPrincipal = Depends(require_admin),
):
    try:
        with engine.begin() as connection:
            _get_draft_for_update(connection, scheme_id)
            source_exists = connection.execute(
                text("""
                    SELECT EXISTS (
                        SELECT 1 FROM public.programme_sources
                        WHERE id = :source_id AND programme_id = :programme_id
                    )
                """),
                {"source_id": str(payload.source_id), "programme_id": str(scheme_id)},
            ).scalar_one()
            if not source_exists:
                raise HTTPException(404, "Source not found for this scheme")
            values = payload.model_dump()
            values["source_id"] = str(payload.source_id)
            row = connection.execute(
                text("""
                    INSERT INTO public.scheme_evidence_claims (
                        programme_id, source_id, field_path, claim_text,
                        structured_value, source_locator, is_critical, created_by
                    ) VALUES (
                        :programme_id, :source_id, :field_path, :claim_text,
                        CAST(:structured_value AS jsonb), :source_locator,
                        :is_critical, :created_by
                    ) RETURNING id, programme_id, source_id, field_path,
                        claim_text, structured_value, source_locator, is_critical,
                        review_status, created_by, reviewed_by, reviewed_at,
                        created_at, updated_at
                """),
                {
                    **values,
                    "programme_id": str(scheme_id),
                    "created_by": actor.user_id,
                    "structured_value": json.dumps(payload.structured_value, ensure_ascii=False),
                },
            ).mappings().one()
            created = dict(row)
            _bump_scheme_version(connection, scheme_id)
            _write_audit(
                connection,
                programme_id=scheme_id,
                actor=actor,
                action="claim_created",
                before=None,
                after=created,
            )
        return created
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.patch("/{scheme_id}/claims/{claim_id}")
def update_admin_evidence_claim(
    scheme_id: UUID,
    claim_id: UUID,
    payload: EvidenceClaimUpdate,
    actor: AdminPrincipal = Depends(require_admin),
):
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "At least one field must be provided")
    for field in ("source_id", "field_path", "claim_text", "source_locator", "is_critical"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be null")

    try:
        with engine.begin() as connection:
            _get_draft_for_update(connection, scheme_id)
            before_row = connection.execute(
                text("""
                    SELECT id, programme_id, source_id, field_path, claim_text,
                           structured_value, source_locator, is_critical,
                           review_status, created_by, reviewed_by, reviewed_at,
                           created_at, updated_at
                    FROM public.scheme_evidence_claims
                    WHERE id = :claim_id AND programme_id = :programme_id
                    FOR UPDATE
                """),
                {"claim_id": str(claim_id), "programme_id": str(scheme_id)},
            ).mappings().first()
            if before_row is None:
                raise HTTPException(404, "Evidence claim not found")
            before = dict(before_row)
            if "source_id" in changes:
                exists = connection.execute(
                    text("""
                        SELECT EXISTS (SELECT 1 FROM public.programme_sources
                        WHERE id = :source_id AND programme_id = :programme_id)
                    """),
                    {"source_id": str(changes["source_id"]), "programme_id": str(scheme_id)},
                ).scalar_one()
                if not exists:
                    raise HTTPException(404, "Source not found for this scheme")

            assignments = []
            parameters: dict[str, Any] = {
                "claim_id": str(claim_id),
                "programme_id": str(scheme_id),
            }
            for field, value in changes.items():
                if field == "structured_value":
                    assignments.append("structured_value = CAST(:structured_value AS jsonb)")
                    parameters[field] = json.dumps(value, ensure_ascii=False)
                elif field == "source_id":
                    assignments.append("source_id = :source_id")
                    parameters[field] = str(value)
                else:
                    assignments.append(f"{field} = :{field}")
                    parameters[field] = value
            row = connection.execute(
                text(f"""
                    UPDATE public.scheme_evidence_claims
                    SET {', '.join(assignments)}, review_status = 'pending',
                        reviewed_by = NULL, reviewed_at = NULL, updated_at = now()
                    WHERE id = :claim_id AND programme_id = :programme_id
                    RETURNING id, programme_id, source_id, field_path, claim_text,
                        structured_value, source_locator, is_critical,
                        review_status, created_by, reviewed_by, reviewed_at,
                        created_at, updated_at
                """),
                parameters,
            ).mappings().one()
            after = dict(row)
            _bump_scheme_version(connection, scheme_id)
            _write_audit(
                connection,
                programme_id=scheme_id,
                actor=actor,
                action="claim_updated",
                before=before,
                after=after,
            )
        return after
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.post("/{scheme_id}/sources/{source_id}/review")
def review_admin_scheme_source(
    scheme_id: UUID,
    source_id: UUID,
    payload: EvidenceDecision,
    actor: AdminPrincipal = Depends(require_admin),
):
    today = datetime.now(timezone.utc).date()
    if payload.decision == "rejected" and not (payload.reason or "").strip():
        raise HTTPException(422, "A reason is required when rejecting evidence")
    if payload.decision == "approved" and (
        payload.review_expires_at is None or payload.review_expires_at <= today
    ):
        raise HTTPException(422, "Approval requires a future review expiry date")

    try:
        with engine.begin() as connection:
            _get_draft_for_update(connection, scheme_id)
            row = connection.execute(
                text("""
                    SELECT id, programme_id, source_title, source_url,
                           issuing_body, storage_path, page_reference,
                           effective_date, evidence_status, reviewed_by,
                           reviewed_at, review_expires_at, verified_at, created_at
                    FROM public.programme_sources
                    WHERE id = :source_id AND programme_id = :programme_id
                    FOR UPDATE
                """),
                {"source_id": str(source_id), "programme_id": str(scheme_id)},
            ).mappings().first()
            if row is None:
                raise HTTPException(404, "Source not found")
            before = dict(row)
            if payload.decision == "approved" and (
                not before["source_url"]
                or not before["issuing_body"]
                or not before["page_reference"]
                or before["effective_date"] is None
            ):
                raise HTTPException(
                    409,
                    "Approval requires an official URL, issuing body, page or clause, and effective date",
                )
            updated = connection.execute(
                text("""
                    UPDATE public.programme_sources
                    SET evidence_status = :decision, reviewed_by = :reviewer,
                        reviewed_at = now(), review_expires_at = :expires_at,
                        verified_at = CASE WHEN :decision = 'approved' THEN now() ELSE NULL END
                    WHERE id = :source_id
                    RETURNING id, programme_id, source_title, source_url,
                        issuing_body, storage_path, page_reference, effective_date,
                        evidence_status, reviewed_by, reviewed_at,
                        review_expires_at, verified_at, created_at
                """),
                {
                    "decision": payload.decision,
                    "reviewer": actor.user_id,
                    "expires_at": payload.review_expires_at if payload.decision == "approved" else None,
                    "source_id": str(source_id),
                },
            ).mappings().one()
            after = dict(updated)
            if payload.decision == "rejected":
                connection.execute(
                    text("""
                        UPDATE public.scheme_evidence_claims
                        SET review_status = 'pending', reviewed_by = NULL,
                            reviewed_at = NULL, updated_at = now()
                        WHERE source_id = :source_id
                    """),
                    {"source_id": str(source_id)},
                )
            _append_evidence_review(
                connection,
                programme_id=scheme_id,
                target_type="source",
                target_id=source_id,
                decision=payload.decision,
                actor=actor,
                reason=payload.reason,
                target_snapshot=after,
                source_snapshot=None,
            )
            _write_audit(
                connection,
                programme_id=scheme_id,
                actor=actor,
                action="source_reviewed",
                before=before,
                after=after,
            )
            _bump_scheme_version(connection, scheme_id)
        return after
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.post("/{scheme_id}/claims/{claim_id}/review")
def review_admin_evidence_claim(
    scheme_id: UUID,
    claim_id: UUID,
    payload: EvidenceDecision,
    actor: AdminPrincipal = Depends(require_admin),
):
    if payload.decision == "rejected" and not (payload.reason or "").strip():
        raise HTTPException(422, "A reason is required when rejecting a claim")
    try:
        with engine.begin() as connection:
            _get_draft_for_update(connection, scheme_id)
            row = connection.execute(
                text("""
                    SELECT id, programme_id, source_id, field_path, claim_text,
                           structured_value, source_locator, is_critical,
                           review_status, created_by, reviewed_by, reviewed_at,
                           created_at, updated_at
                    FROM public.scheme_evidence_claims
                    WHERE id = :claim_id AND programme_id = :programme_id
                    FOR UPDATE
                """),
                {"claim_id": str(claim_id), "programme_id": str(scheme_id)},
            ).mappings().first()
            if row is None:
                raise HTTPException(404, "Evidence claim not found")
            before = dict(row)
            source = connection.execute(
                text("""
                    SELECT id, source_url, issuing_body, page_reference,
                           effective_date, evidence_status, review_expires_at
                    FROM public.programme_sources
                    WHERE id = :source_id AND programme_id = :programme_id
                    FOR UPDATE
                """),
                {"source_id": str(before["source_id"]), "programme_id": str(scheme_id)},
            ).mappings().first()
            if source is None:
                raise HTTPException(409, "Claim source is missing")
            source_data = dict(source)
            if payload.decision == "approved" and (
                source_data["evidence_status"] != "approved"
                or source_data["review_expires_at"] is None
                or source_data["review_expires_at"] <= datetime.now(timezone.utc).date()
                or not before["source_locator"]
            ):
                raise HTTPException(409, "Claim can only be approved against current approved evidence")
            updated = connection.execute(
                text("""
                    UPDATE public.scheme_evidence_claims
                    SET review_status = :decision, reviewed_by = :reviewer,
                        reviewed_at = now(), updated_at = now()
                    WHERE id = :claim_id
                    RETURNING id, programme_id, source_id, field_path, claim_text,
                        structured_value, source_locator, is_critical,
                        review_status, created_by, reviewed_by, reviewed_at,
                        created_at, updated_at
                """),
                {
                    "decision": payload.decision,
                    "reviewer": actor.user_id,
                    "claim_id": str(claim_id),
                },
            ).mappings().one()
            after = dict(updated)
            _append_evidence_review(
                connection,
                programme_id=scheme_id,
                target_type="claim",
                target_id=claim_id,
                decision=payload.decision,
                actor=actor,
                reason=payload.reason,
                target_snapshot=after,
                source_snapshot=source_data,
            )
            _write_audit(
                connection,
                programme_id=scheme_id,
                actor=actor,
                action="claim_reviewed",
                before=before,
                after=after,
            )
            _bump_scheme_version(connection, scheme_id)
        return after
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.post("/{scheme_id}/eligibility-rules", status_code=status.HTTP_201_CREATED)
def create_admin_eligibility_rule(
    scheme_id: UUID,
    payload: EligibilityRuleCreate,
    actor: AdminPrincipal = Depends(require_admin),
):
    from app.services.rule_validator import validate_rule
    try:
        validate_rule(payload.rule_definition)
    except (TypeError, ValueError) as error:
        raise HTTPException(422, str(error)) from error
    try:
        with engine.begin() as connection:
            before = _get_draft_for_update(connection, scheme_id)
            source = connection.execute(text("""
                SELECT id FROM public.programme_sources
                WHERE id = :source_id AND programme_id = :programme_id
                  AND evidence_status = 'approved'
                  AND review_expires_at > CURRENT_DATE
            """), {"source_id": str(payload.source_id), "programme_id": str(scheme_id)}).first()
            if source is None:
                raise HTTPException(409, "Rule source must be approved and current")
            claim = connection.execute(text("""
                SELECT id FROM public.scheme_evidence_claims
                WHERE programme_id = :programme_id AND source_id = :source_id
                  AND field_path = :field_path AND source_locator = :locator
                  AND review_status = 'approved'
            """), {
                "programme_id": str(scheme_id), "source_id": str(payload.source_id),
                "field_path": f"eligibility_rules.{payload.rule_type}",
                "locator": payload.source_reference,
            }).first()
            if claim is None:
                raise HTTPException(409, "An approved source claim for this rule and locator is required")
            row = connection.execute(text("""
                INSERT INTO public.eligibility_rules (
                    programme_id, source_id, rule_type, rule_definition,
                    explanation, source_reference, verification_status
                ) VALUES (
                    :programme_id, :source_id, :rule_type,
                    CAST(:rule_definition AS jsonb), :explanation,
                    :source_reference, 'verified'
                ) RETURNING id, programme_id, source_id, rule_type,
                    rule_definition, explanation, source_reference, verification_status
            """), {
                "programme_id": str(scheme_id), "source_id": str(payload.source_id),
                "rule_type": payload.rule_type,
                "rule_definition": json.dumps(payload.rule_definition, ensure_ascii=False),
                "explanation": payload.explanation, "source_reference": payload.source_reference,
            }).mappings().one()
            created = dict(row)
            _bump_scheme_version(connection, scheme_id)
            _write_audit(connection, programme_id=scheme_id, actor=actor,
                         action="updated", before=before, after=created)
        return created
    except HTTPException:
        raise
    except IntegrityError as error:
        raise HTTPException(409, "Eligibility rule could not be added") from error
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.post("/{scheme_id}/document-requirements", status_code=status.HTTP_201_CREATED)
def create_admin_document_requirement(
    scheme_id: UUID,
    payload: DocumentRequirementCreate,
    actor: AdminPrincipal = Depends(require_admin),
):
    if payload.required_when is not None:
        from app.services.rule_validator import validate_rule
        try:
            validate_rule(payload.required_when)
        except (TypeError, ValueError) as error:
            raise HTTPException(422, str(error)) from error
    try:
        with engine.begin() as connection:
            before = _get_draft_for_update(connection, scheme_id)
            source = connection.execute(text("""
                SELECT id FROM public.programme_sources
                WHERE id = :source_id AND programme_id = :programme_id
                  AND evidence_status = 'approved'
                  AND review_expires_at > CURRENT_DATE
            """), {"source_id": str(payload.source_id), "programme_id": str(scheme_id)}).first()
            if source is None:
                raise HTTPException(409, "Requirement source must be approved and current")
            claim = connection.execute(text("""
                SELECT id FROM public.scheme_evidence_claims
                WHERE programme_id = :programme_id AND source_id = :source_id
                  AND field_path = :field_path AND source_locator = :locator
                  AND review_status = 'approved'
            """), {
                "programme_id": str(scheme_id), "source_id": str(payload.source_id),
                "field_path": f"document_requirements.{payload.document_name}",
                "locator": payload.source_reference,
            }).first()
            if claim is None:
                raise HTTPException(409, "An approved source claim for this requirement and locator is required")
            row = connection.execute(text("""
                INSERT INTO public.document_requirements (
                    programme_id, source_id, document_name, required_when,
                    accepted_alternatives, source_reference
                ) VALUES (
                    :programme_id, :source_id, :document_name,
                    CAST(:required_when AS jsonb), CAST(:accepted_alternatives AS jsonb),
                    :source_reference
                ) RETURNING id, programme_id, source_id, document_name,
                    required_when, accepted_alternatives, source_reference
            """), {
                "programme_id": str(scheme_id), "source_id": str(payload.source_id),
                "document_name": payload.document_name,
                "required_when": json.dumps(payload.required_when, ensure_ascii=False) if payload.required_when is not None else None,
                "accepted_alternatives": json.dumps(payload.accepted_alternatives, ensure_ascii=False),
                "source_reference": payload.source_reference,
            }).mappings().one()
            created = dict(row)
            _bump_scheme_version(connection, scheme_id)
            _write_audit(connection, programme_id=scheme_id, actor=actor,
                         action="updated", before=before, after=created)
        return created
    except HTTPException:
        raise
    except IntegrityError as error:
        raise HTTPException(409, "Document requirement could not be added") from error
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.post("/{scheme_id}/publish")
def publish_admin_scheme(
    scheme_id: UUID,
    actor: AdminPrincipal = Depends(require_admin),
):
    try:
        with engine.begin() as connection:
            programme = _get_draft_for_update(connection, scheme_id)
            sources = [dict(row) for row in connection.execute(
                text("""
                    SELECT id, programme_id, source_title, source_url, issuing_body,
                           storage_path, page_reference, effective_date,
                           evidence_status, reviewed_by, reviewed_at,
                           review_expires_at, verified_at, created_at
                    FROM public.programme_sources WHERE programme_id = :programme_id
                    ORDER BY id
                """),
                {"programme_id": str(scheme_id)},
            ).mappings().all()]
            claims = [dict(row) for row in connection.execute(
                text("""
                    SELECT id, programme_id, source_id, field_path, claim_text,
                           structured_value, source_locator, is_critical,
                           review_status, created_by, reviewed_by, reviewed_at,
                           created_at, updated_at
                    FROM public.scheme_evidence_claims WHERE programme_id = :programme_id
                    ORDER BY field_path, id
                """),
                {"programme_id": str(scheme_id)},
            ).mappings().all()]
            today = datetime.now(timezone.utc).date()
            source_by_id = {str(source["id"]): source for source in sources}
            if not sources:
                raise HTTPException(409, "At least one official source is required before publication")
            if any(
                source["evidence_status"] != "approved"
                or source["review_expires_at"] is None
                or source["review_expires_at"] <= today
                for source in sources
            ):
                raise HTTPException(409, "Every source must have current human approval")
            if not claims or not any(claim["is_critical"] for claim in claims):
                raise HTTPException(409, "At least one critical evidence claim is required")
            if any(claim["review_status"] != "approved" for claim in claims):
                raise HTTPException(409, "Every evidence claim must be approved before publication")
            if any(str(claim["source_id"]) not in source_by_id for claim in claims):
                raise HTTPException(409, "Every claim must reference a source on this scheme")

            approved_source_ids = {str(source["id"]) for source in sources}
            eligibility_rules = [dict(row) for row in connection.execute(
                text("""
                    SELECT id, source_id, rule_type, rule_definition,
                           explanation, source_reference
                    FROM public.eligibility_rules
                    WHERE programme_id = :programme_id
                      AND verification_status = 'verified'
                      AND source_id IS NOT NULL
                    ORDER BY rule_type, id
                """), {"programme_id": str(scheme_id)}
            ).mappings().all() if str(row["source_id"]) in approved_source_ids]
            document_requirements = [dict(row) for row in connection.execute(
                text("""
                    SELECT id, source_id, document_name, required_when,
                           accepted_alternatives, source_reference
                    FROM public.document_requirements
                    WHERE programme_id = :programme_id AND source_id IS NOT NULL
                    ORDER BY document_name, id
                """), {"programme_id": str(scheme_id)}
            ).mappings().all() if str(row["source_id"]) in approved_source_ids]

            programme_snapshot = {
                "id": programme["id"],
                "programme_code": programme["programme_code"],
                "organization_id": programme["organization_id"],
                "official_name": programme["official_name"],
                "programme_type": programme["programme_type"],
                "description": programme["description"],
                "coverage": programme["coverage"],
                "details": programme["details"],
                "version": programme["version"],
            }
            snapshot = json.dumps(jsonable_encoder({
                "programme": programme_snapshot,
                "sources": sources,
                "evidence_claims": claims,
                "eligibility_rules": eligibility_rules,
                "document_requirements": document_requirements,
            }), ensure_ascii=False)
            version = int(programme["version"])
            connection.execute(
                text("""
                    INSERT INTO public.scheme_publication_versions (
                        programme_id, version_number, snapshot, published_by
                    ) VALUES (
                        :programme_id, :version_number, CAST(:snapshot AS jsonb), :published_by
                    )
                """),
                {
                    "programme_id": str(scheme_id),
                    "version_number": version,
                    "snapshot": snapshot,
                    "published_by": actor.user_id,
                },
            )
            connection.execute(
                text("""
                    INSERT INTO public.scheme_sync_jobs (
                        programme_id, version_number, job_type, status
                    ) VALUES (:programme_id, :version_number, 'rag', 'pending')
                """),
                {"programme_id": str(scheme_id), "version_number": version},
            )
            published = connection.execute(
                text("""
                    UPDATE public.programmes
                    SET review_status = 'under_review',
                        pending_publication_version = :version,
                        updated_at = now()
                    WHERE id = :scheme_id
                    RETURNING id, programme_code, official_name, review_status,
                        version, current_published_version,
                        pending_publication_version, last_verified_at
                """),
                {"scheme_id": str(scheme_id), "version": version},
            ).mappings().one()
            result = dict(published)
            _write_audit(
                connection,
                programme_id=scheme_id,
                actor=actor,
                action="publication_queued",
                before=programme,
                after={**result, "snapshot": json.loads(snapshot)},
            )
        return {
            "publication": result,
            "index_status": "pending",
            "message": "Evidence approved; publication will become active after indexing succeeds",
        }
    except HTTPException:
        raise
    except IntegrityError as error:
        raise HTTPException(409, "Publication version already exists") from error
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.get("/{scheme_id}/sync")
def get_admin_scheme_sync_status(
    scheme_id: UUID,
    actor: AdminPrincipal = Depends(require_admin),
):
    del actor
    try:
        with engine.connect() as connection:
            programme = connection.execute(
                text("""
                    SELECT current_published_version, pending_publication_version
                    FROM public.programmes WHERE id = :programme_id
                """),
                {"programme_id": str(scheme_id)},
            ).mappings().first()
            if programme is None:
                raise HTTPException(404, "Scheme not found")
            jobs = connection.execute(
                text("""
                    SELECT id, version_number, job_type, status, attempts,
                           available_at, completed_at, error_code, created_at, updated_at
                    FROM public.scheme_sync_jobs
                    WHERE programme_id = :programme_id
                    ORDER BY version_number DESC, created_at DESC
                """),
                {"programme_id": str(scheme_id)},
            ).mappings().all()
        return {
            "current_published_version": programme["current_published_version"],
            "pending_publication_version": programme["pending_publication_version"],
            "jobs": [dict(row) for row in jobs],
        }
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.post("/{scheme_id}/sync/retry")
def retry_admin_scheme_sync(
    scheme_id: UUID,
    actor: AdminPrincipal = Depends(require_admin),
):
    try:
        with engine.begin() as connection:
            programme = connection.execute(
                text("""
                    SELECT current_published_version, pending_publication_version
                    FROM public.programmes WHERE id = :programme_id
                    FOR UPDATE
                """),
                {"programme_id": str(scheme_id)},
            ).mappings().first()
            if programme is None:
                raise HTTPException(404, "Scheme not found")
            job_row = connection.execute(
                text("""
                    SELECT id, version_number, job_type, status, attempts,
                           available_at, completed_at, error_code
                    FROM public.scheme_sync_jobs
                    WHERE programme_id = :programme_id AND status = 'failed'
                    ORDER BY version_number DESC LIMIT 1
                    FOR UPDATE
                """),
                {"programme_id": str(scheme_id)},
            ).mappings().first()
            if job_row is None:
                raise HTTPException(409, "No failed sync job is available to retry")
            job = dict(job_row)
            current_version = programme["current_published_version"]
            if current_version is not None and job["version_number"] <= current_version:
                raise HTTPException(409, "A newer or equal publication is already active")
            before = job
            connection.execute(
                text("""
                    UPDATE public.scheme_sync_jobs
                    SET status = 'pending', attempts = 0, available_at = now(),
                        locked_at = NULL, completed_at = NULL,
                        error_code = NULL, updated_at = now()
                    WHERE id = :job_id
                """),
                {"job_id": str(job["id"])},
            )
            connection.execute(
                text("""
                    UPDATE public.scheme_publication_versions
                    SET index_status = 'pending'
                    WHERE programme_id = :programme_id AND version_number = :version_number
                """),
                {"programme_id": str(scheme_id), "version_number": job["version_number"]},
            )
            connection.execute(
                text("""
                    UPDATE public.programmes
                    SET pending_publication_version = :version_number,
                        review_status = 'under_review', updated_at = now()
                    WHERE id = :programme_id
                """),
                {"programme_id": str(scheme_id), "version_number": job["version_number"]},
            )
            _write_audit(
                connection,
                programme_id=scheme_id,
                actor=actor,
                action="sync_retried",
                before=before,
                after={**before, "status": "pending", "attempts": 0, "error_code": None},
            )
        return {"job_id": job["id"], "version_number": job["version_number"], "status": "pending"}
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error
