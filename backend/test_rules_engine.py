
from app.services.rules_engine import evaluate_rule


rule = {
    "all": [
        {
            "field": "age",
            "operator": "gte",
            "value": 70,
        },
        {
            "field": "citizenship",
            "operator": "eq",
            "value": "IN",
        },
    ]
}


patients = [
    {"age": 72, "citizenship": "IN"},
    {"age": 65, "citizenship": "IN"},
    {"age": 72},
    {"age": "seventy", "citizenship": "IN"},
]


for patient in patients:
    result = evaluate_rule(rule, patient)

    print("Patient:", patient)
    print("Result:", result["result"])
    print("---")


invalid_rule = {
    "all": []
}

result = evaluate_rule(invalid_rule, {"age": 72})

assert result["success"] is False
assert result["result"] == "INVALID_INPUT"

print("Invalid rule correctly rejected.")
