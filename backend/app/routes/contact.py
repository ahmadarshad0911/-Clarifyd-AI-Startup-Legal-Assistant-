"""Public 'contact us' endpoint.

POST /api/v1/contact — anonymous welcome.
GET  /api/v1/contact — admin only, list latest messages.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    AuthenticatedUser,
    current_user_optional,
    require_role,
)
from app.db.models import ContactMessage
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.rate_limit import rate_limit
from app.services.audit import append_audit_event

_post_limiter = rate_limit("contact.post", limit_attr="rate_limit_public_post_per_min")

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/contact", tags=["contact"])

Topic = Literal["general", "sales", "support", "press", "legal"]


class ContactCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, max_length=120)
    email: EmailStr
    company: str | None = Field(default=None, max_length=120)
    topic: Topic
    message: str = Field(min_length=8, max_length=2000)
    page_path: str | None = Field(default=None, max_length=255)
    # Honeypot — bots fill it, humans never see it. Reject quietly with 200.
    website: str | None = None


class ContactCreateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    submitted_at: datetime


class ContactItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    name: str | None
    email: str
    company: str | None
    topic: str
    message: str
    page_path: str | None
    submitted_at: datetime


class ContactListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[ContactItem]


@router.post(
    "",
    response_model=ContactCreateResponse,
    status_code=201,
    dependencies=[Depends(_post_limiter)],
)
async def submit_contact(
    body: ContactCreateRequest,
    request: Request,
    user_agent: str | None = Header(default=None, alias="User-Agent"),
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser | None = Depends(current_user_optional),
) -> ContactCreateResponse:
    # Honeypot: silently 'accept' bot submissions without persisting.
    if body.website:
        logger.info("contact.honeypot_triggered ip=%s", request.client.host if request.client else "-")
        return ContactCreateResponse(id="silent", submitted_at=datetime.utcnow())

    row = ContactMessage(
        user_id=user.id if user else None,
        name=body.name.strip() if body.name else None,
        email=str(body.email).lower(),
        company=body.company.strip() if body.company else None,
        topic=body.topic,
        message=body.message.strip(),
        page_path=body.page_path,
        user_agent=(user_agent[:1000] if user_agent else None),
    )
    session.add(row)
    await session.flush()
    await append_audit_event(
        session,
        action="contact.submit",
        target_type="contact",
        target_id=row.id,
        actor_id=(user.id if user else None),
        payload={"topic": body.topic, "email": row.email, "anonymous": user is None},
    )
    await session.commit()
    logger.info("contact.submit id=%s topic=%s anon=%s", row.id, body.topic, user is None)
    return ContactCreateResponse(id=row.id, submitted_at=row.submitted_at)


@router.get("", response_model=ContactListResponse)
async def list_contact(
    limit: int = 100,
    user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> ContactListResponse:
    if limit < 1 or limit > 500:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="limit must be 1..500",
            status_code=400,
        )
    rows = (
        await session.execute(
            select(ContactMessage).order_by(ContactMessage.submitted_at.desc()).limit(limit)
        )
    ).scalars().all()
    return ContactListResponse(
        items=[
            ContactItem(
                id=r.id,
                name=r.name,
                email=r.email,
                company=r.company,
                topic=r.topic,
                message=r.message,
                page_path=r.page_path,
                submitted_at=r.submitted_at,
            )
            for r in rows
        ]
    )
