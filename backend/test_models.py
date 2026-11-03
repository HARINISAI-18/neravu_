print("START: test_models.py is running", flush=True)
from sqlalchemy import inspect

from app.db.session import engine
from app.models.knowledge import (
    DocumentRequirement,
    EligibilityRule,
    Organization,
    Programme,
    ProgrammeSource,
)

models = [
    Organization,
    Programme,
    ProgrammeSource,
    EligibilityRule,
    DocumentRequirement,
]
print("Models imported. Connecting to PostgreSQL...", flush=True)
inspector = inspect(engine)

for model in models:
    table = model.__tablename__
    exists = inspector.has_table(table)

    if not exists:
        raise RuntimeError(f"Missing database table: {table}")

    actual = {
        column["name"]
        for column in inspector.get_columns(table)
    }
    expected = set(model.__table__.columns.keys())

    missing = expected - actual

    if missing:
        raise RuntimeError(
            f"{table} is missing columns: {sorted(missing)}"
        )

    print(f"OK: {table}")

print("All five Neravu models verified.")
