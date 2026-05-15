from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, PrimaryKeyConstraint, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ClauseCache(Base):
    """Per-(provider, model, clause-sha256) cached LLM finding payload.

    Used to avoid duplicate spend when the same clause text reappears across uploads.
    """

    __tablename__ = "clause_cache"
    __table_args__ = (
        PrimaryKeyConstraint("provider", "model", "clause_sha256", name="pk_clause_cache"),
    )

    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    clause_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    body_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
