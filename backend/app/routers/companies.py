"""Company APIs (Phase 3 + Phase 4).

POST /companies/register        -> public: a new company asks to join
GET  /companies                 -> list companies (Super Admin)
GET  /companies/{id}            -> one company (Super Admin)
POST /companies/{id}/approve    -> approve: does the full onboarding chain
POST /companies/{id}/reject     -> reject a pending registration
POST /companies/{id}/suspend    -> suspend an active company
POST /companies/{id}/reactivate -> reactivate a suspended company
"""
from datetime import date, datetime, timedelta
from typing import Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Request
import sqlalchemy as sa
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import COMPANY_HRMS_URL, PROVISION_SECRET
from app.database import get_db
from app.security import hash_password, require_super_admin
from app.utils import (add_audit_log, add_notification, generate_temp_password,
                       get_setting, send_email)

router = APIRouter(prefix="/companies", tags=["Companies"])


def _provision_tenant(company: "models.Company", admin_name: str, temp_password: str) -> None:
    """Tell the company-side HRMS app to create this company + admin login.
    Raises if it fails, so the approval transaction rolls back and can be retried."""
    try:
        resp = requests.post(
            f"{COMPANY_HRMS_URL}/api/provisioning/companies",
            json={
                "company_id": company.id,
                "company_name": company.company_name,
                "admin_name": admin_name,
                "admin_email": company.admin_email,
                "phone": company.phone,
                "temp_password": temp_password,
            },
            headers={"X-Provision-Secret": PROVISION_SECRET},
            timeout=10,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(502, f"Could not provision tenant in company HRMS app: {e}")


def _onboard_company(db: Session, company: "models.Company", request: Request = None,
                     admin_id: Optional[int] = None) -> str:
    """The full onboarding chain, shared by auto-approve (register) and manual approve:
    1. Company becomes active
    2. Subscription is created from the selected plan
    3. Company database name is decided (dedicated for Enterprise, shared for others)
    4. Company Admin user + tenant are created (locally and in the company-side HRMS app)
    5. Welcome email is sent
    Returns the generated temp password.
    """
    plan = db.get(models.Plan, company.plan_id)

    company.status = models.CompanyStatus.active
    company.approved_by = admin_id
    company.approved_at = datetime.utcnow()

    days = plan.trial_period_days if plan.trial_period_days > 0 else 30
    subscription = models.Subscription(
        company_id=company.id,
        plan_id=plan.id,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=days),
        status=models.SubscriptionStatus.active,
    )
    db.add(subscription)

    if "enterprise" in plan.plan_name.lower():
        company.database_type = models.DatabaseType.dedicated
        company.database_name = f"hrms_company_{company.id}"
    else:
        company.database_type = models.DatabaseType.shared
        company.database_name = "hrms_shared"

    temp_password = generate_temp_password()
    company_admin = models.User(
        company_id=company.id,
        name=company.admin_name,
        email=company.admin_email,
        password_hash=hash_password(temp_password),
        role=models.UserRole.company_admin,
        is_temp_password=True,
    )
    db.add(company_admin)

    _provision_tenant(company, company.admin_name, temp_password)

    login_url = get_setting(db, "company_login_url", "http://your-domain.com")
    send_email(
        company.admin_email,
        "Welcome to HRMS — your account is ready",
        f"Hello {company.admin_name},\n\n"
        f"Your company '{company.company_name}' is approved!\n"
        f"Login URL : {login_url}\n"
        f"Email     : {company.admin_email}\n"
        f"Password  : {temp_password} (temporary — you must change it on first login)\n",
    )

    add_notification(db, "company_approved", "Company approved",
                     f"{company.company_name} was approved.", company_id=company.id)
    add_audit_log(db, "approve_company", "companies",
                  f"Approved {company.company_name}", user_id=admin_id, request=request)
    return temp_password


# ---------- Phase 3: public registration (auto-approved) ----------

@router.post("/register", response_model=schemas.CompanyRegisterOut)
def register_company(body: schemas.CompanyRegister, db: Session = Depends(get_db)):
    """A new company fills the registration form and is onboarded immediately —
    no manual review. Their admin login is created right away, here and in the
    company-side HRMS app, and shown in the response."""
    plan = db.get(models.Plan, body.plan_id)
    if not plan or plan.status != models.PlanStatus.active:
        raise HTTPException(status_code=400, detail="Selected plan is not available")

    exists = db.query(models.User).filter(models.User.email == body.admin_email).first()
    if exists:
        raise HTTPException(status_code=400, detail="This admin email is already used")

    company = models.Company(
        company_name=body.company_name,
        admin_name=body.admin_name,
        admin_email=body.admin_email,
        phone=body.phone,
        plan_id=body.plan_id,
        status=models.CompanyStatus.pending,
    )
    db.add(company)
    db.flush()  # gives company.id before onboarding needs it

    temp_password = _onboard_company(db, company)
    add_audit_log(db, "register", "companies",
                  f"{body.company_name} registered and was auto-approved")
    db.commit()
    db.refresh(company)

    result = schemas.CompanyOut.model_validate(company).model_dump()
    result["temp_password"] = temp_password
    return result


