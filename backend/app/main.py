"""HRMS Super Admin Backend — main entry point.

Run with:  uvicorn app.main:app --reload
API docs:  http://localhost:8000/docs
"""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import SessionLocal
from app.expiry import run_expiry_check
from app.routers import (audit_logs, auth, companies, dashboard, notifications,
                         payments, plans, reports, settings, subscriptions,
                         support_tickets, users)


async def daily_expiry_job():
    """Runs the subscription expiry check once every 24 hours (Phase 7.1)."""
    while True:
        db = SessionLocal()
        try:
            result = run_expiry_check(db)
            print(f"[expiry-check] {result}")
        except Exception as error:
            print(f"[expiry-check] failed: {error}")
        finally:
            db.close()
        await asyncio.sleep(24 * 60 * 60)  # wait 1 day


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(daily_expiry_job())  # start on app startup
    yield
    task.cancel()  # stop on app shutdown


app = FastAPI(
    title="HRMS Super Admin API",
    description="Backend for the HRMS SaaS platform — Super Admin module",
    version="1.0.0",
    lifespan=lifespan,
)

# On Vercel the backend service receives the full public path
# (/api/backend/...); strip that prefix so routes match both there
# and when running locally (where requests arrive without it).
VERCEL_PREFIX = "/api/backend"


@app.middleware("http")
async def strip_vercel_prefix(request, call_next):
    path = request.scope.get("path", "")
    if path.startswith(VERCEL_PREFIX):
        request.scope["path"] = path[len(VERCEL_PREFIX):] or "/"
    return await call_next(request)

# Allow the frontend (any origin for now — restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def _allow_private_network(request, call_next):
    """Chrome's Private Network Access blocks any request targeting a LAN IP
    (e.g. testing via http://192.168.x.x instead of localhost) unless the
    preflight response explicitly opts in with this header."""
    response = await call_next(request)
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

# All API routes
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(plans.router)
app.include_router(companies.router)
app.include_router(subscriptions.router)
app.include_router(users.router)
app.include_router(payments.router)
app.include_router(support_tickets.router)
app.include_router(notifications.router)
app.include_router(audit_logs.router)
app.include_router(reports.router)
app.include_router(settings.router)


@app.get("/")
def health():
    return {"status": "ok", "app": "HRMS Super Admin API"}


@app.get("/env-check")
def env_check():
    """Deploy diagnostic: shows which DB host the service sees (no secrets)."""
    from urllib.parse import urlparse

    from app.config import DATABASE_URL

    host = urlparse(DATABASE_URL).hostname or ""
    return {"db_host": host, "is_neon": "neon.tech" in host}
