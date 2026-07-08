"""Support Ticket APIs (Phase 6.2).

POST /support-tickets       -> a Company Admin raises a ticket
GET  /support-tickets       -> Super Admin lists all tickets
GET  /support-tickets/{id}  -> one ticket
PUT  /support-tickets/{id}  -> Super Admin updates status / priority
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import get_current_user, require_super_admin
from app.utils import add_audit_log, add_notification

router = APIRouter(prefix="/support-tickets", tags=["Support Tickets"])


@router.post("", response_model=schemas.TicketOut)
def create_ticket(
    body: schemas.TicketCreate,
    request: Request,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Company Admin raises a support ticket."""
    if user.role != models.UserRole.company_admin:
        raise HTTPException(status_code=400, detail="Only Company Admins raise tickets")

    ticket = models.SupportTicket(
        company_id=user.company_id,
        raised_by=user.id,
        subject=body.subject,
        description=body.description,
        priority=body.priority,
    )
    db.add(ticket)
    add_notification(db, "new_ticket", "New support ticket",
                     f"Ticket: {body.subject}", company_id=user.company_id)
    add_audit_log(db, "create_ticket", "support_tickets",
                  f"Ticket '{body.subject}' raised", user_id=user.id, request=request)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("", response_model=list[schemas.TicketOut])
def list_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    company_id: Optional[int] = None,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.SupportTicket)
    if status:
        query = query.filter(models.SupportTicket.status == status)
    if priority:
        query = query.filter(models.SupportTicket.priority == priority)
    if company_id:
        query = query.filter(models.SupportTicket.company_id == company_id)
    return query.order_by(models.SupportTicket.created_at.desc()).all()


@router.get("/{ticket_id}", response_model=schemas.TicketOut)
def get_ticket(
    ticket_id: int,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    ticket = db.get(models.SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.put("/{ticket_id}", response_model=schemas.TicketOut)
def update_ticket(
    ticket_id: int,
    body: schemas.TicketUpdate,
    request: Request,
    admin: models.User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    ticket = db.get(models.SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if body.priority:
        ticket.priority = body.priority
    if body.status:
        ticket.status = body.status
        if body.status == "resolved":
            ticket.resolved_at = datetime.utcnow()

    add_audit_log(db, "update_ticket", "support_tickets",
                  f"Ticket {ticket.id} updated (status={ticket.status})",
                  user_id=admin.id, request=request)
    db.commit()
    db.refresh(ticket)
    return ticket
