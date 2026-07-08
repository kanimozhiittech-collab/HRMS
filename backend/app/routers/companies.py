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

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import hash_password, require_super_admin
from app.utils import (add_audit_log, add_notification, generate_temp_password,
                       send_email)

router = APIRouter(prefix="/companies", tags=["Companies"])


# ---------- Phase 3: public registration ----------

@router.post("/register", response_model=schemas.CompanyOut)
def register_company(body: schemas.CompanyRegister, db: Session = Depends(get_db)):
    """A new company fills the registration form. Status starts as 'pending'."""
    plan = db.get(models.Plan, body.plan_id)
    if not plan or plan.status != models.PlanStatus.active:
        raise HTTPException(status_code=400, detail="Selected plan is not available")

    # Same email should not already be a user
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
    db.flush()  # gives company.id before commit

    # Tell the Super Admin a new registration arrived (Phase 3.2)
    add_notification(
        db, "new_registration", "New company registration",
        f"{body.company_name} registered and is waiting for approval.",
        company_id=company.id,
    )
    add_audit_log(db, "register", "companies",
                  f"{body.company_name} submitted registration")
    db.commit()
    db.refresh(company)
    return company


# ---------- Super Admin: list and view ----------

@router.get("", response_model=list[schemas.CompanyOut])
def list_companies(
    status: Optional[str] = None,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Company)
    if status:
        query = query.filter(models.Company.status == status)
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
    """One click does everything:
    1. Company becomes active
    2. Subscription is created from the selected plan
    3. Company database name is decided (dedicated for Enterprise, shared for others)
    4. Company Admin user is created with a temporary password
    5. Welcome email is sent
    """
    company = db.get(models.Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.status != models.CompanyStatus.pending:
        raise HTTPException(status_code=400, detail="Only pending companies can be approved")

    plan = db.get(models.Plan, company.plan_id)

    # Step 1: activate company
    company.status = models.CompanyStatus.active
    company.approved_by = admin.id
    company.approved_at = datetime.utcnow()

    # Step 2: create subscription (trial days if plan has them, else 30 days)
    days = plan.trial_period_days if plan.trial_period_days > 0 else 30
    subscription = models.Subscription(
        company_id=company.id,
        plan_id=plan.id,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=days),
        status=models.SubscriptionStatus.active,
    )
    db.add(subscription)

    # Step 3: decide database (Enterprise plan = dedicated, others = shared)
    if "enterprise" in plan.plan_name.lower():
        company.database_type = models.DatabaseType.dedicated
        company.database_name = f"hrms_company_{company.id}"
    else:
        company.database_type = models.DatabaseType.shared
        company.database_name = "hrms_shared"
    # NOTE: actual tenant database creation + migration happens in the
    # company-side HRMS project. Here we only record which database to use.

    # Step 4: create the Company Admin user with a temp password
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

    # Step 5: welcome email (prints to console until SMTP is connected)
    send_email(
        company.admin_email,
        "Welcome to HRMS — your account is ready",
        f"Hello {company.admin_name},\n\n"
        f"Your company '{company.company_name}' is approved!\n"
        f"Login URL : http://your-domain.com\n"
        f"Email     : {company.admin_email}\n"
        f"Password  : {temp_password} (temporary — you must change it on first login)\n",
    )

    add_notification(db, "company_approved", "Company approved",
                     f"{company.company_name} was approved.", company_id=company.id)
    add_audit_log(db, "approve_company", "companies",
                  f"Approved {company.company_name}", user_id=admin.id, request=request)
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
