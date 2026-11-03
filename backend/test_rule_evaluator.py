
from app.services.rule_evaluator import evaluate_condition

senior_rule = {
    "all": [
        {"field": "age", "operator": "gte", "value": 70},
        {"field": "citizenship", "operator": "eq", "value": "IN"},
    ]
}

test_patients = [
    {"age": 72, "citizenship": "IN"},
    {"age": 65, "citizenship": "IN"},
    {"age": 72},
]

for patient in test_patients:
    result = evaluate_condition(senior_rule, patient)
    print("Patient:", patient)
    print("Result:", result["result"].value)
    print()
