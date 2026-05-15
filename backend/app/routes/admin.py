from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, current_user, require_role
from app.db.models import ContractDraft
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.services.audit import append_audit_event, verify_audit_chain

router = APIRouter(tags=["admin"])


class AuditVerifyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    intact: bool
    first_break_id: int | None


class DraftDeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    draft_id: str
    deleted_at: datetime


@router.get("/audit/verify", response_model=AuditVerifyResponse)
async def audit_verify(
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("admin")),
) -> AuditVerifyResponse:
    break_at = await verify_audit_chain(session)
    return AuditVerifyResponse(intact=break_at is None, first_break_id=break_at)


@router.delete("/drafts/{draft_id}", response_model=DraftDeleteResponse)
async def soft_delete_draft(
    draft_id: str,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(current_user),
) -> DraftDeleteResponse:
    draft = (
        await session.execute(select(ContractDraft).where(ContractDraft.id == draft_id))
    ).scalar_one_or_none()
    if draft is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Draft not found.",
            status_code=404,
        )
    if user.role != "admin" and draft.owner_id != user.id:
        raise AppError(
            code=ErrorCode.policy_violation,
            message="Only the owner or an admin may delete this draft.",
            status_code=403,
        )
    if draft.deleted_at is not None:
        return DraftDeleteResponse(draft_id=draft.id, deleted_at=draft.deleted_at)

    draft.deleted_at = datetime.now(timezone.utc)
    await append_audit_event(
        session,
        action="draft.soft_deleted",
        target_type="contract_draft",
        target_id=draft.id,
        actor_id=user.id,
        payload={"owner_id": draft.owner_id},
    )
    await session.commit()
    return DraftDeleteResponse(draft_id=draft.id, deleted_at=draft.deleted_at)
