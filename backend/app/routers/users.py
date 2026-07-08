"""Company Admin user APIs (Super Admin manages platform users).

GET  /users                      -> list users
POST /users                      -> create a Company Admin by hand
PUT  /users/{id}/status          -> activate / deactivate a user
POST /users/{id}/reset-password  -> give the user a new temp password
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import hash_password, require_super_admin
from app.utils import add_audit_log, generate_temp_password, send_email

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[schemas.UserOut])
def list_users(
    role: Optional[str] = None,
    company_id: Optional[int] = None,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.User)
    if role:
        query = query.filter(models.User.role == role)
    if company_id:
        query = query.filter(models.User.company_id == company_id)
    return query.order_by(models.User.created_at.desc()).all()


@router.post("", response_model=schemas.UserOut)
def create_company_admin(
    body: schemas.UserCreate,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Create an extra Company Admin for a company (approval already creates one)."""
    company = db.get(models.Company, body.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    exists = db.query(models.User).filter(models.User.email == body.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="This email is already used")

    temp_password = generate_temp_password()
    user = models.User(
        company_id=body.company_id,
        name=body.name,
        email=body.email,
        password_hash=hash_password(temp_password),
        role=models.UserRole.company_admin,
        is_temp_password=True,
    )
    db.add(user)

    send_email(
        body.email, "Your HRMS admin account",
        f"Hello {body.name},\n\nAn admin account was created for you.\n"
        f"Email    : {body.email}\n"
        f"Password : {temp_password} (temporary — change it on first login)\n",
    )
    add_audit_log(db, "create_user", "users",
                  f"Created company admin {body.email} for {company.company_name}",
                  user_id=admin.id, request=request)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/status")
def set_user_status(
    user_id: int,
    status: str,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Set a user active or inactive. Example: PUT /users/5/status?status=inactive"""
    if status not in ("active", "inactive"):
        raise HTTPException(status_code=400, detail="Status must be active or inactive")

    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == models.UserRole.super_admin:
        raise HTTPException(status_code=400, detail="Cannot change Super Admin status")

    user.status = status
    add_audit_log(db, "set_user_status", "users",
                  f"Set {user.email} status to {status}",
                  user_id=admin.id, request=request)
    db.commit()
    return {"message": f"{user.email} is now {status}"}


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    temp_password = generate_temp_password()
    user.password_hash = hash_password(temp_password)
    user.is_temp_password = True

    send_email(
        user.email, "Your HRMS password was reset",
        f"Hello {user.name},\n\nYour new temporary password: {temp_password}\n"
        f"Please change it after login.\n",
    )
    add_audit_log(db, "reset_password", "users",
                  f"Reset password for {user.email}", user_id=admin.id, request=request)
    db.commit()
    return {
        "message": f"Password reset for {user.email}",
        # Shown here only because email is not connected yet. Remove in production.
        "temp_password": temp_password,
    }
