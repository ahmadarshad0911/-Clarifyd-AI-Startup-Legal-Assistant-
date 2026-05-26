from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable
from uuid import uuid4

import jwt
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import httpx

from app.auth.clerk import ClerkAuthError, verify_clerk_session_token
from app.auth.tokens import decode_token, role_satisfies
from app.config import Settings, get_settings
from app.db.models import User
from app.db.session import get_session
from app.errors import AppError, ErrorCode

logger = logging.getLogger(__name__)

# Hard-coded admin allowlist mirrored from routes/auth.py. Anyone signing in
# through Clerk with one of these emails is auto-promoted to admin on first
# sync into the local user table.
_ADMIN_EMAILS = frozenset({"ahmedarshad260@gmail.com"})
# Clerk user IDs that should be auto-promoted to admin even when the JWT
# doesn't carry an email claim and the Backend API lookup fails (e.g. Clerk
# returning 5xx during peak load). Mirrors the email allowlist.
_ADMIN_CLERK_IDS = frozenset({"user_3EHI8rLVbBlDqEtLx8J18zaHDk9"})


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str
    role: str


async def _resolve_clerk_user(
    token: str, settings: Settings, session: AsyncSession
) -> AuthenticatedUser | None:
    """Verify a Clerk-issued JWT and upsert a matching row in our user table.

    Returns None if Clerk is not configured (CLERK_ISSUER empty) so the caller
    can fall back to legacy local JWT verification.
    """
    if not settings.clerk_issuer:
        return None
    try:
        claims = verify_clerk_session_token(token, settings)
    except ClerkAuthError:
        return None  # Not a Clerk token — caller will try legacy JWT.

    clerk_user_id = str(claims.get("sub") or "")
    if not clerk_user_id:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Clerk token missing subject.",
            status_code=401,
        )

    # Clerk default session tokens omit email + public_metadata. Try the
    # JWT claims first (works with custom session token templates), else
    # fetch the user via Clerk Backend API.
    email = (
        claims.get("email")
        or (claims.get("public_metadata") or {}).get("email")
    )
    role_claim = (claims.get("public_metadata") or {}).get("role")

    if (not email or role_claim is None) and settings.clerk_secret_key:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"https://api.clerk.com/v1/users/{clerk_user_id}",
                    headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
                )
            if resp.status_code == 200:
                data = resp.json()
                if not email:
                    addrs = data.get("email_addresses") or []
                    primary_id = data.get("primary_email_address_id")
                    primary = next(
                        (a for a in addrs if a.get("id") == primary_id),
                        (addrs[0] if addrs else None),
                    )
                    if primary:
                        email = primary.get("email_address")
                if role_claim is None:
                    role_claim = (data.get("public_metadata") or {}).get("role")
        except Exception:
            logger.warning("Clerk user fetch failed for %s", clerk_user_id, exc_info=True)

    email = email or f"{clerk_user_id}@clerk.local"

    # Upsert. The local row's primary key stays in sync with the Clerk
    # user id so we don't need a separate join table.
    row = (
        await session.execute(select(User).where(User.id == clerk_user_id))
    ).scalar_one_or_none()
    is_admin_seed = email in _ADMIN_EMAILS or clerk_user_id in _ADMIN_CLERK_IDS
    if row is None:
        initial_role = (
            "admin" if is_admin_seed else (role_claim or "reviewer")
        )
        row = User(
            id=clerk_user_id,
            email=email,
            hashed_password="!clerk-managed",  # not used; Clerk owns password
            role=initial_role,
            email_verified_at=datetime.now(timezone.utc),
        )
        session.add(row)
        try:
            await session.flush()
            await session.commit()
        except Exception:  # pragma: no cover — race on concurrent first-sync
            await session.rollback()
            row = (
                await session.execute(select(User).where(User.id == clerk_user_id))
            ).scalar_one()
    else:
        # Reconcile role + email on every request: Clerk metadata is authoritative.
        target_role = role_claim or row.role
        if is_admin_seed:
            target_role = "admin"
        if row.role != target_role or row.email != email:
            row.role = target_role
            row.email = email
            try:
                await session.commit()
            except Exception:  # pragma: no cover
                await session.rollback()

    return AuthenticatedUser(id=row.id, email=row.email, role=row.role)


async def current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Missing bearer token.",
            status_code=401,
        )
    token = auth.split(" ", 1)[1].strip()

    # 1) Try Clerk if configured.
    clerk_user = await _resolve_clerk_user(token, settings, session)
    if clerk_user is not None:
        return clerk_user

    # 2) Fall back to legacy local JWT (kept while Clerk integration
    #    rolls out; remove once every client uses Clerk-issued tokens).
    try:
        payload = decode_token(token, settings)
    except jwt.ExpiredSignatureError as exc:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Token expired.",
            status_code=401,
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Invalid token.",
            status_code=401,
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Token missing subject.",
            status_code=401,
        )

    user = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None or user.disabled_at is not None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="User not found or disabled.",
            status_code=401,
        )
    return AuthenticatedUser(id=user.id, email=user.email, role=user.role)


async def current_user_optional(
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser | None:
    """Resolve the caller if a valid Clerk OR legacy token is present.

    Used by endpoints that accept anonymous traffic but want to attribute
    submissions to a signed-in user when possible.
    """
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    try:
        clerk_user = await _resolve_clerk_user(token, settings, session)
    except AppError:
        clerk_user = None
    if clerk_user is not None:
        return clerk_user

    try:
        payload = decode_token(token, settings)
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None or user.disabled_at is not None:
        return None
    return AuthenticatedUser(id=user.id, email=user.email, role=user.role)


def require_role(min_role: str) -> Callable[[AuthenticatedUser], AuthenticatedUser]:
    async def _dep(user: AuthenticatedUser = Depends(current_user)) -> AuthenticatedUser:
        if not role_satisfies(user.role, min_role):
            raise AppError(
                code=ErrorCode.policy_violation,
                message=f"Role '{min_role}' required.",
                status_code=403,
            )
        return user

    return _dep
