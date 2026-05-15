"""Integration Hub / Webhooks — PRD §4.11."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.contracts.api import (
    WebhookCreateRequest,
    WebhookListResponse,
    WebhookView,
)
from app.db.models import Webhook
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.services.audit import append_audit_event

router = APIRouter(prefix="/api/v1/integrations/webhooks", tags=["webhooks"])


_ALLOWED_EVENTS = {
    "upload.created",
    "reasoning.evaluate",
    "review.decide",
    "export.ready",
    "compliance.flagged",
}


@router.post("", response_model=WebhookView)
async def create_webhook(
    body: WebhookCreateRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("admin")),
) -> WebhookView:
    if body.event not in _ALLOWED_EVENTS:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message=f"Unsupported event '{body.event}'.",
            status_code=422,
        )
    if not (body.url.startswith("https://") or body.url.startswith("http://")):
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Webhook URL must be http(s).",
            status_code=422,
        )
    hook = Webhook(
        owner_id=user.id,
        url=body.url,
        event=body.event,
        secret=body.secret,
    )
    session.add(hook)
    await session.flush()
    await append_audit_event(
        session,
        action="webhook.create",
        target_type="webhook",
        target_id=hook.id,
        actor_id=user.id,
        payload={"event": body.event},
    )
    await session.commit()
    return WebhookView(
        id=hook.id,
        url=hook.url,
        event=hook.event,
        created_at=hook.created_at.isoformat(),
    )


@router.get("", response_model=WebhookListResponse)
async def list_webhooks(
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("admin")),
) -> WebhookListResponse:
    rows = list(
        (
            await session.execute(select(Webhook).order_by(Webhook.created_at))
        )
        .scalars()
        .all()
    )
    return WebhookListResponse(
        items=[
            WebhookView(
                id=h.id,
                url=h.url,
                event=h.event,
                created_at=h.created_at.isoformat(),
            )
            for h in rows
        ]
    )


@router.delete("/{hook_id}", status_code=204, response_class=Response)
async def delete_webhook(
    hook_id: str = Path(..., min_length=1),
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("admin")),
) -> Response:
    result = await session.execute(delete(Webhook).where(Webhook.id == hook_id))
    if result.rowcount == 0:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Webhook not found.",
            status_code=404,
        )
    await append_audit_event(
        session,
        action="webhook.delete",
        target_type="webhook",
        target_id=hook_id,
        actor_id=user.id,
        payload={},
    )
    await session.commit()
    return Response(status_code=204)
