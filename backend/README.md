# HRMS Super Admin Backend (FastAPI + PostgreSQL)

Backend API for the HRMS SaaS platform — Super Admin module only.
Company-side HR features (attendance, leave, payroll) are a separate project.

## Folder structure (simple)

```
backend/
├── app/
│   ├── main.py        <- app starts here (also runs daily expiry check)
│   ├── config.py      <- settings from .env
│   ├── database.py    <- database connection
│   ├── models.py      <- all 8 tables
│   ├── schemas.py     <- API input/output shapes
│   ├── security.py    <- passwords + login tokens
│   ├── utils.py       <- email, invoice number, notifications, audit logs
│   ├── expiry.py      <- daily subscription expiry check (Phase 7)
│   └── routers/       <- one file per module (auth, plans, companies, ...)
├── alembic/           <- database migrations
├── seed.py            <- creates Super Admin + 4 plans
└── requirements.txt
```

## How to run (first time)

```bash
# 1. Go to the backend folder
cd backend

# 2. Create a virtual environment and install packages
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# 3. Create the database in PostgreSQL (one time)
#    In pgAdmin or psql:  CREATE DATABASE hrms_master;

# 4. Copy .env.example to .env and set your DB password
copy .env.example .env

# 5. Create all tables (migration)
alembic upgrade head

# 6. Create Super Admin + 4 plans
python seed.py

# 7. Start the server
uvicorn app.main:app --reload
```

Open **http://localhost:8000/docs** — full API documentation with a *Try it out*
button for every endpoint.

## Login

| Who | Email | Password |
|---|---|---|
| Super Admin | superadmin@hrms.com | Admin@123 |

1. Call `POST /auth/login` -> copy the `access_token`
2. In /docs click **Authorize** and paste the token
3. Now all Super Admin APIs work

## Main flow (matches the FDS phases)

| Phase | What to call |
|---|---|
| 1. Dashboard | `GET /dashboard` |
| 2. Plans | `POST /plans` (already seeded), `PUT /plans/{id}` |
| 3. Company registers | `POST /companies/register` (public, no token) |
| 4. Approve | `POST /companies/{id}/approve` — creates subscription + company admin + temp password + welcome email |
| 5. Company Admin login | `POST /auth/login` -> `is_temp_password: true` -> `POST /auth/change-password` |
| 6. Monitoring | `GET /companies`, `GET /support-tickets`, `GET /audit-logs` |
| 7. Renewal | runs daily automatically; manual: `POST /subscriptions/check-expiry` |
| 8. Billing & Reports | `POST /payments/invoice`, `POST /payments/{id}/pay`, `GET /reports/revenue` |

## Notes

- **Email**: `send_email()` in `app/utils.py` only prints to the console for now.
  Connect a real SMTP server there when ready.
- **Temp passwords** are returned in API responses only because email is not
  connected yet — remove those lines in production.
- **Tenant databases**: approval records which database a company uses
  (dedicated for Enterprise, shared for others). Actual tenant DB creation
  happens in the company-side HRMS project.
