"""Patient-facing eligibility and document screening APIs."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.config import get_database_engine
from app.services.rules_engine import evaluate_rule

router = APIRouter(prefix="/api/schemes", tags=["Eligibility and Documents"])
engine = get_database_engine()


class EligibilityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    patient_facts: dict[str, Any] = Field(default_factory=dict)


class DocumentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    patient_facts: dict[str, Any] = Field(default_factory=dict)
    documents: list[str] = Field(default_factory=list, max_length=100)


def _published_programme(connection, scheme_id: UUID):
    row = connection.execute(text("""
        SELECT p.id, p.programme_code, v.snapshot
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
    """), {"scheme_id": str(scheme_id)}).mappings().first()
    if row is None:
        raise HTTPException(404, "Published scheme not found")
    return row


def _approved_sources(snapshot: dict) -> dict[str, dict]:
    return {
        str(source["id"]): source
        for source in snapshot.get("sources", [])
        if source.get("evidence_status") == "approved"
    }


@router.post("/{scheme_id}/eligibility/evaluate")
def evaluate_scheme_eligibility(scheme_id: UUID, request: EligibilityRequest):
    try:
        with engine.connect() as connection:
            programme = _published_programme(connection, scheme_id)
            snapshot = programme["snapshot"]
            if isinstance(snapshot, str):
                import json
                snapshot = json.loads(snapshot)
            approved_sources = _approved_sources(snapshot)
            rules = [
                rule for rule in snapshot.get("eligibility_rules", [])
                if str(rule.get("source_id")) in approved_sources
            ]
        if not rules:
            return {
                "scheme_id": str(scheme_id),
                "result": "UNKNOWN",
                "rules_evaluated": 0,
                "reason": "No currently published, source-backed eligibility rules are available.",
                "requires_manual_review": True,
                "disclaimer": "Preliminary screening only. The programme authority makes the official decision.",
            }
        results = []
        for rule in rules:
            result = evaluate_rule(rule["rule_definition"], request.patient_facts)
            results.append({
                "rule_type": rule["rule_type"],
                "result": result.get("result", "UNKNOWN"),
                "explanation": rule["explanation"],
                "source_reference": rule["source_reference"],
                "evidence_source": {
                    "title": approved_sources[str(rule["source_id"])].get("source_title"),
                    "url": approved_sources[str(rule["source_id"])].get("source_url"),
                    "locator": rule["source_reference"],
                },
                "evaluation": result.get("evaluation"),
            })
        values = {item["result"] for item in results}
        if "PASS" in values:
            overall = "PASS"
        elif "CONFLICT" in values:
            overall = "CONFLICT"
        elif "UNKNOWN" in values or "INVALID_INPUT" in values:
            overall = "UNKNOWN"
        else:
            overall = "FAIL"
        return {
            "scheme_id": str(scheme_id),
            "result": overall,
            "rules_evaluated": len(results),
            "rules": results,
            "requires_manual_review": overall in {"UNKNOWN", "CONFLICT"},
            "disclaimer": "Preliminary screening only. A PASS does not confirm official eligibility.",
        }
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error


@router.post("/{scheme_id}/documents/check")
def check_scheme_documents(scheme_id: UUID, request: DocumentRequest):
    try:
        with engine.connect() as connection:
            programme = _published_programme(connection, scheme_id)
            snapshot = programme["snapshot"]
            if isinstance(snapshot, str):
                import json
                snapshot = json.loads(snapshot)
            approved_sources = _approved_sources(snapshot)
            requirements = [
                item for item in snapshot.get("document_requirements", [])
                if str(item.get("source_id")) in approved_sources
            ]
        if not requirements:
            return {
                "scheme_id": str(scheme_id),
                "status": "UNKNOWN",
                "documents": [],
                "requires_manual_review": True,
                "message": "No currently published, source-backed document requirements are available.",
            }
        submitted = {name.strip().casefold() for name in request.documents if name.strip()}
        output = []
        for requirement in requirements:
            condition = requirement["required_when"]
            if condition is None:
                required = "PASS"
            else:
                evaluated = evaluate_rule(condition, request.patient_facts)
                required = evaluated.get("result", "UNKNOWN")
            alternatives = requirement["accepted_alternatives"] or []
            if not isinstance(alternatives, list):
                alternatives = []
            alternatives = [name for name in alternatives if isinstance(name, str)]
            accepted_names = [requirement["document_name"], *alternatives]
            provided = any(name.strip().casefold() in submitted for name in accepted_names if isinstance(name, str))
            if required == "FAIL":
                state = "not_required"
            elif required == "UNKNOWN" or required in {"CONFLICT", "INVALID_INPUT"}:
                state = "unknown"
            elif provided:
                state = "provided"
            else:
                state = "missing"
            output.append({
                "document_name": requirement["document_name"],
                "state": state,
                "accepted_alternatives": alternatives,
                "source_reference": requirement["source_reference"],
                "evidence_source": {
                    "title": approved_sources[str(requirement["source_id"])].get("source_title"),
                    "url": approved_sources[str(requirement["source_id"])].get("source_url"),
                    "locator": requirement["source_reference"],
                },
            })
        states = {item["state"] for item in output}
        overall = "UNKNOWN" if "unknown" in states else "INCOMPLETE" if "missing" in states else "COMPLETE"
        return {
            "scheme_id": str(scheme_id),
            "status": overall,
            "documents": output,
            "requires_manual_review": overall == "UNKNOWN",
            "disclaimer": "This checklist is informational. The receiving authority may require additional records.",
        }
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error



@router.get("/{scheme_id}/journey")
def get_scheme_journey(scheme_id: UUID):
    try:
        with engine.connect() as connection:
            programme = _published_programme(connection, scheme_id)
            snapshot = programme["snapshot"]
            if isinstance(snapshot, str):
                import json
                snapshot = json.loads(snapshot)
            approved_sources = _approved_sources(snapshot)
            claims = snapshot.get("evidence_claims", [])
            journey_claims = [
                c for c in claims
                if c.get("field_path") in {"application.workflow_steps", "application.steps", "application_steps"}
                and str(c.get("source_id")) in approved_sources
            ]

        steps = []
        milestones = []
        sources = []
        if journey_claims:
            for claim in journey_claims:
                text_content = claim.get("claim_text", "")
                structured = claim.get("structured_value") or {}
                if isinstance(structured, dict) and "milestones" in structured:
                    milestones.extend(structured["milestones"])
                import re
                numbers = [int(n) for n in re.findall(r"Step\s*(\d+)[:\.]", text_content)]
                parts = re.split(r"Step\s*\d+[:\.]\s*", text_content)
                if numbers and len(parts) > len(numbers):
                    for num, part in zip(numbers, parts[1:]):
                        steps.append({
                            "step_number": num,
                            "description": part.strip(),
                        })
                else:
                    steps.append({
                        "step_number": 1,
                        "description": text_content.strip(),
                    })
                source = approved_sources.get(str(claim.get("source_id")), {})
                sources.append({
                    "title": source.get("source_title"),
                    "url": source.get("source_url"),
                    "locator": claim.get("source_locator"),
                })

        return {
            "scheme_id": str(scheme_id),
            "official_name": (snapshot.get("programme") or {}).get("official_name", "Scheme"),
            "steps": steps,
            "milestones": list(dict.fromkeys(milestones)),
            "sources": sources,
            "disclaimer": "These steps outline the official application and preauthorization journey. Steps must be coordinated with the treating empanelled hospital.",
        }
    except HTTPException:
        raise
    except SQLAlchemyError as error:
        raise HTTPException(503, "Database unavailable") from error
