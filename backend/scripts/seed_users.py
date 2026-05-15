"""Seed three demo accounts for local frontend testing.

Usage:
    cd backend
    .\\.venv\\Scripts\\python.exe -m scripts.seed_users
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.auth.password import hash_password
from app.config import get_settings
from app.db import create_engine_and_sessionmaker
from app.db.base import Base
from app.db.models import User

DEMO_ACCOUNTS = [
    ("viewer@example.com", "viewer-pass-1234", "viewer"),
    ("reviewer@example.com", "reviewer-pass-1234", "reviewer"),
    ("admin@example.com", "admin-pass-1234", "admin"),
    ("admin", "123", "admin"),
]


async def _run() -> None:
    settings = get_settings()
    engine, sessionmaker = create_engine_and_sessionmaker(
        settings.database_url, echo=settings.db_echo
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with sessionmaker() as session:
        for email, password, role in DEMO_ACCOUNTS:
            existing = (
                await session.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()
            if existing:
                print(f"= {email} already exists ({existing.role})")
                continue
            session.add(
                User(email=email, hashed_password=hash_password(password), role=role)
            )
            print(f"+ created {email} ({role}) password={password}")
        await session.commit()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(_run())
