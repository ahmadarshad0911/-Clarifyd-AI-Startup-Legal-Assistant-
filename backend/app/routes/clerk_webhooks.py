"""Clerk -> Clarifyd webhook receiver.

Without this, a user deleted from the Clerk dashboard (rather than our admin
console) stays in our database forever: nothing tells us they are gone. This
closes that gap so deletion works from either direction.

Clerk signs webhooks with Svix. We verify the signature with stdlib HMAC rather
than taking on the `svix` dependency for one endpoint.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time

from fastapi import APIRouter, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.config import get_settings
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.services.audit import append_audit_event
from app.services.user_purge import purge_user_data

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhooks"])

# Reject anything older than this. Bounds the window in which a captured
# request can be replayed against us.
_TOLERANCE_SECONDS = 5 * 60


def _verify_signature(
    *, secret: str, svix_id: str, svix_timestamp: str, svix_signature: str, body: bytes
) -> bool:
    """Constant-time check of a Svix signature header.

    Signed payload is `{id}.{timestamp}.{body}`. The header carries one or more
    space-separated `v1,<base64-sig>` entries (Svix sends several while a
    signing secret is being rotated), so any one matching is a pass.
    """
    try:
        ts = int(svix_timestamp)
    except (TypeError, ValueError):
        return False
    if abs(time.time() - ts) > _TOLERANCE_SECONDS:
        logger.warning("Clerk webhook rejected: timestamp outside tolerance.")
        return False

    # Secrets are handed out as `whsec_<base64>`; the raw key is the decoded tail.
    raw_secret = secret.split("_", 1)[1] if secret.startswith("whsec_") else secret
    try:
        key = base64.b64decode(raw_secret)
    except (ValueError, TypeError):
        return False

    signed = b"%s.%s.%s" % (svix_id.encode(), svix_timestamp.encode(), body)
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()

    for part in svix_signature.split():
        _, _, candidate = part.partition(",")
        if candidate and hmac.compare_digest(candidate, expected):
            return True
    return False


@router.post("/webhooks/clerk", include_in_schema=False)
async def clerk_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
    svix_id: str = Header(default="", alias="svix-id"),
    svix_timestamp: str = Header(default="", alias="svix-timestamp"),
    svix_signature: str = Header(default="", alias="svix-signature"),
) -> dict[str, str]:
    secret = get_settings().clerk_webhook_secret
    if not secret:
        # Fail closed. An unverified endpoint that purges users on request is a
        # remote account-deletion primitive for anyone who finds the URL.
        logger.error("Clerk webhook received but CLERK_WEBHOOK_SECRET is unset.")
        raise AppError(
            code=ErrorCode.internal_error,
            message="Webhook receiver is not configured.",
            status_code=503,
        )

    body = await request.body()
    if not _verify_signature(
        secret=secret,
        svix_id=svix_id,
        svix_timestamp=svix_timestamp,
        svix_signature=svix_signature,
        body=body,
    ):
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Invalid webhook signature.",
            status_code=401,
        )

    try:
        event = json.loads(body)
    except ValueError:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Malformed webhook payload.",
            status_code=400,
        ) from None

    event_type = str(event.get("type") or "")
    data = event.get("data") or {}

    if event_type != "user.deleted":
        # Clerk fans out many event types; acknowledge the rest so it does not retry.
        return {"status": "ignored", "type": event_type}

    clerk_user_id = str(data.get("id") or "")
    if not clerk_user_id:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="user.deleted payload has no user id.",
            status_code=400,
        )

    purged = await purge_user_data(session, clerk_user_id)
    await append_audit_event(
        session,
        action="clerk.user_deleted",
        target_type="user",
        target_id=clerk_user_id,
        actor_id=None,
        payload={"source": "clerk_webhook", "purged": purged},
    )
    await session.commit()
    return {"status": "purged", "user_id": clerk_user_id}
