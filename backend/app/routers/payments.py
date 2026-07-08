"""Billing & Invoice APIs (Phase 8.1 + Phase 7.3).

POST /payments/invoice     -> generate an invoice (pending payment) for a company
GET  /payments             -> list all payments/invoices
GET  /payments/{id}        -> one payment
POST /payments/{id}/pay    -> mark invoice as paid -> subscription extends automatically
POST /payments/{id}/fail   -> mark payment as failed
"""
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import require_super_admin
from app.utils import (add_audit_log, add_notification,
                       generate_invoice_number, send_email)

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/invoice", response_model=schemas.PaymentOut)
def generate_invoice(
    body: schemas.InvoiceCreate,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Create an invoice for a company's latest subscription.
    If amount is not given, the plan's monthly price is used."""
    company = db.get(models.Company, body.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    subscription = (
        db.query(models.Subscription)
        .filter(models.Subscription.company_id == company.id)
        .order_by(models.Subscription.id.desc())
        .first()
    )
    if not subscription:
        raise HTTPException(status_code=400, detail="Company has no subscription")

    plan = db.get(models.Plan, subscription.plan_id)
    amount = body.amount if body.amount is not None else plan.monthly_price

    payment = models.Payment(
        company_id=company.id,
        subscription_id=subscription.id,
        invoice_number=generate_invoice_number(db),
        amount=amount,
        status=models.PaymentStatus.pending,
    )
    db.add(payment)

    send_email(
        company.admin_email, "HRMS invoice generated",
        f"Hello {company.admin_name},\n\nInvoice {payment.invoice_number} "
        f"for Rs.{amount} is generated. Please pay to continue your subscription.\n",
    )
    add_audit_log(db, "generate_invoice", "payments",
                  f"Invoice {payment.invoice_number} for {company.company_name}",
                  user_id=admin.id, request=request)
    db.commit()
    db.refresh(payment)
    return payment


@router.get("", response_model=list[schemas.PaymentOut])
def list_payments(
    status: Optional[str] = None,
    company_id: Optional[int] = None,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Payment)
    if status:
        query = query.filter(models.Payment.status == status)
    if company_id:
        query = query.filter(models.Payment.company_id == company_id)
    return query.order_by(models.Payment.created_at.desc()).all()


@router.get("/{payment_id}", response_model=schemas.PaymentOut)
def get_payment(
    payment_id: int,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    payment = db.get(models.Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.post("/{payment_id}/pay", response_model=schemas.PaymentOut)
def mark_paid(
    payment_id: int,
    body: schemas.PayRequest,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Payment received (Phase 7.3):
    invoice becomes paid -> subscription +30 days -> company active again."""
    payment = db.get(models.Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status == models.PaymentStatus.paid:
        raise HTTPException(status_code=400, detail="Already paid")

    payment.status = models.PaymentStatus.paid
    payment.payment_method = body.payment_method
    payment.transaction_id = body.transaction_id
    payment.payment_date = datetime.utcnow()

    # Extend the subscription by 30 days
    sub = db.get(models.Subscription, payment.subscription_id)
    base = sub.end_date if sub.end_date > date.today() else date.today()
    sub.end_date = base + timedelta(days=30)
    sub.status = models.SubscriptionStatus.active

    # If company was suspended for non-payment, activate it again
    company = db.get(models.Company, payment.company_id)
    if company.status == models.CompanyStatus.suspended:
        company.status = models.CompanyStatus.active

    add_notification(db, "payment_received", "Payment received",
                     f"{company.company_name} paid invoice {payment.invoice_number}. "
                     f"Subscription extended to {sub.end_date}.",
                     company_id=company.id)
    add_audit_log(db, "mark_paid", "payments",
                  f"Invoice {payment.invoice_number} paid, subscription "
                  f"extended to {sub.end_date}", user_id=admin.id, request=request)
    db.commit()
    db.refresh(payment)
    return payment


@router.post("/{payment_id}/fail", response_model=schemas.PaymentOut)
def mark_failed(
    payment_id: int,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    payment = db.get(models.Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    payment.status = models.PaymentStatus.failed
    add_audit_log(db, "mark_failed", "payments",
                  f"Invoice {payment.invoice_number} marked failed",
                  user_id=admin.id, request=request)
    db.commit()
    db.refresh(payment)
    return payment
