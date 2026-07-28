"""App settings — values come from the .env file."""
import os

from dotenv import load_dotenv

load_dotenv()

def _clean_db_url(raw: str) -> str:
    """Tolerate common copy-paste artifacts: surrounding quotes, whitespace,
    or Neon's `psql '...'` snippet format."""
    raw = raw.strip()
    if raw.startswith("psql"):
        raw = raw[4:].strip()
    return raw.strip("'\"").strip()


DATABASE_URL = _clean_db_url(os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/hrms_master"
))
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-to-a-long-random-secret")
TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_MINUTES", "1440"))
RENEWAL_REMINDER_DAYS = int(os.getenv("RENEWAL_REMINDER_DAYS", "7"))
