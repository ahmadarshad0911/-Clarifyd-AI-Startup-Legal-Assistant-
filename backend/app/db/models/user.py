from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql.elements import quoted_name

from app.db.base import Base


def _uuid() -> str:
    return uuid4().hex


class User(Base):
    # "user" is a reserved word in Postgres — force-quote so SELECT/INSERT
    # emit FROM "user" instead of bare `FROM user` (which Postgres rejects).
    __tablename__ = quoted_name("user", quote=True)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="viewer")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Set once the user successfully enters the 6-digit OTP we email them
    # at signup. /auth/login rejects users where this is NULL.
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
