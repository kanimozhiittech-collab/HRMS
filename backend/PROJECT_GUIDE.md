# HRMS Super Admin Backend — Full Guide (Tanglish)

Intha doc la enna code eluthirukom, flow eppadi work aaguthu, eppadi run pannanum,
password enna — ellame simple ah explain pannirukku.

---

## 1. Intha Project Enna?

Ithu oru **HRMS SaaS platform oda Super Admin backend**.

- **Super Admin** = platform owner. Avaru companies ah manage pannuvaaru,
  plans create pannuvaaru, billing paapaaru.
- **Company Admin** = oru company oda HR admin. Avanga employee, attendance,
  leave, payroll ellam paapanga (athu vera project — inga illa).
- Super Admin ku employee data (attendance, leave, payroll) **theriyaathu**.
  Avaru platform mattum thaan paapaaru.

**Technology:** Python + FastAPI + PostgreSQL + SQLAlchemy + Alembic (migrations)

---

## 2. Folder Structure — Entha File la Enna Irukku?

```
backend/
├── app/
│   ├── main.py        <- App start aagura file. Daily expiry check um inga run aagum
│   ├── config.py      <- .env file la irunthu settings read pannum
│   ├── database.py    <- PostgreSQL connection setup
│   ├── models.py      <- 8 database tables (companies, plans, subscriptions,
│   │                     users, payments, support_tickets, notifications, audit_logs)
│   ├── schemas.py     <- API input/output shapes (enna data varanum, enna pogonum)
│   ├── security.py    <- Password hash + JWT login token + route protection
│   ├── utils.py       <- Email anupurathu, invoice number, notification, audit log helpers
│   ├── expiry.py      <- Daily subscription expiry check logic (Phase 7)
│   └── routers/       <- Ella APIs um inga — oru module ku oru file
│       ├── auth.py            <- Login, change password
│       ├── dashboard.py       <- KPI numbers
│       ├── plans.py           <- Plan create/update
│       ├── companies.py       <- Register, approve, reject, suspend
│       ├── subscriptions.py   <- Subscription list, extend, expiry check
│       ├── users.py           <- Company admin users manage
│       ├── payments.py        <- Invoice, payment
│       ├── support_tickets.py <- Support tickets
│       ├── notifications.py   <- Notification bell
│       ├── audit_logs.py      <- Audit logs (yaaru enna panninanga)
│       └── reports.py         <- Revenue, company stats, user growth reports
├── alembic/           <- Database migration files (tables create pannurathu)
├── seed.py            <- Super Admin login + 4 plans create pannum (one time run)
├── .env               <- Database password, secret key (ithu git la povaathu)
└── requirements.txt   <- Install pannavendiya packages list
```

---

## 3. Full Flow — Eppadi Work Aaguthu? (Phase by Phase)

### Phase 1 — Login & Dashboard
1. Super Admin `POST /auth/login` la email + password kudupaaru
2. System check pannitu **JWT token** kudukkum
3. Antha token vachi thaan matha APIs ellam call panna mudiyum
4. `GET /dashboard` → Total Companies, Active/Pending/Suspended count,
   Monthly Revenue, Open Tickets, Expire aaga pora subscriptions — ellam oru call la

### Phase 2 — Plans Create
1. `POST /plans` la Super Admin plan create pannuvaaru
2. Namma already `seed.py` la 4 plans create panniyaachu:
   - **Free** — Rs.0, 10 employees
   - **Basic** — Rs.999, 100 employees
   - **Professional** — Rs.2999, 1000 employees
   - **Enterprise** — custom price, unlimited employees
3. Active plans mattum registration page la theriyum

### Phase 3 — Company Registration (Public)
1. Puthu company `POST /companies/register` la register pannum
   (company name, admin name, email, phone, plan select)
2. Company status = **pending** aagum
3. Super Admin ku notification varum: "New company registration"

### Phase 4 — Company Approval (Main Flow!)
Super Admin `POST /companies/{id}/approve` click panna — **oru click la 5 velai nadakum**:
1. Company status **active** aagum
2. **Subscription** create aagum (plan price, 30 days / trial days)
3. **Database** decide aagum — Enterprise plan na `dedicated`, matha plans ku `shared`
4. **Company Admin user** create aagum + **temporary password** generate aagum
5. **Welcome email** anupidum (ippo console la print aagum, SMTP connect panna real email pogum)

Venum na `POST /companies/{id}/reject` pannalam, illa `POST /companies/{id}/suspend` pannalam.

