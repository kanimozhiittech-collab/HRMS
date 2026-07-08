"""Audit Log APIs (Phase 6.3) — read only. Logs are created by other APIs.

GET /audit-logs -> list logs, newest first (filter by module / user_id)
"""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import require_super_admin

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=list[schemas.AuditLogOut])
def list_audit_logs(
    module: Optional[str] = None,
    user_id: Optional[int] = None,
    limit: int = 100,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.AuditLog)
    if module:
        query = query.filter(models.AuditLog.module == module)
    if user_id:
        query = query.filter(models.AuditLog.user_id == user_id)
    return query.order_by(models.AuditLog.created_at.desc()).limit(limit).all()
