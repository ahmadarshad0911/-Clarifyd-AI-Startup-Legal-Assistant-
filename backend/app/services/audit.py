from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.audit_event import GENESIS_HASH, AuditEvent
from app.logging_config import get_request_id


async def append_audit_event(
    session: AsyncSession,
    *,
    action: str,
    target_type: str,
    target_id: str,
    actor_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> AuditEvent:
    """Append a new audit row, chaining sha256 from the previous row's hash.

    Caller is responsible for committing the surrounding transaction.
    """
    last = (
        await session.execute(select(AuditEvent).order_by(AuditEvent.id.desc()).limit(1))
    ).scalar_one_or_none()
    prev_hash = last.hash if last else GENESIS_HASH
    event = AuditEvent(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        request_id=get_request_id(),
        payload_json=json.dumps(payload or {}, sort_keys=True, separators=(",", ":")),
        prev_hash=prev_hash,
    )
    event.hash = event.compute_hash()
    session.add(event)
    await session.flush()
    return event


async def verify_audit_chain(session: AsyncSession) -> int | None:
    """Recompute hash chain. Returns id of first mismatched row, or None if intact."""
    rows = (
        (await session.execute(select(AuditEvent).order_by(AuditEvent.id))).scalars().all()
    )
    expected_prev = GENESIS_HASH
    for row in rows:
        if row.prev_hash != expected_prev:
            return row.id
        if row.compute_hash() != row.hash:
            return row.id
        expected_prev = row.hash
    return None
