from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
from datetime import datetime, timezone
from typing import Any, Literal
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.password import hash_password
from app.auth.tokens import create_access_token
from app.config import Settings, get_settings
from app.db.models import OAuthIdentity, User
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.services.audit import append_audit_event

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/oauth", tags=["auth"])

Provider = Literal["google", "microsoft", "facebook"]


def _clean(value: str) -> str:
    """Treat blank or PASTE_* placeholder values as unset."""
    v = (value or "").strip()
    if not v or v.startswith("PASTE_"):
        return ""
    return v


def _provider_cfg(provider: Provider, settings: Settings) -> dict[str, str]:
    if provider == "google":
        return {
            "client_id": _clean(settings.google_oauth_client_id),
            "client_secret": _clean(settings.google_oauth_client_secret),
            "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
            "token_url": "https://oauth2.googleapis.com/token",
            "userinfo_url": "https://openidconnect.googleapis.com/v1/userinfo",
            "scope": "openid email profile",
        }
    if provider == "microsoft":
        tenant = settings.microsoft_oauth_tenant or "common"
        return {
            "client_id": _clean(settings.microsoft_oauth_client_id),
            "client_secret": _clean(settings.microsoft_oauth_client_secret),
            "auth_url": f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
            "token_url": f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
            "userinfo_url": "https://graph.microsoft.com/v1.0/me",
            "scope": "openid email profile User.Read",
        }
    if provider == "facebook":
        return {
            "client_id": _clean(settings.facebook_oauth_client_id),
            "client_secret": _clean(settings.facebook_oauth_client_secret),
            "auth_url": "https://www.facebook.com/v18.0/dialog/oauth",
            "token_url": "https://graph.facebook.com/v18.0/oauth/access_token",
            "userinfo_url": "https://graph.facebook.com/me?fields=id,email,name",
            "scope": "email,public_profile",
        }
    raise AppError(
        code=ErrorCode.request_validation_error,
        message="Unsupported OAuth provider.",
        status_code=400,
    )


def _sign_state(settings: Settings, provider: Provider, nonce: str) -> str:
    payload = f"{provider}.{nonce}".encode()
    # 32 hex chars = 128 bits of HMAC strength.
    sig = hmac.new(settings.jwt_secret.encode(), payload, hashlib.sha256).hexdigest()[:32]
    return f"{provider}.{nonce}.{sig}"


def _verify_state(settings: Settings, provider: Provider, state: str) -> bool:
    parts = state.split(".")
    if len(parts) != 3:
        return False
    p, nonce, sig = parts
    if p != provider:
        return False
    expect = hmac.new(
        settings.jwt_secret.encode(), f"{p}.{nonce}".encode(), hashlib.sha256
    ).hexdigest()[:32]
    return hmac.compare_digest(sig, expect)


def _redirect_uri(provider: Provider, settings: Settings) -> str:
    return f"{settings.oauth_backend_base_url.rstrip('/')}/auth/oauth/{provider}/callback"


def _normalize_profile(provider: Provider, profile: dict[str, Any]) -> dict[str, Any]:
    """Pull a uniform shape out of the provider-specific JSON payload."""
    if provider == "google":
        # OpenID userinfo: sub, name, given_name, family_name, picture, email, locale
        return {
            "subject": str(profile.get("sub") or ""),
            "email": (profile.get("email") or "").strip().lower(),
            "display_name": profile.get("name"),
            "given_name": profile.get("given_name"),
            "family_name": profile.get("family_name"),
            "picture_url": profile.get("picture"),
            "locale": profile.get("locale"),
        }
    if provider == "facebook":
        # graph.facebook.com/me?fields=id,email,name returns id, email, name.
        # Facebook splits name only if you request first_name/last_name explicitly.
        full = profile.get("name") or ""
        first, _, last = full.partition(" ")
        return {
            "subject": str(profile.get("id") or ""),
            "email": (profile.get("email") or "").strip().lower(),
            "display_name": full or None,
            "given_name": first or None,
            "family_name": last or None,
            "picture_url": f"https://graph.facebook.com/{profile.get('id')}/picture?type=large"
            if profile.get("id")
            else None,
            "locale": None,
        }
    if provider == "microsoft":
        return {
            "subject": str(profile.get("id") or ""),
            "email": (profile.get("mail") or profile.get("userPrincipalName") or "")
            .strip()
            .lower(),
            "display_name": profile.get("displayName"),
            "given_name": profile.get("givenName"),
            "family_name": profile.get("surname"),
            "picture_url": None,
            "locale": profile.get("preferredLanguage"),
        }
    return {"subject": "", "email": ""}


@router.get("/{provider}/authorize")
async def authorize(
    provider: Provider,
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    cfg = _provider_cfg(provider, settings)
    if not cfg["client_id"]:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message=f"{provider.capitalize()} OAuth is not configured on the server.",
            status_code=503,
        )
    state = _sign_state(settings, provider, secrets.token_urlsafe(16))
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": _redirect_uri(provider, settings),
        "response_type": "code",
        "scope": cfg["scope"],
        "state": state,
        "prompt": "select_account",
    }
    return RedirectResponse(url=f"{cfg['auth_url']}?{urlencode(params)}", status_code=302)


