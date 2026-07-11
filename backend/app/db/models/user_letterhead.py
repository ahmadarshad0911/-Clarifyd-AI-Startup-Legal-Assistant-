from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserLetterhead(Base):
    """A founder's A4 letterhead (PDF or DOCX), stored per user.

    One row per user (PK = the Clerk user id). The raw file bytes live in
    `content` so a generated company document can be composited onto the
    letterhead server-side without any external blob store — the file is
    small (A4 header/footer art, capped a few MB) and Postgres TOASTs it.
    """

    __tablename__ = "user_letterhead"

    user_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime: Mapped[str] = mapped_column(String(100), nullable=False)
    # "pdf" or "docx" — the compositor picks its render path from this.
    kind: Mapped[str] = mapped_column(String(8), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
