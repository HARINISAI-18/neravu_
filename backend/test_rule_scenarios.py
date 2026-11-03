
from app.services.rule_evaluator import (
    Result,
    evaluate_condition,
)

def check(name, rule, facts, expected):
    actual = evaluate_condition(rule, facts)["result"]
    assert actual == expected, (
        f"{name}: expected {expected.value}, got {actual.value}"
    )
    print(f"PASS: {name}")


# Test 1: Age boundary
check(
    "Exactly 70 years old",
    {"field": "age", "operator": "gte", "value": 70},
    {"age": 70},
    Result.PASS,
)

# Test 2: Below minimum age
check(
    "Below age threshold",
    {"field": "age", "operator": "gte", "value": 70},
    {"age": 69},
    Result.FAIL,
)

# Test 3: Missing age
check(
    "Missing age",
    {"field": "age", "operator": "gte", "value": 70},
    {},
    Result.UNKNOWN,
)

# Test 4: Alternative pathways
check(
    "One pathway passes",
    {
        "any": [
            {"field": "database_match", "operator": "eq", "value": True},
            {"field": "senior_route", "operator": "eq", "value": True},
        ]
    },
    {"database_match": False, "senior_route": True},
    Result.PASS,
)

# Test 5: Unknown alternative
check(
    "One pathway fails, another unknown",
    {
        "any": [
            {"field": "database_match", "operator": "eq", "value": True},
            {"field": "senior_route", "operator": "eq", "value": True},
        ]
    },
    {"database_match": False},
    Result.UNKNOWN,
)

# Test 6: Conflicting value types
check(
    "Invalid age type",
    {"field": "age", "operator": "gte", "value": 70},
    {"age": "seventy"},
    Result.CONFLICT,
)

print("\nAll six rule scenario tests passed.")
