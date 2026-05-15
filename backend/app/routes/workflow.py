"""Workflow Automation — PRD §4.8 (task routing, reassignment)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.contracts.api import WorkflowAssignRequest, WorkflowAssignResponse
from app.db.models import ReviewQueueItem, User
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.services.audit import append_audit_event

router = APIRouter(prefix="/api/v1/workflow", tags=["workflow"])


@router.post("/assign", response_model=WorkflowAssignResponse)
async def assign(
    body: WorkflowAssignRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("admin")),
) -> WorkflowAssignResponse:
    item = (
        await session.execute(
            select(ReviewQueueItem).where(ReviewQueueItem.id == body.item_id)
        )
    ).scalar_one_or_none()
    if item is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Review item not found.",
            status_code=404,
        )
    assignee = (
        await session.execute(select(User).where(User.id == body.assignee_id))
    ).scalar_one_or_none()
    if assignee is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Assignee not found.",
            status_code=404,
        )
    if item.state == "resolved":
        raise AppError(
            code=ErrorCode.policy_violation,
            message="Cannot reassign a resolved item.",
            status_code=409,
        )
    item.assignee_id = assignee.id
    if item.state == "pending":
        item.state = "in_review"
    await append_audit_event(
        session,
        action="workflow.assign",
        target_type="review_queue_item",
        target_id=item.id,
        actor_id=user.id,
        payload={"assignee_id": assignee.id},
    )
    await session.commit()
    return WorkflowAssignResponse(
        item_id=item.id, assignee_id=assignee.id, state=item.state
    )
