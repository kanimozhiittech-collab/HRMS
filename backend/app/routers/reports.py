"""Reports & Analytics APIs (Phase 8.2 + 8.3).

GET /reports/revenue?year=2026   -> revenue collected per month
GET /reports/company-stats       -> companies by status and by plan
GET /reports/user-growth?year=2026 -> new companies + new users per month
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.security import require_super_admin

router = APIRouter(prefix="/reports", tags=["Reports"])

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


@router.get("/revenue")
def revenue_report(
    year: int = None,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Paid amount per month for the given year (default: this year)."""
    year = year or datetime.utcnow().year
    rows = (
        db.query(
            extract("month", models.Payment.payment_date).label("month"),
            func.sum(models.Payment.amount).label("total"),
        )
        .filter(models.Payment.status == models.PaymentStatus.paid,
                extract("year", models.Payment.payment_date) == year)
        .group_by("month")
        .all()
    )
    totals = {int(r.month): float(r.total) for r in rows}
    return {
        "year": year,
        "monthly_revenue": [
            {"month": MONTH_NAMES[m - 1], "revenue": totals.get(m, 0.0)}
            for m in range(1, 13)
        ],
        "total_revenue": sum(totals.values()),
    }


@router.get("/company-stats")
def company_stats(
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """How many companies in each status, and how many on each plan."""
    by_status = (
        db.query(models.Company.status, func.count(models.Company.id))
        .group_by(models.Company.status).all()
    )
    by_plan = (
        db.query(models.Plan.plan_name, func.count(models.Company.id))
        .join(models.Company, models.Company.plan_id == models.Plan.id)
        .group_by(models.Plan.plan_name).all()
    )
    return {
        "by_status": {status.value: count for status, count in by_status},
        "by_plan": {plan_name: count for plan_name, count in by_plan},
    }


@router.get("/user-growth")
def user_growth(
    year: int = None,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """New companies and new users registered per month."""
    year = year or datetime.utcnow().year

    def per_month(model):
        rows = (
            db.query(extract("month", model.created_at).label("month"),
                     func.count(model.id).label("total"))
            .filter(extract("year", model.created_at) == year)
            .group_by("month").all()
        )
        totals = {int(r.month): r.total for r in rows}
        return [{"month": MONTH_NAMES[m - 1], "count": totals.get(m, 0)}
                for m in range(1, 13)]

    return {
        "year": year,
        "new_companies": per_month(models.Company),
        "new_users": per_month(models.User),
    }
