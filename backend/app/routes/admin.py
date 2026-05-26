from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, current_user, require_role
from app.db.models import ContractDraft, User, Feedback
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


# ---------------------------------------------------------------------------
# Admin console — users + stats
# ---------------------------------------------------------------------------


class AdminUserRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    email: str
    role: str
    created_at: datetime
    email_verified: bool
    drafts: int


class AdminUserListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[AdminUserRow]


class AdminStatsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    users_total: int
    users_last_7d: int
    drafts_total: int
    drafts_last_7d: int
    feedback_total: int
    admins: int


class UserDeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    deleted: bool


@router.get("/admin/users", response_model=AdminUserListResponse)
async def admin_users(
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("admin")),
) -> AdminUserListResponse:
    rows = (
        await session.execute(
            select(User).order_by(User.created_at.desc()).limit(500)
        )
    ).scalars().all()
    items: list[AdminUserRow] = []
    for r in rows:
        cnt = (
            await session.execute(
                select(func.count())
                .select_from(ContractDraft)
                .where(ContractDraft.owner_id == r.id)
                .where(ContractDraft.deleted_at.is_(None))
            )
        ).scalar_one()
        items.append(
            AdminUserRow(
                id=r.id,
                email=r.email,
                role=r.role,
                created_at=r.created_at,
                email_verified=r.email_verified_at is not None,
                drafts=int(cnt or 0),
            )
        )
    return AdminUserListResponse(items=items)


@router.get("/admin/stats", response_model=AdminStatsResponse)
async def admin_stats(
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("admin")),
) -> AdminStatsResponse:
    cutoff = datetime.now(timezone.utc).timestamp() - 7 * 86400

    users_total = (await session.execute(select(func.count()).select_from(User))).scalar_one()
    drafts_total = (
        await session.execute(
            select(func.count()).select_from(ContractDraft).where(ContractDraft.deleted_at.is_(None))
        )
    ).scalar_one()
    feedback_total = (
        await session.execute(select(func.count()).select_from(Feedback))
    ).scalar_one()
    admins = (
        await session.execute(select(func.count()).select_from(User).where(User.role == "admin"))
    ).scalar_one()

    # SQLite stores naive datetimes; compare with strftime via Python timestamps
    # using a fallback: just count rows whose created_at >= cutoff using direct
    # SQL would be cleaner but the model field is a tz-aware datetime in pg.
    users_7d = 0
    drafts_7d = 0
    for r in (await session.execute(select(User.created_at))).scalars().all():
        if r and r.timestamp() >= cutoff:
            users_7d += 1
    for r in (
        await session.execute(
            select(ContractDraft.uploaded_at).where(ContractDraft.deleted_at.is_(None))
        )
    ).scalars().all():
        if r and r.timestamp() >= cutoff:
            drafts_7d += 1

    return AdminStatsResponse(
        users_total=int(users_total or 0),
        users_last_7d=users_7d,
        drafts_total=int(drafts_total or 0),
        drafts_last_7d=drafts_7d,
        feedback_total=int(feedback_total or 0),
        admins=int(admins or 0),
    )


@router.delete("/admin/users/{user_id}", response_model=UserDeleteResponse)
async def admin_delete_user(
    user_id: str,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("admin")),
) -> UserDeleteResponse:
    if user_id == user.id:
        raise AppError(
            code=ErrorCode.policy_violation,
            message="Cannot delete the signed-in admin account.",
            status_code=400,
        )
    target = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if target is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="User not found.",
            status_code=404,
        )
    await session.execute(
        delete(ContractDraft).where(ContractDraft.owner_id == user_id)
    )
    await session.execute(delete(User).where(User.id == user_id))
    await append_audit_event(
        session,
        action="admin.user_deleted",
        target_type="user",
        target_id=user_id,
        actor_id=user.id,
        payload={"email": target.email},
    )
    await session.commit()
    return UserDeleteResponse(id=user_id, deleted=True)
