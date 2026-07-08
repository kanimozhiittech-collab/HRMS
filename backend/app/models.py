"""All 8 database tables (SQLAlchemy models).

Tables: plans, companies, users, subscriptions, payments,
        support_tickets, notifications, audit_logs
"""
import enum
from datetime import datetime

from sqlalchemy import (Boolean, Column, Date, DateTime, Enum, ForeignKey,
                        Integer, Numeric, String, Text)
from sqlalchemy.orm import relationship

from app.database import Base


# ---------- Fixed choice values (enums) ----------

class DatabaseType(str, enum.Enum):
    shared = "shared"
    dedicated = "dedicated"


class CompanyStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    active = "active"
    suspended = "suspended"


class PlanStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    suspended = "suspended"


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    company_admin = "company_admin"


class UserStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class PaymentStatus(str, enum.Enum):
    paid = "paid"
    pending = "pending"
    failed = "failed"


class TicketPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class TicketStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


# ---------- Table 2: plans ----------

class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True)
    plan_name = Column(String(100), nullable=False)
    monthly_price = Column(Numeric(10, 2), nullable=False, default=0)
    max_employees = Column(Integer, nullable=False, default=10)
    included_modules = Column(Text)  # JSON list, example: ["Attendance", "Leave"]
    trial_period_days = Column(Integer, default=0)
    status = Column(Enum(PlanStatus, name="plan_status"), default=PlanStatus.active)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ---------- Table 1: companies ----------

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True)
    company_name = Column(String(150), nullable=False)
    admin_name = Column(String(100), nullable=False)
    admin_email = Column(String(150), nullable=False)
    phone = Column(String(20))
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    database_type = Column(Enum(DatabaseType, name="database_type"),
                           default=DatabaseType.shared)
    database_name = Column(String(100))
    status = Column(Enum(CompanyStatus, name="company_status"),
                    default=CompanyStatus.pending)
    approved_by = Column(Integer,
                         ForeignKey("users.id", use_alter=True,
                                    name="fk_companies_approved_by"),
                         nullable=True)
    approved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plan = relationship("Plan")


# ---------- Table 4: users (super admin + company admins only) ----------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, name="user_role"), nullable=False)
    is_temp_password = Column(Boolean, default=False)
    status = Column(Enum(UserStatus, name="user_status"), default=UserStatus.active)
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("Company", foreign_keys=[company_id])


# ---------- Table 3: subscriptions ----------

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(Enum(SubscriptionStatus, name="subscription_status"),
                    default=SubscriptionStatus.active)
    auto_renew = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("Company")
    plan = relationship("Plan")


# ---------- Table 5: payments ----------

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    invoice_number = Column(String(50), unique=True, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String(50))
    transaction_id = Column(String(100))
    status = Column(Enum(PaymentStatus, name="payment_status"),
                    default=PaymentStatus.pending)
    payment_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company")


# ---------- Table 6: support_tickets ----------

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    raised_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String(200), nullable=False)
    description = Column(Text)
    priority = Column(Enum(TicketPriority, name="ticket_priority"),
                      default=TicketPriority.medium)
    status = Column(Enum(TicketStatus, name="ticket_status"),
                    default=TicketStatus.open)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime)

    company = relationship("Company")


# ---------- Table 7: notifications ----------

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    sent_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------- Table 8: audit_logs ----------

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    module = Column(String(50), nullable=False)
    description = Column(Text)
    ip_address = Column(String(45))
    created_at = Column(DateTime, default=datetime.utcnow)
