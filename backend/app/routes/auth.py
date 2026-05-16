from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, current_user
from app.auth.password import hash_password, verify_password
from app.auth.tokens import create_access_token
from app.config import Settings, get_settings
from app.db.models import EmailVerification, OAuthIdentity, User
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.rate_limit import rate_limit
from app.services.audit import append_audit_event
from app.services.email import (
    OTP_EMAIL_SUBJECT,
    build_email_sender,
    render_otp_email,
)

logger = logging.getLogger(__name__)

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
    email: EmailStr = Field(max_length=256)
    # NIST SP 800-63B aligned: 12-char minimum. UI suggester gives 16.
    password: str = Field(min_length=12, max_length=256)


class RegisterResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    verification_required: bool = True
    email: str
    expires_in: int


class VerifyOtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendOtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr


_login_limiter = rate_limit("auth.login", limit_attr="rate_limit_login_per_min")


def _generate_otp() -> str:
    """6-digit zero-padded crypto random."""
    return f"{secrets.randbelow(1_000_000):06d}"


async def _create_and_send_otp(
    session: AsyncSession, settings: Settings, email: str
) -> int:
    """Generate a 6-digit OTP, store its bcrypt hash, email it, return ttl."""
    otp = _generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.otp_ttl_seconds)
    session.add(
        EmailVerification(
            email=email,
            otp_hash=hash_password(otp),
            expires_at=expires_at,
        )
    )
    await session.flush()
    sender = build_email_sender(settings)
    html, text = render_otp_email(otp)
    try:
        await sender.send(to=email, subject=OTP_EMAIL_SUBJECT, html=html, text=text)
    except Exception:
        logger.exception("OTP email failed for %s — code logged for dev access", email)
    return settings.otp_ttl_seconds


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
    # NOTE: OTP-verification gate temporarily disabled per product call.
    # Re-enable by un-commenting the block below when email infrastructure
    # (verified domain on Resend or SMTP relay) is ready.
    # if user.email_verified_at is None:
    #     raise AppError(
    #         code=ErrorCode.request_validation_error,
    #         message="Email not verified. Check your inbox for the 6-digit code.",
    #         status_code=403,
    #     )

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
    """OTP verification disabled — users get a token immediately on signup.
    Schema for email_verification + endpoints below remain dormant so we
    can flip the gate back on without a migration when email infra is
    ready."""
    email = str(body.email).strip().lower()
    existing = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if existing is not None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="An account with this email already exists.",
            status_code=409,
        )

    now = datetime.now(timezone.utc)
    user = User(
        email=email,
        hashed_password=hash_password(body.password),
        role="reviewer",
        email_verified_at=now,  # auto-verify while gate is off
    )
    session.add(user)
    await session.flush()
    await append_audit_event(
        session,
        action="auth.register",
        target_type="user",
        target_id=user.id,
        actor_id=user.id,
        payload={"email": user.email},
    )
    token = create_access_token(user_id=user.id, role=user.role, settings=settings)
    await session.commit()
    return LoginResponse(
        access_token=token,
        expires_in=settings.jwt_access_ttl_minutes * 60,
        role=user.role,
    )


async def _expire_pending_otps(session: AsyncSession, email: str) -> None:
    """Mark all unconsumed OTPs for an email as consumed (defensive)."""
    rows = (
        await session.execute(
            select(EmailVerification)
            .where(EmailVerification.email == email)
            .where(EmailVerification.consumed_at.is_(None))
        )
    ).scalars().all()
    now = datetime.now(timezone.utc)
    for r in rows:
        r.consumed_at = now


@router.post(
    "/verify-otp",
    response_model=LoginResponse,
    dependencies=[Depends(_login_limiter)],
)
async def verify_otp(
    body: VerifyOtpRequest,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> LoginResponse:
    email = str(body.email).strip().lower()
    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="No pending verification for that email.",
            status_code=404,
        )
    if user.email_verified_at is not None:
        # Already verified — be polite, hand them a fresh token.
        token = create_access_token(user_id=user.id, role=user.role, settings=settings)
        return LoginResponse(
            access_token=token,
            expires_in=settings.jwt_access_ttl_minutes * 60,
            role=user.role,
        )

    record = (
        await session.execute(
            select(EmailVerification)
            .where(EmailVerification.email == email)
            .where(EmailVerification.consumed_at.is_(None))
            .order_by(EmailVerification.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if record is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="No pending verification. Request a new code.",
            status_code=400,
        )
    now = datetime.now(timezone.utc)
    if record.expires_at < now:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Verification code expired. Request a new one.",
            status_code=400,
        )
    if record.attempts >= settings.otp_max_attempts:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Too many attempts. Request a new code.",
            status_code=429,
        )
    if not verify_password(body.otp, record.otp_hash):
        record.attempts += 1
        await session.commit()
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Incorrect code.",
            status_code=400,
        )

    record.consumed_at = now
    user.email_verified_at = now
    await append_audit_event(
        session,
        action="auth.email_verified",
        target_type="user",
        target_id=user.id,
        actor_id=user.id,
        payload={"email": user.email},
    )
    token = create_access_token(user_id=user.id, role=user.role, settings=settings)
    await session.commit()
    return LoginResponse(
        access_token=token,
        expires_in=settings.jwt_access_ttl_minutes * 60,
        role=user.role,
    )


@router.post(
    "/resend-otp",
    response_model=RegisterResponse,
    dependencies=[Depends(_login_limiter)],
)
async def resend_otp(
    body: ResendOtpRequest,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> RegisterResponse:
    email = str(body.email).strip().lower()
    user = (
        await session.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()
    if user is None:
        # Don't leak existence — pretend we sent one.
        return RegisterResponse(email=email, expires_in=settings.otp_ttl_seconds)
    if user.email_verified_at is not None:
        # Already verified — no-op.
        return RegisterResponse(email=email, expires_in=0)

    # Cooldown: refuse a resend if the latest OTP was created within the cooldown.
    latest = (
        await session.execute(
            select(EmailVerification)
            .where(EmailVerification.email == email)
            .where(EmailVerification.consumed_at.is_(None))
            .order_by(EmailVerification.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if latest is not None:
        age = (datetime.now(timezone.utc) - latest.created_at).total_seconds()
        if age < settings.otp_resend_cooldown_seconds:
            wait = int(settings.otp_resend_cooldown_seconds - age)
            raise AppError(
                code=ErrorCode.request_validation_error,
                message=f"Please wait {wait}s before requesting another code.",
                status_code=429,
            )

    await _expire_pending_otps(session, email)
    ttl = await _create_and_send_otp(session, settings, email)
    await session.commit()
    return RegisterResponse(email=email, expires_in=ttl)


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
