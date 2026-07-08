"""Password hashing + login tokens (JWT) + route protection."""
from datetime import datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import models
from app.config import SECRET_KEY, TOKEN_EXPIRE_MINUTES
from app.database import get_db

bearer_scheme = HTTPBearer()


# ---------- Passwords ----------

def hash_password(plain: str) -> str:
    """Turn a plain password into a safe hash for storing in DB."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Check a plain password against the stored hash."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------- Tokens ----------

def create_token(user_id: int) -> str:
    """Create a login token that expires after TOKEN_EXPIRE_MINUTES."""
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


# ---------- Route protection ----------

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    """Read the token from the request and return the logged-in user."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired, please login again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.get(models.User, payload["user_id"])
    if not user or user.status != models.UserStatus.active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_super_admin(
    user: models.User = Depends(get_current_user),
) -> models.User:
    """Allow only the Super Admin. Use this on all admin routes."""
    if user.role != models.UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Only Super Admin can do this")
    return user
