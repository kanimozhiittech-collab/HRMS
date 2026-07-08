"""Notification APIs.

GET /notifications            -> list notifications (newest first)
PUT /notifications/{id}/read  -> mark one as read
PUT /notifications/read-all   -> mark all as read
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import require_super_admin

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[schemas.NotificationOut])
def list_notifications(
    unread_only: bool = False,
    type: Optional[str] = None,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Notification)
    if unread_only:
        query = query.filter(models.Notification.is_read == False)  # noqa: E712
    if type:
        query = query.filter(models.Notification.type == type)
    return query.order_by(models.Notification.created_at.desc()).limit(100).all()


@router.put("/{notification_id}/read")
def mark_read(
    notification_id: int,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    notif = db.get(models.Notification, notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"message": "Marked as read"}


@router.put("/read-all")
def mark_all_read(
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    db.query(models.Notification).filter(
        models.Notification.is_read == False  # noqa: E712
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}
