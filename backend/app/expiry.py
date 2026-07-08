"""Subscription expiry check (Phase 7).

This runs automatically every day (started in main.py),
and can also be run by hand: POST /subscriptions/check-expiry
"""
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app import models
from app.config import RENEWAL_REMINDER_DAYS
from app.utils import add_notification, send_email


def run_expiry_check(db: Session) -> dict:
    today = date.today()
    reminder_limit = today + timedelta(days=RENEWAL_REMINDER_DAYS)
    reminded, suspended = 0, 0

    active_subs = (
        db.query(models.Subscription)
        .filter(models.Subscription.status == models.SubscriptionStatus.active)
        .all()
    )

    for sub in active_subs:
        company = db.get(models.Company, sub.company_id)

        # Case 1: already expired -> suspend company, disable login (Phase 7.4)
        if sub.end_date < today:
            sub.status = models.SubscriptionStatus.expired
            company.status = models.CompanyStatus.suspended
            add_notification(
                db, "subscription_expired", "Subscription expired",
                f"{company.company_name} subscription expired on {sub.end_date}. "
                f"Company suspended.", company_id=company.id,
            )
            send_email(
                company.admin_email, "HRMS subscription expired",
                f"Hello {company.admin_name},\n\nYour subscription expired on "
                f"{sub.end_date}. Your account is suspended until payment is made.",
            )
            suspended += 1

        # Case 2: expiring soon -> send renewal reminder (Phase 7.2)
        elif sub.end_date <= reminder_limit:
            add_notification(
                db, "renewal_reminder", "Subscription expiring soon",
                f"{company.company_name} subscription expires on {sub.end_date}.",
                company_id=company.id,
            )
            send_email(
                company.admin_email, "HRMS subscription renewal reminder",
                f"Hello {company.admin_name},\n\nYour subscription expires on "
                f"{sub.end_date}. Please renew to avoid suspension.",
            )
            reminded += 1

    db.commit()
    return {"reminders_sent": reminded, "companies_suspended": suspended}