@router.get("/{provider}/callback")
async def callback(
    provider: Provider,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    frontend = settings.oauth_frontend_callback_url

    if error or not code or not state:
        msg = error_description or error or "Missing authorization code."
        return RedirectResponse(
            url=f"{frontend}?error={urlencode({'m': msg})[2:]}", status_code=302
        )
    if not _verify_state(settings, provider, state):
        return RedirectResponse(url=f"{frontend}?error=invalid_state", status_code=302)

    cfg = _provider_cfg(provider, settings)
    if not cfg["client_id"] or not cfg["client_secret"]:
        return RedirectResponse(url=f"{frontend}?error=provider_not_configured", status_code=302)

    # Exchange code -> access token
    async with httpx.AsyncClient(timeout=20.0) as http:
        try:
            token_res = await http.post(
                cfg["token_url"],
                data={
                    "code": code,
                    "client_id": cfg["client_id"],
                    "client_secret": cfg["client_secret"],
                    "redirect_uri": _redirect_uri(provider, settings),
                    "grant_type": "authorization_code",
                },
                headers={"Accept": "application/json"},
            )
        except httpx.HTTPError as exc:
            logger.error("OAuth token exchange failed: %r", exc)
            return RedirectResponse(url=f"{frontend}?error=token_exchange_failed", status_code=302)

        if token_res.status_code >= 400:
            logger.error(
                "OAuth token exchange %s: %s",
                token_res.status_code,
                token_res.text[:300],
            )
            return RedirectResponse(url=f"{frontend}?error=token_rejected", status_code=302)

        try:
            token_payload = token_res.json()
        except ValueError:
            return RedirectResponse(url=f"{frontend}?error=token_parse", status_code=302)

        access_token = token_payload.get("access_token")
        if not access_token:
            return RedirectResponse(url=f"{frontend}?error=no_access_token", status_code=302)

        # Fetch user profile
        try:
            ui_res = await http.get(
                cfg["userinfo_url"],
                headers={"Authorization": f"Bearer {access_token}"},
            )
        except httpx.HTTPError as exc:
            logger.error("OAuth userinfo fetch failed: %r", exc)
            return RedirectResponse(url=f"{frontend}?error=userinfo_failed", status_code=302)

        if ui_res.status_code >= 400:
            logger.error("OAuth userinfo %s: %s", ui_res.status_code, ui_res.text[:300])
            return RedirectResponse(url=f"{frontend}?error=userinfo_rejected", status_code=302)

        try:
            profile = ui_res.json()
        except ValueError:
            return RedirectResponse(url=f"{frontend}?error=userinfo_parse", status_code=302)

    # Normalize provider-specific payload into a uniform shape.
    norm = _normalize_profile(provider, profile)
    subject = norm["subject"]
    email = norm["email"]
    if not subject:
        return RedirectResponse(url=f"{frontend}?error=no_subject", status_code=302)
    if not email:
        # Facebook accounts can decline the email permission. Fabricate a stable
        # placeholder so a User row exists; UI can prompt later for a real email.
        if provider == "facebook":
            email = f"fb-{subject}@users.noreply.facebook.local"
        else:
            return RedirectResponse(url=f"{frontend}?error=no_email", status_code=302)

    # 1) Look up existing OAuth identity by (provider, subject) — primary key for "same person".
    identity = (
        await session.execute(
            select(OAuthIdentity).where(
                OAuthIdentity.provider == provider,
                OAuthIdentity.subject == subject,
            )
        )
    ).scalar_one_or_none()

    is_new = False
    if identity is not None:
        # Returning OAuth user — load their User row.
        user = (
            await session.execute(select(User).where(User.id == identity.user_id))
        ).scalar_one_or_none()
        if user is None:
            # Orphaned identity (user row deleted) — recreate.
            user = User(
                email=email,
                hashed_password=hash_password(secrets.token_urlsafe(24)),
                role="reviewer",
            )
            session.add(user)
            await session.flush()
            identity.user_id = user.id
            is_new = True
    else:
        # First time this provider+subject — link to existing email user if one exists,
        # else create a fresh User row.
        user = (
            await session.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()
        if user is None:
            user = User(
                email=email,
                hashed_password=hash_password(secrets.token_urlsafe(24)),  # unusable password
                role="reviewer",
            )
            session.add(user)
            await session.flush()
            is_new = True
        identity = OAuthIdentity(
            user_id=user.id,
            provider=provider,
            subject=subject,
        )
        session.add(identity)

    if user.disabled_at is not None:
        return RedirectResponse(url=f"{frontend}?error=account_disabled", status_code=302)

    # Refresh stored profile every login — captures name/picture changes.
    identity.email = email
    identity.display_name = norm.get("display_name")
    identity.given_name = norm.get("given_name")
    identity.family_name = norm.get("family_name")
    identity.picture_url = norm.get("picture_url")
    identity.locale = norm.get("locale")
    identity.raw_profile_json = json.dumps(profile)[:8000]  # cap to avoid runaway TEXT
    identity.last_login_at = datetime.now(timezone.utc)

    token = create_access_token(user_id=user.id, role=user.role, settings=settings)
    await append_audit_event(
        session,
        action="auth.oauth_login",
        target_type="user",
        target_id=user.id,
        actor_id=user.id,
        payload={
            "provider": provider,
            "email": user.email,
            "is_new": is_new,
            "display_name": identity.display_name,
        },
    )
    await session.commit()

    qs = urlencode(
        {
            "token": token,
            "role": user.role,
            "provider": provider,
            "new": "1" if is_new else "0",
        }
    )
    return RedirectResponse(url=f"{frontend}?{qs}", status_code=302)
