from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    _ADMIN_CLERK_IDS,
    _ADMIN_EMAILS,
    AuthenticatedUser,
    current_user,
    require_role,
)
from app.config import get_settings
from app.db.models import ContractDraft, User, Feedback
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.services.audit import append_audit_event, verify_audit_chain
from app.services.user_purge import purge_user_data

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin"])


async def _clerk_user_count() -> int | None:
    """Total sign-ups from Clerk (source of truth). None if unavailable.

    The local user table only holds accounts that have made an authed call,
    so it under-counts. Clerk knows every sign-up.
    """
    secret = get_settings().clerk_secret_key
    if not secret:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://api.clerk.com/v1/users/count",
                headers={"Authorization": f"Bearer {secret}"},
            )
            resp.raise_for_status()
            return int(resp.json().get("total_count"))
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        logger.warning("Clerk user-count fetch failed: %r", exc)
        return None


async def _clerk_delete_user(clerk_user_id: str) -> bool:
    """Delete a user from Clerk. True on success, False if unavailable/failed.

    Clerk is the source of truth for accounts, so removing a user there is
    what actually deletes them. 404 from Clerk counts as already-gone (True).
    """
    secret = get_settings().clerk_secret_key
    if not secret or not clerk_user_id.startswith("user_"):
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(
                f"https://api.clerk.com/v1/users/{clerk_user_id}",
                headers={"Authorization": f"Bearer {secret}"},
            )
        if resp.status_code in (200, 204, 404):
            return True
        logger.warning(
            "Clerk delete user %s returned %s", clerk_user_id, resp.status_code
        )
        return False
    except httpx.HTTPError as exc:
        logger.warning("Clerk delete user %s failed: %r", clerk_user_id, exc)
        return False


async def _clerk_list_users() -> list[dict] | None:
    """Every Clerk user (the real roster). None if Clerk is unavailable.

    Returns normalized dicts: id, email, role, created_at (tz-aware),
    email_verified. Draft counts are merged from the local DB by caller.
    """
    secret = get_settings().clerk_secret_key
    if not secret:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.clerk.com/v1/users",
                params={"limit": 200, "order_by": "-created_at"},
                headers={"Authorization": f"Bearer {secret}"},
            )
            resp.raise_for_status()
            raw = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Clerk user-list fetch failed: %r", exc)
        return None

    out: list[dict] = []
    for u in raw if isinstance(raw, list) else []:
        emails = u.get("email_addresses") or []
        primary_id = u.get("primary_email_address_id")
        primary = next((e for e in emails if e.get("id") == primary_id), None)
        if primary is None and emails:
            primary = emails[0]
        email = (primary or {}).get("email_address", "")
        verified = (
            ((primary or {}).get("verification") or {}).get("status") == "verified"
        )
        role = ((u.get("public_metadata") or {}).get("role")) or "reviewer"
        created_ms = u.get("created_at") or 0
        created = datetime.fromtimestamp(int(created_ms) / 1000, tz=timezone.utc)
        out.append(
            {
                "id": u.get("id", ""),
                "email": email,
                "role": role,
                "created_at": created,
                "email_verified": verified,
            }
        )
    return out


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


async def _local_draft_count(session: AsyncSession, owner_id: str) -> int:
    cnt = (
        await session.execute(
            select(func.count())
            .select_from(ContractDraft)
            .where(ContractDraft.owner_id == owner_id)
            .where(ContractDraft.deleted_at.is_(None))
        )
    ).scalar_one()
    return int(cnt or 0)


@router.get("/admin/users", response_model=AdminUserListResponse)
async def admin_users(
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("admin")),
) -> AdminUserListResponse:
    # Clerk is the source of truth for who has signed up. The local table
    # only holds accounts that made an authed call, so list from Clerk and
    # merge draft counts from the local DB.
    clerk_users = await _clerk_list_users()
    if clerk_users is not None:
        items: list[AdminUserRow] = []
        for u in clerk_users:
            role = u["role"]
            if u["email"] in _ADMIN_EMAILS or u["id"] in _ADMIN_CLERK_IDS:
                role = "admin"
            items.append(
                AdminUserRow(
                    id=u["id"],
                    email=u["email"],
                    role=role,
                    created_at=u["created_at"],
                    email_verified=u["email_verified"],
                    drafts=await _local_draft_count(session, u["id"]),
                )
            )
        return AdminUserListResponse(items=items)

    # Fallback: local table only.
    rows = (
        await session.execute(
            select(User).order_by(User.created_at.desc()).limit(500)
        )
    ).scalars().all()
    items = []
    for r in rows:
        items.append(
            AdminUserRow(
                id=r.id,
                email=r.email,
                role=r.role,
                created_at=r.created_at,
                email_verified=r.email_verified_at is not None,
                drafts=await _local_draft_count(session, r.id),
            )
        )
    return AdminUserListResponse(items=items)


@router.get("/admin/stats", response_model=AdminStatsResponse)
async def admin_stats(
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("admin")),
) -> AdminStatsResponse:
    cutoff = datetime.now(timezone.utc).timestamp() - 7 * 86400

    local_users = (await session.execute(select(func.count()).select_from(User))).scalar_one()
    clerk_users = await _clerk_user_count()
    users_total = clerk_users if clerk_users is not None else int(local_users or 0)
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

    # The roster is sourced from Clerk, so the id is usually a Clerk user id
    # that may have no local row yet. Delete from Clerk (the source of truth)
    # AND clean up any local rows; do not 404 just because the local table
    # has no matching row.
    target = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    local_email = target.email if target is not None else None

    clerk_deleted = await _clerk_delete_user(user_id)

    # Purge unconditionally: rows can outlive the user row (e.g. feedback left
    # by an account whose user row was already removed), and a delete that only
    # fires when a user row happens to exist is how orphans accumulate.
    purged = await purge_user_data(session, user_id, local_email)

    if target is None and not clerk_deleted:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="User not found.",
            status_code=404,
        )

    await append_audit_event(
        session,
        action="admin.user_deleted",
        target_type="user",
        target_id=user_id,
        actor_id=user.id,
        payload={"email": local_email, "clerk_deleted": clerk_deleted, "purged": purged},
    )
    await session.commit()
    return UserDeleteResponse(id=user_id, deleted=True)
