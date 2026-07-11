"""Erase everything a deleted account owns.

Deleting a user used to remove the `user` row and their contract drafts, and
nothing else — their letterhead image, comments, feedback, contact messages,
outbound webhooks and pending OTP rows all survived. Deletion has to mean
deletion, so both the admin console and the Clerk `user.deleted` webhook route
through this one function.

`audit_event` is deliberately NOT purged: it is a tamper-evident hash chain and
deleting links would break verification. It stores an actor id and an action,
not document content.
"""

from __future__ import annotations

import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Comment,
    ContactMessage,
    ContractDraft,
    EmailVerification,
    Feedback,
    OAuthIdentity,
    User,
    UserLetterhead,
    Webhook,
)

logger = logging.getLogger(__name__)


async def purge_user_data(
    session: AsyncSession, user_id: str, email: str | None = None
) -> dict[str, int]:
    """Delete every row belonging to `user_id`. Returns {table: rows_deleted}.

    Does not commit — the caller owns the transaction so the purge and its audit
    event land together or not at all.

    Deleting a ContractDraft cascades to its clause findings, review actions,
    review queue items and export jobs via FK, so those need no explicit pass.
    Rows where this user merely *acted* on someone else's draft are left alone:
    they are not this user's data, and nulling them would corrupt another
    founder's review history.
    """
    deleted: dict[str, int] = {}

    # Clerk's user.deleted payload carries only an id, so recover the email from
    # our own row while it still exists — email-keyed rows can't be found later.
    if email is None:
        email = (
            await session.execute(select(User.email).where(User.id == user_id))
        ).scalar_one_or_none()

    async def _run(table_name: str, stmt) -> None:
        result = await session.execute(stmt)
        count = result.rowcount or 0
        if count:
            deleted[table_name] = count

    await _run("contract_draft", delete(ContractDraft).where(ContractDraft.owner_id == user_id))
    await _run("user_letterhead", delete(UserLetterhead).where(UserLetterhead.user_id == user_id))
    await _run("comment", delete(Comment).where(Comment.author_id == user_id))
    await _run("webhook", delete(Webhook).where(Webhook.owner_id == user_id))
    await _run("feedback", delete(Feedback).where(Feedback.user_id == user_id))
    await _run("contact_message", delete(ContactMessage).where(ContactMessage.user_id == user_id))
    await _run("oauth_identity", delete(OAuthIdentity).where(OAuthIdentity.user_id == user_id))

    # OTP rows are keyed by email, not user id: leaving them means a recreated
    # account inherits the deleted account's pending verification codes.
    if email:
        await _run(
            "email_verification", delete(EmailVerification).where(EmailVerification.email == email)
        )

    await _run("user", delete(User).where(User.id == user_id))

    logger.info("Purged user %s: %s", user_id, deleted or "no rows")
    return deleted