### Phase 5 — Company Admin Login
1. Company Admin welcome email la vantha temp password vachi login pannuvaanga
2. Response la `is_temp_password: true` varum → **password change pannanum**
   (`POST /auth/change-password`)
3. Company suspend aayirundha login aagave mudiyaathu — "Company is suspended" error varum

### Phase 6 — Monitoring
- `GET /companies` → ella companies status um paakalam
- `GET /support-tickets` → company admins raise pannina tickets, status update pannalam
- `GET /audit-logs` → yaaru enna panninanga, entha IP la irunthu — full history
- `GET /notifications` → notification bell

### Phase 7 — Subscription Renewal (Automatic!)
- Server run aagum bothu **daily oru automatic job** run aagum (`app/expiry.py`):
  - Subscription **7 days kulla expire** aaga poguthu na → **renewal reminder email**
  - Subscription **expire aayiduchu** na → company **suspend** + **login block**
- Manual ah run panna: `POST /subscriptions/check-expiry`
- Payment vanthuduchu na → subscription extend aagum, company thirumba active aagum

### Phase 8 — Billing & Reports
1. `POST /payments/invoice` → company ku invoice generate (INV-202607-0001 mathiri number)
2. Payment vantha `POST /payments/{id}/pay` → invoice **paid** aagum,
   subscription ku **+30 days** add aagum, suspend aana company **active** aagum
3. Reports:
   - `GET /reports/revenue?year=2026` → month-wise revenue
   - `GET /reports/company-stats` → status-wise, plan-wise company count
   - `GET /reports/user-growth?year=2026` → month-wise puthu companies + users

---

## 4. Eppadi Run Pannanum? (Step by Step)

> First time mattum step 1-6. Aprum daily step 7 mattum pothum.

```powershell
# 1. Backend folder ku po
cd C:\Users\xmedia\Documents\HRMS\backend

# 2. Virtual environment activate pannu
venv\Scripts\activate

# 3. Packages install pannu (first time mattum)
pip install -r requirements.txt

# 4. PostgreSQL la database create pannu (first time mattum)
#    pgAdmin open pannu -> CREATE DATABASE hrms_master;

# 5. Tables create pannu (first time mattum)
alembic upgrade head

# 6. Super Admin + 4 plans create pannu (first time mattum)
python seed.py

# 7. Server start pannu (daily ithu mattum)
uvicorn app.main:app --reload --port 8001
```

> **Note:** Port 8000 la already vera program run aaguthu intha machine la.
> Athaan namma **port 8001** use pannurom.

Server start aanathum browser la open pannu:

**http://localhost:8001/docs**

Inga ella 36 APIs um irukkum — "Try it out" button vachi test pannalam.

---

## 5. Login Details (Password)

| Yaaru | Email | Password |
|---|---|---|
| **Super Admin** | `superadmin@hrms.com` | `Admin@123` |

**Docs la login pannurathu eppadi:**
1. http://localhost:8001/docs open pannu
2. `POST /auth/login` → **Try it out** → email/password podu → **Execute**
3. Response la varra `access_token` ah **copy** pannu
4. Top right la irukkura pachcha **Authorize** button click pannu → token paste pannu
5. Ippo ella Super Admin APIs um work aagum. First `GET /dashboard` try pannu!

**Company Admin password:** Company approve pannum bothu system auto ah temp password
create pannum. Athu console la (email format la) print aagum + approve API response la varum.

---

## 6. Mukkiyamana Notes

1. **Email ippo console la thaan print aagum.** Real email anuppa
   `app/utils.py` la `send_email()` function la SMTP connect pannanum.
2. **Temp password API response la kaatturom** — testing ku thaan.
   Production ku pogum bothu antha line ah remove pannanum
   (code la comment potturukom entha line nu).
3. **`.env` file** la database password irukku. Antha file git la povaathu (.gitignore la irukku).
4. **Password DB la plain text ah save aagaathu** — bcrypt hash ah thaan save aagum. Safe.
5. Ella create/update/delete action um automatic ah **audit_logs** table la save aagum.
6. Server run aagum varaikkum thaan daily expiry check work aagum.
   Server eppovum run aaganum production la.

---

## 7. Total Enna Irukku?

- **8 database tables** (migration file: `alembic/versions/0001_create_all_tables.py`)
- **36 APIs** (11 Super Admin modules cover aaguthu)
- **1 automatic daily job** (subscription expiry check)
- **1 seed script** (Super Admin + 4 plans)

Company-side HRMS (employee, attendance, leave, payroll) — athu **next project**,
intha backend oda link aagum.
