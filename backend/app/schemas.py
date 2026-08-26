"""Request and response shapes (Pydantic schemas).

Request schema  = what the API expects as input (JSON body)
Response schema = what the API sends back
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


# ---------- Auth ----------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    is_temp_password: bool  # True = user must change password now


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


# ---------- Plans ----------

class PlanCreate(BaseModel):
    plan_name: str
    monthly_price: Decimal = 0
    max_employees: int = 10
    included_modules: list[str] = []
    trial_period_days: int = 0
    status: str = "active"


class PlanUpdate(BaseModel):
    plan_name: Optional[str] = None
    monthly_price: Optional[Decimal] = None
    max_employees: Optional[int] = None
    included_modules: Optional[list[str]] = None
    trial_period_days: Optional[int] = None
    status: Optional[str] = None


class PlanOut(BaseModel):
    id: int
    plan_name: str
    monthly_price: Decimal
    max_employees: int
    included_modules: Optional[str] = None
    trial_period_days: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Companies ----------

class CompanyRegister(BaseModel):
    """Public form a new company fills to join the platform."""
    company_name: str
    admin_name: str
    admin_email: EmailStr
    phone: str
    plan_id: int

    @field_validator("phone")
    @classmethod
    def phone_must_be_digits(cls, v: str) -> str:
        if not v or not v.isdigit():
            raise ValueError("Phone must contain digits only")
        if len(v) != 10:
            raise ValueError("Phone must be exactly 10 digits")
        return v


class CompanyOut(BaseModel):
    id: int
    company_name: str
    admin_name: str
    admin_email: str
    phone: Optional[str] = None
    plan_id: int
    database_type: Optional[str] = None
    database_name: Optional[str] = None
    status: str
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyRegisterOut(CompanyOut):
    """Same as CompanyOut, plus the temp password since registration is
    auto-approved and there's no separate approval step to show it in."""
    temp_password: str


# ---------- Users ----------

class UserCreate(BaseModel):
    """Super Admin manually creates a Company Admin."""
    company_id: int
    name: str
    email: EmailStr


class UserOut(BaseModel):
    id: int
    company_id: Optional[int] = None
    name: str
    email: str
    role: str
    is_temp_password: bool
    status: str
    last_login: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Subscriptions ----------

class SubscriptionOut(BaseModel):
    id: int
    company_id: int
    plan_id: int
    start_date: date
    end_date: date
    status: str
    auto_renew: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ExtendRequest(BaseModel):
    days: int = 30  # how many days to add


# ---------- Payments ----------

class InvoiceCreate(BaseModel):
    company_id: int
    amount: Optional[Decimal] = None  # empty = use plan monthly price


class PayRequest(BaseModel):
    payment_method: str  # example: "upi", "card", "bank_transfer"
    transaction_id: Optional[str] = None


class PaymentOut(BaseModel):
    id: int
    company_id: int
    subscription_id: int
    invoice_number: str
    amount: Decimal
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    status: str
    payment_date: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Support Tickets ----------

class TicketCreate(BaseModel):
    subject: str
    description: Optional[str] = None
    priority: str = "medium"


class TicketUpdate(BaseModel):
    status: Optional[str] = None      # open / in_progress / resolved / closed
    priority: Optional[str] = None


class TicketOut(BaseModel):
    id: int
    company_id: int
    raised_by: Optional[int] = None
    raised_by_name: Optional[str] = None
    raised_by_email: Optional[str] = None
    subject: str
    description: Optional[str] = None
    priority: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ExternalTicketCreate(BaseModel):
    """Raised from the company-side app (hrms-app) by any logged-in user,
    not just the company_admin — authenticated via a shared secret, not a
    Super Admin JWT, since that user has no login here."""
    company_id: int
    raised_by_name: str
    raised_by_email: str
    subject: str
    description: Optional[str] = None
    priority: str = "medium"


# ---------- Notifications ----------

class NotificationOut(BaseModel):
    id: int
    company_id: Optional[int] = None
    user_id: Optional[int] = None
    type: str
    title: str
    message: Optional[str] = None
    is_read: bool
    sent_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---------- Audit Logs ----------

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    module: str
    description: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Global Settings ----------

class SettingOut(BaseModel):
    setting_key: str
    setting_value: Optional[str] = None
    description: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---------- Dashboard ----------

class DashboardOut(BaseModel):
    total_companies: int
    active_companies: int
    pending_companies: int
    suspended_companies: int
    total_users: int          # platform users (company admins). Employee data lives in each company DB
    monthly_revenue: Decimal
    open_tickets: int
    expiring_soon: list[SubscriptionOut]  # subscriptions expiring within reminder days
