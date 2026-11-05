import sys
from sqlalchemy import text
from app.db.config import get_database_engine

def set_admin(email: str):
    engine = get_database_engine()
    with engine.begin() as conn:
        res = conn.execute(
            text("""
                UPDATE auth.users
                SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
                WHERE lower(email) = lower(:email)
                RETURNING id, email, raw_app_meta_data
            """),
            {"email": email.strip()}
        ).mappings().first()

        if not res:
            print(f"Error: User with email '{email}' not found in auth.users.")
            return

        print("SUCCESS! Admin role assigned:")
        print("User ID:", res["id"])
        print("Email:", res["email"])
        print("App Metadata:", res["raw_app_meta_data"])

if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "optimizers64@gmail.com"
    set_admin(email)

