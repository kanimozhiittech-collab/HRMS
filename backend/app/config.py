"""App settings — values come from the .env file."""
import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/hrms_master"
)
SECRET_KEY = os.getenv("SECRET_KEY", "change-this-to-a-long-random-secret")
TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_MINUTES", "1440"))
RENEWAL_REMINDER_DAYS = int(os.getenv("RENEWAL_REMINDER_DAYS", "7"))
