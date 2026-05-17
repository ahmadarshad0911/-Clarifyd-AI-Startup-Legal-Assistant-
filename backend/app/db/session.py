from __future__ import annotations

import os
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.db.engine import create_engine_and_sessionmaker, get_sessionmaker


# True on Vercel / Lambda where the container's asyncio loop can change
# between invocations. On serverless we MUST rebuild the engine per request
# because a cached AsyncEngine is bound to whatever loop created it, and
# the next invocation may run on a different loop -> asyncpg crashes with
# `RuntimeError: <Future …> attached to a different loop` or worse
# silently 500s ("FUNCTION_INVOCATION_FAILED" with no app log).
#
# Detected via VERCEL env var (set by every Vercel runtime, build + runtime).
# Lambda would set AWS_EXECUTION_ENV; harmless to add later.
_IS_SERVERLESS = bool(os.environ.get("VERCEL") or os.environ.get("AWS_EXECUTION_ENV"))


def build_request_scoped_engine() -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    """Create a one-shot AsyncEngine + sessionmaker bound to the current loop.

    NullPool means no cross-request connection reuse — every transaction
    opens + closes a fresh asyncpg connection. On Neon's pooler endpoint
    this is cheap (~30-50 ms) and never accumulates dead sockets.

    Caller MUST `await engine.dispose()` once done with the sessionmaker;
    otherwise asyncpg file descriptors leak across hot-container reuses.
    Public so the parallel reporter task in main.py can use the same
    per-request pattern from its own isolated coroutine.
    """
    settings = get_settings()
    kwargs: dict = {"echo": settings.db_echo, "future": True, "poolclass": NullPool}
    engine = create_async_engine(settings.database_url, **kwargs)
    sm = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    return engine, sm


# Back-compat alias for any old test imports — points at the public name.
_build_per_request_engine = build_request_scoped_engine


# Module-flag readable by callers that need to know if they're on
# serverless and should rebuild their own engines.
IS_SERVERLESS = _IS_SERVERLESS


async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield a SQLAlchemy AsyncSession.

    On serverless (Vercel / Lambda) we build a fresh engine per request and
    dispose it at the end of the request. This is the cure for the
    long-standing intermittent 500s on /auth/login: a cached engine from a
    prior invocation is bound to a closed event loop, and asyncpg raises
    `Event loop is closed` which Vercel's adapter surfaces as
    `FUNCTION_INVOCATION_FAILED` with no Python stack reaching the user.

    On local dev we keep the cached engine the lifespan handler creates;
    creating a new engine per request would still work but is wasteful when
    the loop is stable across the whole `uvicorn --reload` lifecycle.
    """
    if _IS_SERVERLESS:
        engine, sessionmaker = build_request_scoped_engine()
        try:
            async with sessionmaker() as session:
                try:
                    yield session
                except Exception:
                    await session.rollback()
                    raise
        finally:
            # Close the asyncpg connection pool tied to *this* loop. Without
            # this, file descriptors leak across hot-container reuses and
            # eventually exhaust Neon's connection limit.
            await engine.dispose()
        return

    # ---------- Local dev path: reuse the lifespan-created engine ----------
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