# ---------- Super Admin: list and view ----------

@router.get("", response_model=list[schemas.CompanyOut])
def list_companies(
    status: Optional[str] = None,
    q: Optional[str] = None,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Company)
    if status:
        query = query.filter(models.Company.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(sa.or_(
            models.Company.company_name.ilike(like),
            models.Company.admin_name.ilike(like),
            models.Company.admin_email.ilike(like),
        ))
    return query.order_by(models.Company.created_at.desc()).all()


@router.get("/{company_id}", response_model=schemas.CompanyOut)
def get_company(
    company_id: int,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


# ---------- Phase 4: approve (the full onboarding chain) ----------

@router.post("/{company_id}/approve")
def approve_company(
    company_id: int,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """For any company that's still 'pending' (registered before auto-approve
    existed). Runs the same onboarding chain registration now does automatically."""
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.status != models.CompanyStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending companies can be approved")

    temp_password = _onboard_company(db, company, request=request, admin_id=admin.id)
    db.commit()

    return {
        "message": f"{company.company_name} approved successfully",
        "company_admin_email": company.admin_email,
        # Shown here only because email is not connected yet. Remove in production.
        "temp_password": temp_password,
    }


@router.post("/{company_id}/reject")
def reject_company(
    company_id: int,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.status != models.CompanyStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending companies can be rejected")

    company.status = models.CompanyStatus.rejected
    add_audit_log(db, "reject_company", "companies",
                  f"Rejected {company.company_name}", user_id=admin.id, request=request)
    db.commit()
    return {"message": f"{company.company_name} rejected"}


@router.post("/{company_id}/suspend")
def suspend_company(
    company_id: int,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Suspend a company — its admins cannot login anymore."""
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    company.status = models.CompanyStatus.suspended
    add_notification(db, "company_suspended", "Company suspended",
                     f"{company.company_name} was suspended.", company_id=company.id)
    add_audit_log(db, "suspend_company", "companies",
                  f"Suspended {company.company_name}", user_id=admin.id, request=request)
    db.commit()
    return {"message": f"{company.company_name} suspended. Logins are disabled."}


@router.post("/{company_id}/reactivate")
def reactivate_company(
    company_id: int,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.status != models.CompanyStatus.suspended:
        raise HTTPException(status_code=400, detail="Only suspended companies can be reactivated")

    company.status = models.CompanyStatus.active
    add_audit_log(db, "reactivate_company", "companies",
                  f"Reactivated {company.company_name}", user_id=admin.id, request=request)
    db.commit()
    return {"message": f"{company.company_name} is active again"}


@router.delete("/{company_id}")
def delete_company(
    company_id: int,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Permanently remove a company record and everything tied to it here
    (subscription, invoices, tickets, notifications, the local admin login),
    then best-effort ask the company-side HRMS app to remove its matching
    tenant too (it refuses if that tenant has real employee data)."""
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    name = company.company_name
    admin_email = company.admin_email
    user_ids = [u.id for u in db.query(models.User.id).filter(models.User.company_id == company_id).all()]
    if user_ids:
        db.query(models.AuditLog).filter(models.AuditLog.user_id.in_(user_ids)).update(
            {"user_id": None}, synchronize_session=False
        )
    db.query(models.Payment).filter(models.Payment.company_id == company_id).delete(synchronize_session=False)
    db.query(models.SupportTicket).filter(models.SupportTicket.company_id == company_id).delete(synchronize_session=False)
    db.query(models.Notification).filter(models.Notification.company_id == company_id).delete(synchronize_session=False)
    db.query(models.Subscription).filter(models.Subscription.company_id == company_id).delete(synchronize_session=False)
    db.query(models.User).filter(models.User.company_id == company_id).delete(synchronize_session=False)

    add_audit_log(db, "delete_company", "companies",
                  f"Deleted {name}", user_id=admin.id, request=request)
    db.delete(company)
    db.commit()

    tenant_note = None
    try:
        resp = requests.delete(
            f"{COMPANY_HRMS_URL}/api/provisioning/companies",
            params={"admin_email": admin_email},
            headers={"X-Provision-Secret": PROVISION_SECRET},
            timeout=10,
        )
        if resp.status_code == 200:
            tenant_note = resp.json().get("status")
        else:
            tenant_note = f"tenant cleanup failed ({resp.status_code}): {resp.text[:200]}"
    except requests.RequestException as e:
        tenant_note = f"could not reach company HRMS app: {e}"

    return {"message": f"{name} deleted", "tenant_cleanup": tenant_note}
