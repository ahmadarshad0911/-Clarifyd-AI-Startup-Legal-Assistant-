from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uuid() -> str:
    return uuid4().hex


GENESIS_HASH = "0" * 64


class AuditEvent(Base):
    """Append-only audit log with SHA-256 hash chain.

    Each row's `hash` = sha256(prev_hash || canonical_payload || ts || actor_id || action || target).
    Verifying the chain detects tampering: any modification or row deletion breaks the next row's hash.
    """

    __tablename__ = "audit_event"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, default=_uuid)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    actor_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False, default=GENESIS_HASH)
    hash: Mapped[str] = mapped_column(String(64), nullable=False)

    def compute_hash(self) -> str:
        if self.ts is None:
            self.ts = datetime.now(timezone.utc)
        ts_value = self.ts
        if ts_value.tzinfo is not None:
            ts_value = ts_value.astimezone(timezone.utc).replace(tzinfo=None)
        ts_iso = ts_value.replace(microsecond=0).isoformat()
        try:
            payload_canonical = json.dumps(json.loads(self.payload_json), sort_keys=True, separators=(",", ":"))
        except (TypeError, ValueError):
            payload_canonical = self.payload_json or "{}"
        material = "|".join(
            [
                self.prev_hash,
                ts_iso,
                self.actor_id or "",
                self.action,
                self.target_type,
                self.target_id,
                self.request_id or "",
                payload_canonical,
            ]
        )
        return hashlib.sha256(material.encode("utf-8")).hexdigest()
