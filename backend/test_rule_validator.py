
from app.services.rule_validator import validate_rule


valid_rules = [
    {"field": "age", "operator": "gte", "value": 70},
    {
        "any": [
            {"field": "database_match", "operator": "eq", "value": True},
            {"field": "senior_route", "operator": "eq", "value": True},
        ]
    },
]

invalid_rules = [
    {"all": []},
    {"field": "age", "operator": "greater_than", "value": 70},
    {"field": "unknown_field", "operator": "eq", "value": True},
    {"field": "age", "operator": "gte", "value": "seventy"},
    {"field": "state", "operator": "in", "value": []},
]

for rule in valid_rules:
    validate_rule(rule)
    print("PASS: Valid rule accepted")

for rule in invalid_rules:
    try:
        validate_rule(rule)
    except ValueError:
        print("PASS: Invalid rule rejected")
    else:
        raise AssertionError(f"Invalid rule accepted: {rule}")

print("\nAll rule validation tests passed.")
