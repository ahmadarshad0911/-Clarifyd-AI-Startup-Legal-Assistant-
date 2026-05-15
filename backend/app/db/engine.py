from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def create_engine_and_sessionmaker(database_url: str, echo: bool = False) -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    global _engine, _sessionmaker
    _engine = create_async_engine(database_url, echo=echo, future=True)
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
