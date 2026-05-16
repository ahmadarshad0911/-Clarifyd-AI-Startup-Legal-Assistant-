from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column


def _uuid() -> str:
    return uuid4().hex


from app.db.base import Base


class ContractDraft(Base):
    __tablename__ = "contract_draft"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    mime: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    owner_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Full AnalyzeContractResponse JSON dump so the Findings tab can rehydrate
    # the entire report (loopholes, suggestions, extracted_text) on any device
    # or origin without relying on the user's localStorage.
    analysis_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Set the first time the user accepts a suggestion or generates a
    # collaborator document in the Negotiation Lab. Used to bucket drafts
    # between the Findings tab (NULL = still up for review) and the
    # Negotiate tab (NOT NULL = actively negotiated).
    negotiated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
