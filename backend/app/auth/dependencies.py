from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import jwt
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.tokens import decode_token, role_satisfies
from app.config import Settings, get_settings
from app.db.models import User
from app.db.session import get_session
from app.errors import AppError, ErrorCode


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str
    role: str


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
