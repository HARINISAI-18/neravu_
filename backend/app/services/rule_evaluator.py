
from enum import Enum
from typing import Any


class Result(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    UNKNOWN = "UNKNOWN"
    CONFLICT = "CONFLICT"


OPERATORS = {"eq", "neq", "gt", "gte", "lt", "lte", "in"}


def combine_all(results: list[Result]) -> Result:
    if Result.CONFLICT in results:
        return Result.CONFLICT
    if Result.FAIL in results:
        return Result.FAIL
    if Result.UNKNOWN in results:
        return Result.UNKNOWN
    return Result.PASS


def combine_any(results: list[Result]) -> Result:
    if Result.CONFLICT in results:
        return Result.CONFLICT
    if Result.PASS in results:
        return Result.PASS
    if Result.UNKNOWN in results:
        return Result.UNKNOWN
    return Result.FAIL


def evaluate_condition(condition: dict, facts: dict) -> dict:
    """
    Evaluate a declarative rule.
    Returns a result and an explanation trace.
    """

    if "all" in condition:
        children = [
            evaluate_condition(child, facts)
            for child in condition["all"]
        ]
        return {
            "result": combine_all([c["result"] for c in children]),
            "children": children,
        }

    if "any" in condition:
        children = [
            evaluate_condition(child, facts)
            for child in condition["any"]
        ]
        return {
            "result": combine_any([c["result"] for c in children]),
            "children": children,
        }

    field = condition.get("field")
    operator = condition.get("operator")
    expected = condition.get("value")

    if operator not in OPERATORS:
        raise ValueError(f"Unsupported operator: {operator}")

    if field not in facts or facts[field] is None:
        return {
            "result": Result.UNKNOWN,
            "field": field,
            "reason": "Missing information",
        }

    actual = facts[field]

    try:
        operations = {
            "eq": lambda: actual == expected,
            "neq": lambda: actual != expected,
            "gt": lambda: actual > expected,
            "gte": lambda: actual >= expected,
            "lt": lambda: actual < expected,
            "lte": lambda: actual <= expected,
            "in": lambda: actual in expected,
        }
        passed = operations[operator]()
    except (TypeError, ValueError):
        return {
            "result": Result.CONFLICT,
            "field": field,
            "reason": "Invalid or incompatible values",
        }

    return {
        "result": Result.PASS if passed else Result.FAIL,
        "field": field,
        "operator": operator,
        "expected": expected,
        "actual": actual,
    }
