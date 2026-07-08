"""Subscription APIs (Phase 7).

GET  /subscriptions               -> list all subscriptions
GET  /subscriptions/{id}          -> one subscription
POST /subscriptions/{id}/extend   -> add extra days by hand
POST /subscriptions/check-expiry  -> run the daily expiry check now
"""
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.expiry import run_expiry_check
from app.security import require_super_admin
from app.utils import add_audit_log

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@router.get("", response_model=list[schemas.SubscriptionOut])
def list_subscriptions(
    status: Optional[str] = None,
    company_id: Optional[int] = None,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Subscription)
    if status:
        query = query.filter(models.Subscription.status == status)
    if company_id:
        query = query.filter(models.Subscription.company_id == company_id)
    return query.order_by(models.Subscription.end_date).all()


@router.get("/{subscription_id}", response_model=schemas.SubscriptionOut)
def get_subscription(
    subscription_id: int,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    sub = db.get(models.Subscription, subscription_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return sub


@router.post("/{subscription_id}/extend", response_model=schemas.SubscriptionOut)
def extend_subscription(
    subscription_id: int,
    body: schemas.ExtendRequest,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Manually add days to a subscription (example: goodwill extension)."""
    sub = db.get(models.Subscription, subscription_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    sub.end_date = sub.end_date + timedelta(days=body.days)
    sub.status = models.SubscriptionStatus.active

    # If company was suspended for expiry, bring it back
    company = db.get(models.Company, sub.company_id)
    if company.status == models.CompanyStatus.suspended:
        company.status = models.CompanyStatus.active

    add_audit_log(db, "extend_subscription", "subscriptions",
                  f"Extended subscription {sub.id} by {body.days} days",
                  user_id=admin.id, request=request)
    db.commit()
    db.refresh(sub)
    return sub


@router.post("/check-expiry")
def check_expiry(
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Run the expiry check now (same job that runs automatically daily)."""
    return run_expiry_check(db)
