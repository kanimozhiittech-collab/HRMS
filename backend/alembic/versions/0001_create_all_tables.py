"""Create all 8 Super Admin tables.

Revision ID: 0001
Revises: None
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# Enum types (fixed choice values)
plan_status = sa.Enum("active", "inactive", name="plan_status")
database_type = sa.Enum("shared", "dedicated", name="database_type")
company_status = sa.Enum("pending", "approved", "rejected", "active", "suspended",
                         name="company_status")
user_role = sa.Enum("super_admin", "company_admin", name="user_role")
user_status = sa.Enum("active", "inactive", name="user_status")
subscription_status = sa.Enum("active", "expired", "suspended",
                              name="subscription_status")
payment_status = sa.Enum("paid", "pending", "failed", name="payment_status")
ticket_priority = sa.Enum("low", "medium", "high", name="ticket_priority")
ticket_status = sa.Enum("open", "in_progress", "resolved", "closed",
                        name="ticket_status")


def upgrade() -> None:
    # Table 2: plans
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("plan_name", sa.String(100), nullable=False),
        sa.Column("monthly_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("max_employees", sa.Integer, nullable=False),
        sa.Column("included_modules", sa.Text),
        sa.Column("trial_period_days", sa.Integer),
        sa.Column("status", plan_status),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
    )

    # Table 1: companies (approved_by FK is added after users table exists)
    op.create_table(
        "companies",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_name", sa.String(150), nullable=False),
        sa.Column("admin_name", sa.String(100), nullable=False),
        sa.Column("admin_email", sa.String(150), nullable=False),
        sa.Column("phone", sa.String(20)),
        sa.Column("plan_id", sa.Integer, sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("database_type", database_type),
        sa.Column("database_name", sa.String(100)),
        sa.Column("status", company_status),
        sa.Column("approved_by", sa.Integer),
        sa.Column("approved_at", sa.DateTime),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
    )

    # Table 4: users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"),
                  nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(150), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_temp_password", sa.Boolean),
        sa.Column("status", user_status),
        sa.Column("last_login", sa.DateTime),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
    )

    # Now users exists -> connect companies.approved_by to users.id
    op.create_foreign_key("fk_companies_approved_by", "companies", "users",
                          ["approved_by"], ["id"])

    # Table 3: subscriptions
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"),
                  nullable=False),
        sa.Column("plan_id", sa.Integer, sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("status", subscription_status),
        sa.Column("auto_renew", sa.Boolean),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
    )

    # Table 5: payments
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"),
                  nullable=False),
        sa.Column("subscription_id", sa.Integer, sa.ForeignKey("subscriptions.id"),
                  nullable=False),
        sa.Column("invoice_number", sa.String(50), nullable=False, unique=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("payment_method", sa.String(50)),
        sa.Column("transaction_id", sa.String(100)),
        sa.Column("status", payment_status),
        sa.Column("payment_date", sa.DateTime),
        sa.Column("created_at", sa.DateTime),
    )

    # Table 6: support_tickets
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"),
                  nullable=False),
        sa.Column("raised_by", sa.Integer, sa.ForeignKey("users.id"),
                  nullable=False),
        sa.Column("subject", sa.String(200), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("priority", ticket_priority),
        sa.Column("status", ticket_status),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
        sa.Column("resolved_at", sa.DateTime),
    )

    # Table 7: notifications
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id"),
                  nullable=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text),
        sa.Column("is_read", sa.Boolean),
        sa.Column("sent_at", sa.DateTime),
        sa.Column("created_at", sa.DateTime),
    )

    # Table 8: audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("module", sa.String(50), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("created_at", sa.DateTime),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("notifications")
    op.drop_table("support_tickets")
    op.drop_table("payments")
    op.drop_table("subscriptions")
    op.drop_constraint("fk_companies_approved_by", "companies")
    op.drop_table("users")
    op.drop_table("companies")
    op.drop_table("plans")

    bind = op.get_bind()
    for enum in (plan_status, database_type, company_status, user_role, user_status,
                 subscription_status, payment_status, ticket_priority, ticket_status):
        enum.drop(bind, checkfirst=True)
