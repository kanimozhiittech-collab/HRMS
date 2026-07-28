"""Demo/test data seed — run AFTER seed.py:  python seed_demo.py

Creates a realistic mix for testing every module:
- 2 active companies (with subscriptions, admins, payments)
- 1 active company whose subscription expires in 3 days (renewal reminder)
- 1 suspended company (expired subscription, failed payment)
- 1 pending registration + 1 rejected registration
- Support tickets (open / in_progress / resolved)
- Notifications + audit logs

Safe to re-run: skips everything if the marker company already exists.
"""
from datetime import date, datetime, timedelta

from app import models
from app.database import SessionLocal
from app.security import hash_password

MARKER = "Chennai Textiles Pvt Ltd"
ADMIN_PASSWORD = "Company@123"  # same known password for all demo company admins


def plan(db, name):
    return db.query(models.Plan).filter(models.Plan.plan_name == name).first()


def seed_demo():
    db = SessionLocal()
    try:
        if db.query(models.Company).filter(
                models.Company.company_name == MARKER).first():
            print("Demo data already exists — nothing to do.")
            return

        super_admin = db.query(models.User).filter(
            models.User.role == models.UserRole.super_admin).first()
        basic, pro, free = plan(db, "Basic"), plan(db, "Professional"), plan(db, "Free")
        if not (super_admin and basic and pro and free):
            raise SystemExit("Base seed missing — run `python seed.py` first.")

        today = date.today()
        now = datetime.utcnow()

        def company(name, admin_name, email, phone, p, status, approved=False):
            c = models.Company(
                company_name=name, admin_name=admin_name, admin_email=email,
                phone=phone, plan_id=p.id, status=status,
                database_type=models.DatabaseType.shared if approved else None,
                database_name="hrms_shared" if approved else None,
                approved_by=super_admin.id if approved else None,
                approved_at=now if approved else None,
            )
            db.add(c)
            db.flush()
            return c

        def admin_user(c):
            u = models.User(
                company_id=c.id, name=c.admin_name, email=c.admin_email,
                password_hash=hash_password(ADMIN_PASSWORD),
                role=models.UserRole.company_admin, is_temp_password=False,
            )
            db.add(u)
            db.flush()
            return u

        def subscription(c, p, start, end, status):
            s = models.Subscription(company_id=c.id, plan_id=p.id,
                                    start_date=start, end_date=end, status=status)
            db.add(s)
            db.flush()
            return s

        def payment(c, s, inv, amount, status, method=None, paid_at=None):
            db.add(models.Payment(
                company_id=c.id, subscription_id=s.id, invoice_number=inv,
                amount=amount, payment_method=method, status=status,
                transaction_id=f"TXN{inv[-4:]}" if method else None,
                payment_date=paid_at,
            ))

        # 1. Healthy active company — paid this month (shows in revenue)
        c1 = company(MARKER, "Priya Raman", "priya@chennaitextiles.com",
                     "9840012345", basic, models.CompanyStatus.active, approved=True)
        u1 = admin_user(c1)
        s1 = subscription(c1, basic, today - timedelta(days=40),
                          today + timedelta(days=50), models.SubscriptionStatus.active)
        payment(c1, s1, "INV-DEMO-9001", 999, models.PaymentStatus.paid,
                "upi", now - timedelta(days=2))

        # 2. Active company expiring in 3 days — pending invoice
        c2 = company("Coimbatore Software Solutions", "Arun Kumar",
                     "arun@cbesoft.com", "9952098765", pro,
                     models.CompanyStatus.active, approved=True)
        u2 = admin_user(c2)
        s2 = subscription(c2, pro, today - timedelta(days=27),
                          today + timedelta(days=3), models.SubscriptionStatus.active)
        payment(c2, s2, "INV-DEMO-9002", 2999, models.PaymentStatus.pending)

        # 3. Suspended company — subscription expired, payment failed
        c3 = company("Madurai Foods Ltd", "Meena Sundaram",
                     "meena@maduraifoods.com", "9865054321", free,
                     models.CompanyStatus.suspended, approved=True)
        admin_user(c3)
        s3 = subscription(c3, free, today - timedelta(days=35),
                          today - timedelta(days=5), models.SubscriptionStatus.expired)
        payment(c3, s3, "INV-DEMO-9003", 0, models.PaymentStatus.failed)

        # 4. Pending registration (approve this from the UI)
        company("Salem Auto Parts", "Rajesh Velu", "rajesh@salemauto.com",
                "9443011223", basic, models.CompanyStatus.pending)

        # 5. Rejected registration
        company("Trichy Traders", "Kavitha Anand", "kavitha@trichytraders.com",
                "9500099887", free, models.CompanyStatus.rejected)

        # Support tickets
        db.add(models.SupportTicket(
            company_id=c1.id, raised_by=u1.id,
            subject="Payroll module not loading",
            description="Payroll page shows a blank screen since yesterday evening.",
            priority=models.TicketPriority.high, status=models.TicketStatus.open,
        ))
        db.add(models.SupportTicket(
            company_id=c2.id, raised_by=u2.id,
            subject="Need extra employee licenses",
            description="We are hiring 50 more employees next month.",
            priority=models.TicketPriority.medium,
            status=models.TicketStatus.in_progress,
        ))
        db.add(models.SupportTicket(
            company_id=c1.id, raised_by=u1.id,
            subject="How to export attendance report?",
            description="Resolved over call — user guided to Reports section.",
            priority=models.TicketPriority.low,
            status=models.TicketStatus.resolved,
            resolved_at=now - timedelta(days=1),
        ))

        # Notifications
        db.add(models.Notification(
            company_id=c1.id, type="payment_received", title="Payment received",
            message=f"{c1.company_name} paid invoice INV-DEMO-9001.", is_read=True,
        ))
        db.add(models.Notification(
            company_id=c3.id, type="subscription_expired", title="Subscription expired",
            message=f"{c3.company_name} subscription expired. Company suspended.",
            is_read=False,
        ))

        # Audit logs
        db.add(models.AuditLog(
            user_id=super_admin.id, action="approve_company", module="companies",
            description=f"Approved {c1.company_name}", ip_address="127.0.0.1",
        ))
        db.add(models.AuditLog(
            user_id=super_admin.id, action="mark_paid", module="payments",
            description="Invoice INV-DEMO-9001 paid", ip_address="127.0.0.1",
        ))

        db.commit()
        print("Demo data created:")
        print("  5 companies (2 active, 1 expiring in 3 days, 1 suspended,"
              " 1 pending, 1 rejected)")
        print("  3 subscriptions, 3 payments, 3 tickets, 2 notifications")
        print(f"  Company admin logins: priya@chennaitextiles.com /"
              f" arun@cbesoft.com — password: {ADMIN_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
