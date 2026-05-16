from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def create_engine_and_sessionmaker(database_url: str, echo: bool = False) -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Create the async engine + sessionmaker.

    Postgres on serverless (Vercel / Lambda) needs NullPool: containers
    freeze between invocations and any cached asyncpg connection is dead
    on the next wake. NullPool opens + closes a fresh connection per
    transaction, which Neon's pooler endpoint can absorb cheaply.
    """
    global _engine, _sessionmaker
    kwargs: dict = {"echo": echo, "future": True}
    if database_url.startswith(("postgresql+asyncpg://", "postgresql://")):
        # NullPool already opens fresh per checkout; pool_pre_ping is moot here.
        kwargs["poolclass"] = NullPool
    _engine = create_async_engine(database_url, **kwargs)
    _sessionmaker = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)
    return _engine, _sessionmaker


def get_engine() -> AsyncEngine:
    if _engine is None:
        raise RuntimeError("Engine not initialized. Call create_engine_and_sessionmaker first.")
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    if _sessionmaker is None:
        raise RuntimeError("Sessionmaker not initialized. Call create_engine_and_sessionmaker first.")
    return _sessionmaker


async def dispose_engine() -> None:
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _sessionmaker = None
