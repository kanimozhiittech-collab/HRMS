"""Global Settings APIs (Super Admin module).

GET /settings -> all platform settings
PUT /settings -> update settings (send only the keys you want to change)

Example PUT body:
    {"platform_name": "My HRMS", "renewal_reminder_days": "10"}
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import require_super_admin
from app.utils import add_audit_log

router = APIRouter(prefix="/settings", tags=["Global Settings"])


@router.get("", response_model=list[schemas.SettingOut])
def get_settings(
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    return db.query(models.Setting).order_by(models.Setting.setting_key).all()


@router.put("", response_model=list[schemas.SettingOut])
def update_settings(
    body: dict[str, str],
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Update settings. New keys are created, existing keys are updated."""
    for key, value in body.items():
        setting = db.query(models.Setting).filter(
            models.Setting.setting_key == key).first()
        if setting:
            setting.setting_value = value
        else:
            db.add(models.Setting(setting_key=key, setting_value=value))

    add_audit_log(db, "update_settings", "settings",
                  f"Updated settings: {', '.join(body.keys())}",
                  user_id=admin.id, request=request)
    db.commit()
    return db.query(models.Setting).order_by(models.Setting.setting_key).all()
