from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uuid() -> str:
    return uuid4().hex


class ClauseFinding(Base):
    __tablename__ = "clause_finding"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    draft_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("contract_draft.id", ondelete="CASCADE"), nullable=False, index=True
    )
    finding_id: Mapped[str] = mapped_column(String(64), nullable=False)
    clause_name: Mapped[str] = mapped_column(String(64), nullable=False)
    excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    explanation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    safer_language: Mapped[str | None] = mapped_column(Text, nullable=True)
    injection_suspected: Mapped[bool] = mapped_column(default=False, nullable=False)
