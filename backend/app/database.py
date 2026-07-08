"""Database connection setup (SQLAlchemy)."""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# All table models inherit from this Base class
Base = declarative_base()


def get_db():
    """Gives one database session per API request, and closes it after."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
