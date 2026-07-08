"""Dashboard API (Phase 1.4 - 1.6).

GET /dashboard -> all KPI numbers in one call:
Total Companies, Active/Pending/Suspended Companies, Total Users,
Monthly Revenue, Open Tickets, Subscriptions Expiring Soon
"""
from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import RENEWAL_REMINDER_DAYS
from app.database import get_db
from app.security import require_super_admin

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=schemas.DashboardOut)
def dashboard(
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    Company, Sub, Pay, Ticket = (models.Company, models.Subscription,
                                 models.Payment, models.SupportTicket)

    def count_companies(status=None):
        q = db.query(Company)
        if status:
            q = q.filter(Company.status == status)
        return q.count()

    # Revenue = total of paid payments in the current month
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
    monthly_revenue = (
        db.query(func.coalesce(func.sum(Pay.amount), 0))
        .filter(Pay.status == models.PaymentStatus.paid,
                Pay.payment_date >= month_start)
        .scalar()
    )

    # Subscriptions expiring within the reminder window (Phase 1.6)
    expiring_soon = (
        db.query(Sub)
        .filter(Sub.status == models.SubscriptionStatus.active,
                Sub.end_date <= date.today() + timedelta(days=RENEWAL_REMINDER_DAYS))
        .order_by(Sub.end_date)
        .all()
    )

    open_tickets = (
        db.query(Ticket)
        .filter(Ticket.status.in_([models.TicketStatus.open,
                                   models.TicketStatus.in_progress]))
        .count()
    )

    return schemas.DashboardOut(
        total_companies=count_companies(),
        active_companies=count_companies(models.CompanyStatus.active),
        pending_companies=count_companies(models.CompanyStatus.pending),
        suspended_companies=count_companies(models.CompanyStatus.suspended),
        total_users=db.query(models.User).count(),
        monthly_revenue=Decimal(monthly_revenue),
        open_tickets=open_tickets,
        expiring_soon=expiring_soon,
    )
