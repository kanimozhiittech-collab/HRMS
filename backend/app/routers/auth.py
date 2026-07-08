"""Login APIs (Phase 1 + Phase 5).

POST /auth/login            -> login with email + password, get a token
POST /auth/change-password  -> change password (needed after temp password)
GET  /auth/me               -> info about the logged-in user
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import (create_token, get_current_user, hash_password,
                          verify_password)
from app.utils import add_audit_log

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=schemas.LoginResponse)
def login(body: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong email or password")

    if user.status != models.UserStatus.active:
        raise HTTPException(status_code=403, detail="Your account is inactive")

    # Company admin cannot login if the company is suspended (Phase 7.4)
    if user.role == models.UserRole.company_admin:
        company = db.get(models.Company, user.company_id)
        if not company or company.status != models.CompanyStatus.active:
            raise HTTPException(
                status_code=403,
                detail="Company is suspended. Please renew your subscription.",
            )

    user.last_login = datetime.utcnow()
    add_audit_log(db, "login", "auth", f"{user.email} logged in",
                  user_id=user.id, request=request)
    db.commit()

    return schemas.LoginResponse(
        access_token=create_token(user.id),
        role=user.role.value,
        name=user.name,
        is_temp_password=user.is_temp_password,
    )


@router.post("/change-password")
def change_password(
    body: schemas.ChangePasswordRequest,
    request: Request,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Old password is wrong")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    user.password_hash = hash_password(body.new_password)
    user.is_temp_password = False  # temp password flow finished (Phase 5.2)
    add_audit_log(db, "change_password", "auth", f"{user.email} changed password",
                  user_id=user.id, request=request)
    db.commit()
    return {"message": "Password changed successfully"}


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user
