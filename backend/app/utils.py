"""Small helper functions used in many places."""
import secrets
import string
from datetime import datetime

from fastapi import Request
from sqlalchemy.orm import Session

from app import models


def generate_temp_password(length: int = 10) -> str:
    """Make a random temporary password like 'aB3xY9kP2m'."""
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def generate_invoice_number(db: Session) -> str:
    """Make invoice numbers like INV-202607-0001 (year+month + running number)."""
    prefix = "INV-" + datetime.utcnow().strftime("%Y%m")
    count = db.query(models.Payment).count() + 1
    return f"{prefix}-{count:04d}"


def send_email(to_email: str, subject: str, body: str):
    """Send an email.

    Right now this only prints to the console (easy for testing).
    Later, connect a real SMTP server or email service here.
    """
    print("=" * 50)
    print(f"EMAIL TO : {to_email}")
    print(f"SUBJECT  : {subject}")
    print(body)
    print("=" * 50)


def add_notification(db: Session, type: str, title: str, message: str,
                     company_id: int = None, user_id: int = None):
    """Save a notification row (shown in the notification bell)."""
    db.add(models.Notification(
        company_id=company_id, user_id=user_id,
        type=type, title=title, message=message,
    ))


def add_audit_log(db: Session, action: str, module: str, description: str,
                  user_id: int = None, request: Request = None):
    """Save an audit log row (who did what, from which IP)."""
    ip = request.client.host if request and request.client else None
    db.add(models.AuditLog(
        user_id=user_id, action=action, module=module,
        description=description, ip_address=ip,
    ))
