from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uuid() -> str:
    return uuid4().hex


class Comment(Base):
    __tablename__ = "comment"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    draft_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("contract_draft.id", ondelete="CASCADE"), nullable=False, index=True
    )
    finding_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("clause_finding.id", ondelete="CASCADE"), nullable=True, index=True
    )
    author_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
