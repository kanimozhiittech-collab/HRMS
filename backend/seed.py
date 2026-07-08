"""Seed script — run ONCE after migrations:  python seed.py

Creates:
1. The Super Admin login (email: superadmin@hrms.com, password: Admin@123)
2. The 4 subscription plans (Free, Basic, Professional, Enterprise)
"""
import json

from app import models
from app.database import SessionLocal
from app.security import hash_password

SUPER_ADMIN_EMAIL = "superadmin@hrms.com"
SUPER_ADMIN_PASSWORD = "Admin@123"  # change after first login!

PLANS = [
    {
        "plan_name": "Free",
        "monthly_price": 0,
        "max_employees": 10,
        "trial_period_days": 0,
        "included_modules": ["Employee Management", "Attendance",
                             "Leave Management", "Employee Profile", "Dashboard"],
    },
    {
        "plan_name": "Basic",
        "monthly_price": 999,
        "max_employees": 100,
        "trial_period_days": 0,
        "included_modules": ["Employee Management", "Attendance", "Leave Management",
                             "Departments", "Designations", "Holiday Calendar",
                             "Shift Management", "Basic Reports"],
    },
    {
        "plan_name": "Professional",
        "monthly_price": 2999,
        "max_employees": 1000,
        "trial_period_days": 0,
        "included_modules": ["Employee Management", "Attendance", "Leave Management",
                             "Payroll", "Recruitment", "Performance Management",
                             "Asset Management", "Expense Management",
                             "Advanced Reports", "Notifications", "API Access"],
    },
    {
        "plan_name": "Enterprise",
        "monthly_price": 0,  # custom pricing — set per deal
        "max_employees": 999999,  # unlimited
        "trial_period_days": 0,
        "included_modules": ["All Professional Features", "Multi-Branch Management",
                             "Multi-Location Management", "SSO",
                             "Custom Integrations", "Dedicated Database",
                             "Dedicated Account Manager", "SLA Support"],
    },
]


def seed():
    db = SessionLocal()
    try:
        # 1. Super Admin
        existing = db.query(models.User).filter(
            models.User.email == SUPER_ADMIN_EMAIL).first()
        if existing:
            print(f"Super Admin already exists: {SUPER_ADMIN_EMAIL}")
        else:
            db.add(models.User(
                name="Super Admin",
                email=SUPER_ADMIN_EMAIL,
                password_hash=hash_password(SUPER_ADMIN_PASSWORD),
                role=models.UserRole.super_admin,
            ))
            print(f"Super Admin created: {SUPER_ADMIN_EMAIL} / {SUPER_ADMIN_PASSWORD}")

        # 2. Plans
        for plan_data in PLANS:
            exists = db.query(models.Plan).filter(
                models.Plan.plan_name == plan_data["plan_name"]).first()
            if exists:
                print(f"Plan already exists: {plan_data['plan_name']}")
                continue
            db.add(models.Plan(
                plan_name=plan_data["plan_name"],
                monthly_price=plan_data["monthly_price"],
                max_employees=plan_data["max_employees"],
                trial_period_days=plan_data["trial_period_days"],
                included_modules=json.dumps(plan_data["included_modules"]),
            ))
            print(f"Plan created: {plan_data['plan_name']}")

        db.commit()
        print("\nSeeding done!")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
