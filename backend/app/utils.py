"""Small helper functions used in many places."""
import secrets
import string
import uuid
from datetime import datetime
from pathlib import Path

import vercel_blob
from fastapi import Request, UploadFile
from sqlalchemy.orm import Session

from app import models


def get_setting(db: Session, key: str, default: str = None) -> str:
    """Read one value from the settings table. Returns default if not found."""
    setting = db.query(models.Setting).filter(
        models.Setting.setting_key == key).first()
    if setting and setting.setting_value is not None:
        return setting.setting_value
    return default


def save_upload(file: UploadFile, folder: str) -> str:
    """Uploads `file` to Vercel Blob under `folder/` and returns the public
    URL — a full https://...blob.vercel-storage.com/... URL, safe to store
    and use as-is (not a path relative to our own API, which would 404 once
    this serverless function's ephemeral filesystem cycles)."""
    ext = Path(file.filename or "").suffix
    pathname = f"{folder}/{uuid.uuid4().hex}{ext}"
    result = vercel_blob.put(pathname, file.file.read(), {"addRandomSuffix": "false"})
    return result["url"]


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
