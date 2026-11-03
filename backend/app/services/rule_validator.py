
from typing import Any

ALLOWED_OPERATORS = {
    "eq", "neq", "gt", "gte", "lt", "lte", "in"
}

ALLOWED_FIELDS = {
    "age",
    "citizenship",
    "state",
    "district",
    "annual_income",
    "database_match",
    "senior_route",
    "hospital_empanelled",
    "oncology_package_approved",
    "clinical_criteria_met",
    "sufficient_balance",
    "authorization_approved",
}


def validate_rule(rule: Any, depth: int = 0) -> None:
    if depth > 10:
        raise ValueError("Rule nesting exceeds maximum depth")

    if not isinstance(rule, dict):
        raise ValueError("Rule must be a JSON object")

    if "all" in rule or "any" in rule:
        if len(rule) != 1:
            raise ValueError("Logical group must contain only all or any")

        key = "all" if "all" in rule else "any"
        children = rule[key]

        if not isinstance(children, list) or not children:
            raise ValueError(f"{key} must contain a non-empty list")

        if len(children) > 50:
            raise ValueError("Too many conditions")

        for child in children:
            validate_rule(child, depth + 1)

        return

    if set(rule.keys()) != {"field", "operator", "value"}:
        raise ValueError(
            "Condition must contain exactly field, operator, value"
        )

    field = rule["field"]
    operator = rule["operator"]
    value = rule["value"]

    if field not in ALLOWED_FIELDS:
        raise ValueError(f"Unknown field: {field}")

    if operator not in ALLOWED_OPERATORS:
        raise ValueError(f"Unsupported operator: {operator}")

    if value is None:
        raise ValueError("Rule comparison value cannot be null")

    if operator == "in":
        if not isinstance(value, list) or not value:
            raise ValueError("'in' requires a non-empty list")

    if operator in {"gt", "gte", "lt", "lte"}:
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(
                "Comparison operators require numeric values"
            )
