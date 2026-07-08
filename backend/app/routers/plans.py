"""Subscription Plan APIs (Phase 2).

GET    /plans           -> list plans (public — shown on registration page)
GET    /plans/{id}      -> one plan
POST   /plans           -> create plan (Super Admin)
PUT    /plans/{id}      -> update plan (Super Admin)
DELETE /plans/{id}      -> deactivate plan (Super Admin)
"""
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import require_super_admin
from app.utils import add_audit_log

router = APIRouter(prefix="/plans", tags=["Plans"])


@router.get("", response_model=list[schemas.PlanOut])
def list_plans(db: Session = Depends(get_db)):
    return db.query(models.Plan).order_by(models.Plan.monthly_price).all()


@router.get("/{plan_id}", response_model=schemas.PlanOut)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.get(models.Plan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.post("", response_model=schemas.PlanOut)
def create_plan(
    body: schemas.PlanCreate,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    plan = models.Plan(
        plan_name=body.plan_name,
        monthly_price=body.monthly_price,
        max_employees=body.max_employees,
        included_modules=json.dumps(body.included_modules),
        trial_period_days=body.trial_period_days,
        status=body.status,
    )
    db.add(plan)
    add_audit_log(db, "create_plan", "plans", f"Created plan {body.plan_name}",
                  user_id=admin.id, request=request)
    db.commit()
    db.refresh(plan)
    return plan


@router.put("/{plan_id}", response_model=schemas.PlanOut)
def update_plan(
    plan_id: int,
    body: schemas.PlanUpdate,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    plan = db.get(models.Plan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Update only the fields that were sent
    data = body.model_dump(exclude_unset=True)
    if "included_modules" in data:
        data["included_modules"] = json.dumps(data["included_modules"])
    for field, value in data.items():
        setattr(plan, field, value)

    add_audit_log(db, "update_plan", "plans", f"Updated plan {plan.plan_name}",
                  user_id=admin.id, request=request)
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/{plan_id}")
def deactivate_plan(
    plan_id: int,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """We do not delete plans (companies may use them). We mark them inactive."""
    plan = db.get(models.Plan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    plan.status = models.PlanStatus.inactive
    add_audit_log(db, "deactivate_plan", "plans", f"Deactivated plan {plan.plan_name}",
                  user_id=admin.id, request=request)
    db.commit()
    return {"message": f"Plan '{plan.plan_name}' is now inactive"}
