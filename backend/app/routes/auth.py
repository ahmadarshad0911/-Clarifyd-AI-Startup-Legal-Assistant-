from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, current_user
from app.auth.password import hash_password, verify_password
from app.auth.tokens import create_access_token
from app.config import Settings, get_settings
from app.db.models import OAuthIdentity, User
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.rate_limit import rate_limit
from app.services.audit import append_audit_event

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=1, max_length=256)
    password: str = Field(min_length=1, max_length=256)


class LoginResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    role: str


class OAuthIdentitySummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: str
    email: str | None = None
    display_name: str | None = None
    picture_url: str | None = None


class MeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    email: str
    role: str
    # Additive — derived from most recent OAuthIdentity row, if any.
    display_name: str | None = None
    picture_url: str | None = None
    identities: list[OAuthIdentitySummary] = Field(default_factory=list)


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=256)
    # NIST SP 800-63B aligned: 12-char minimum. UI suggester gives 16.
    password: str = Field(min_length=12, max_length=256)


_login_limiter = rate_limit("auth.login", limit_attr="rate_limit_login_per_min")


@router.post(
    "/login",
    response_model=LoginResponse,
    dependencies=[Depends(_login_limiter)],
)
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> LoginResponse:
    user = (
        await session.execute(select(User).where(User.email == body.email.lower()))
    ).scalar_one_or_none()
    if user is None or user.disabled_at is not None or not verify_password(
        body.password, user.hashed_password
    ):
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Invalid credentials.",
            status_code=401,
        )

    token = create_access_token(user_id=user.id, role=user.role, settings=settings)
    await append_audit_event(
        session,
        action="auth.login",
        target_type="user",
        target_id=user.id,
        actor_id=user.id,
        payload={"email": user.email},
    )
    await session.commit()
    return LoginResponse(
        access_token=token,
        expires_in=settings.jwt_access_ttl_minutes * 60,
        role=user.role,
    )


@router.post(
    "/register",
    response_model=LoginResponse,
    dependencies=[Depends(_login_limiter)],
)
async def register(
    body: RegisterRequest,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> LoginResponse:
    email = body.email.strip().lower()
    existing = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if existing is not None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="An account with this email already exists.",
            status_code=409,
        )

    user = User(
        email=email,
        hashed_password=hash_password(body.password),
        role="reviewer",
    )
    session.add(user)
    await session.flush()

    token = create_access_token(user_id=user.id, role=user.role, settings=settings)
    await append_audit_event(
        session,
        action="auth.register",
        target_type="user",
        target_id=user.id,
        actor_id=user.id,
        payload={"email": user.email},
    )
    await session.commit()
    return LoginResponse(
        access_token=token,
        expires_in=settings.jwt_access_ttl_minutes * 60,
        role=user.role,
    )


@router.get("/me", response_model=MeResponse)
async def me(
    user: AuthenticatedUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MeResponse:
    rows = (
        await session.execute(
            select(OAuthIdentity)
            .where(OAuthIdentity.user_id == user.id)
            .order_by(OAuthIdentity.last_login_at.desc().nulls_last())
        )
    ).scalars().all()
    identities = [
        OAuthIdentitySummary(
            provider=r.provider,
            email=r.email,
            display_name=r.display_name,
            picture_url=r.picture_url,
        )
        for r in rows
    ]
    primary = rows[0] if rows else None
    return MeResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        display_name=primary.display_name if primary else None,
        picture_url=primary.picture_url if primary else None,
        identities=identities,
    )
