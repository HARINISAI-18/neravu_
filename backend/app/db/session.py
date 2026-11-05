
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.db.config import get_database_engine


class Base(DeclarativeBase):
    pass


engine = get_database_engine()

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)


def get_db():
    with SessionLocal() as session:
        yield session
