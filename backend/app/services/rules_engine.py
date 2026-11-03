
from typing import Any

from app.services.rule_validator import validate_rule
from app.services.rule_evaluator import evaluate_condition


def evaluate_rule(
    rule_definition: dict,
    patient_facts: dict,
) -> dict[str, Any]:
    """
    Validate a rule before evaluating it.

    This is a screening engine, not an official
    eligibility determination.
    """

    try:
        validate_rule(rule_definition)

        if not isinstance(patient_facts, dict):
            raise ValueError("Patient facts must be a dictionary")

        evaluation = evaluate_condition(
            rule_definition,
            patient_facts,
        )

        return {
            "success": True,
            "result": evaluation["result"].value,
            "evaluation": evaluation,
            "disclaimer": (
                "Preliminary screening only. "
                "Official eligibility must be confirmed "
                "by the responsible programme authority."
            ),
        }

    except (ValueError, TypeError) as error:
        return {
            "success": False,
            "result": "INVALID_INPUT",
            "error": str(error),
        }
