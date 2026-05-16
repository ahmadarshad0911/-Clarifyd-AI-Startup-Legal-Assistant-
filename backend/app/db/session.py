from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.engine import create_engine_and_sessionmaker, get_sessionmaker


async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield a SQLAlchemy AsyncSession.

    Lazy-initializes the engine + sessionmaker on first call. This keeps
    the cold-start cost out of `lifespan()` (which serverless ASGI
    adapters — including Vercel's @vercel/python — don't always fire).
    """
    try:
        sessionmaker = get_sessionmaker()
    except RuntimeError:
        settings = get_settings()
        _, sessionmaker = create_engine_and_sessionmaker(
            settings.database_url, echo=settings.db_echo
        )
    async with sessionmaker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
