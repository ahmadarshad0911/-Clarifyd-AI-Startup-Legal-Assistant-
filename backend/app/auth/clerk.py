"""Clerk JWT verification.

Clerk signs session tokens with RS256 against a public JWKS hosted at
`<frontend_api>/.well-known/jwks.json`. We cache the JWKS in-process for one
hour and rotate on signature failure.

The verified claims dictionary is returned. Callers map `sub` (the Clerk
user id) and `email` to a row in our local `user` table via upsert.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
import jwt
from jwt import PyJWKClient

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

_JWKS_CLIENT: PyJWKClient | None = None
_JWKS_URL: str | None = None
_JWKS_REFRESHED_AT: float = 0.0
_JWKS_TTL_SECONDS = 3600


class ClerkAuthError(Exception):
    """Raised when a Clerk session token cannot be verified."""


def _jwks_client(settings: Settings) -> PyJWKClient:
    global _JWKS_CLIENT, _JWKS_URL, _JWKS_REFRESHED_AT
    url = settings.clerk_jwks_url
    if not url:
        raise ClerkAuthError("CLERK_JWKS_URL is not configured.")
    now = time.time()
    if (
        _JWKS_CLIENT is None
        or _JWKS_URL != url
        or now - _JWKS_REFRESHED_AT > _JWKS_TTL_SECONDS
    ):
        _JWKS_CLIENT = PyJWKClient(url, cache_keys=True)
        _JWKS_URL = url
        _JWKS_REFRESHED_AT = now
    return _JWKS_CLIENT


def verify_clerk_session_token(
    token: str, settings: Settings | None = None
) -> dict[str, Any]:
    """Verify a Clerk-issued JWT and return its claims.

    Raises ClerkAuthError on any failure (bad signature, expired, wrong
    issuer/audience, JWKS unreachable). Callers should map ClerkAuthError
    to a 401 AppError.
    """
    s = settings or get_settings()
    if not s.clerk_issuer:
        raise ClerkAuthError("CLERK_ISSUER is not configured.")

    try:
        client = _jwks_client(s)
        signing_key = client.get_signing_key_from_jwt(token).key
    except ClerkAuthError:
        raise
    except (httpx.HTTPError, jwt.PyJWKClientError) as exc:
        logger.warning("Clerk JWKS lookup failed: %r", exc)
        raise ClerkAuthError("Could not fetch Clerk signing keys.") from exc
    except jwt.InvalidTokenError as exc:
        # A malformed/non-JWT bearer makes get_signing_key_from_jwt raise
        # DecodeError (an InvalidTokenError) — treat as an auth failure (401),
        # not an unhandled 500.
        logger.warning("Clerk token malformed before verification: %r", exc)
        raise ClerkAuthError("Invalid Clerk session token.") from exc
    except Exception as exc:  # defensive: auth must never surface as a 500
        logger.warning("Unexpected Clerk signing-key error: %r", exc)
        raise ClerkAuthError("Could not resolve Clerk signing key.") from exc

    try:
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=s.clerk_issuer,
            audience=s.clerk_audience or None,
            options={"verify_aud": bool(s.clerk_audience)},
        )
    except jwt.ExpiredSignatureError as exc:
        raise ClerkAuthError("Session token expired.") from exc
    except jwt.InvalidIssuerError as exc:
        raise ClerkAuthError("Token issuer does not match CLERK_ISSUER.") from exc
    except jwt.InvalidAudienceError as exc:
        raise ClerkAuthError("Token audience does not match CLERK_AUDIENCE.") from exc
    except jwt.InvalidTokenError as exc:
        logger.warning("Clerk token rejected: %r", exc)
        raise ClerkAuthError("Invalid Clerk session token.") from exc

    return claims
