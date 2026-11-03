
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.knowledge import Programme, EligibilityRule


def get_verified_rules(
    db: Session,
    programme_code: str,
) -> list[dict]:
    """
    Retrieve verified rules belonging to a verified programme.
    Draft and unverified rules are excluded.
    """

    statement = (
        select(EligibilityRule)
        .join(
            Programme,
            EligibilityRule.programme_id == Programme.id,
        )
        .where(
            Programme.programme_code == programme_code,
            Programme.review_status == "verified",
            EligibilityRule.verification_status == "verified",
        )
    )

    rules = db.scalars(statement).all()

    return [
        {
            "rule_type": rule.rule_type,
            "rule_definition": rule.rule_definition,
            "explanation": rule.explanation,
            "source_reference": rule.source_reference,
        }
        for rule in rules
    ]
