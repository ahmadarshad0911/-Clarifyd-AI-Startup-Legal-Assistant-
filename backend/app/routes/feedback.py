"""User feedback endpoints.

POST /api/v1/feedback — accept feedback. Auth optional (anonymous welcome).
GET  /api/v1/feedback — admin-only list of recent submissions.
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
from app.db.models import Feedback
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.services.audit import append_audit_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])

Category = Literal["bug", "feature", "ui", "performance", "praise"]


class FeedbackCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mood: int = Field(ge=1, le=5)
    category: Category
    message: str = Field(min_length=6, max_length=2000)
    nps: int | None = Field(default=None, ge=0, le=10)
    contact_email: EmailStr | None = None
    page_path: str | None = Field(default=None, max_length=255)


class FeedbackCreateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    submitted_at: datetime


class FeedbackItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    mood: int
    category: str
    message: str
    nps: int | None
    contact_email: str | None
    user_email: str | None
    page_path: str | None
    submitted_at: datetime


class FeedbackListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[FeedbackItem]


@router.post("", response_model=FeedbackCreateResponse, status_code=201)
async def submit_feedback(
    body: FeedbackCreateRequest,
    request: Request,
    user_agent: str | None = Header(default=None, alias="User-Agent"),
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser | None = Depends(current_user_optional),
) -> FeedbackCreateResponse:
    row = Feedback(
        user_id=user.id if user else None,
        mood=body.mood,
        category=body.category,
        message=body.message.strip(),
        nps=body.nps,
        contact_email=(str(body.contact_email).lower() if body.contact_email else None),
        user_email=(user.email if user else None),
        page_path=body.page_path,
        user_agent=(user_agent[:1000] if user_agent else None),
    )
    session.add(row)
    await session.flush()
    await append_audit_event(
        session,
        action="feedback.submit",
        target_type="feedback",
        target_id=row.id,
        actor_id=(user.id if user else None),
        payload={
            "mood": body.mood,
            "category": body.category,
            "nps": body.nps,
            "anonymous": user is None,
        },
    )
    await session.commit()
    logger.info(
        "feedback.submit id=%s mood=%s cat=%s anon=%s",
        row.id, body.mood, body.category, user is None,
    )
    return FeedbackCreateResponse(id=row.id, submitted_at=row.submitted_at)


@router.get("", response_model=FeedbackListResponse)
async def list_feedback(
    limit: int = 100,
    user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> FeedbackListResponse:
    if limit < 1 or limit > 500:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="limit must be 1..500",
            status_code=400,
        )
    rows = (
        await session.execute(
            select(Feedback).order_by(Feedback.submitted_at.desc()).limit(limit)
        )
    ).scalars().all()
    return FeedbackListResponse(
        items=[
            FeedbackItem(
                id=r.id,
                mood=r.mood,
                category=r.category,
                message=r.message,
                nps=r.nps,
                contact_email=r.contact_email,
                user_email=r.user_email,
                page_path=r.page_path,
                submitted_at=r.submitted_at,
            )
            for r in rows
        ]
    )
