from __future__ import annotations

import asyncio
import importlib
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Iterator

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture
def app_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[Any]:
    """Boot the FastAPI app against a fresh sqlite file. Yields the TestClient."""
    from fastapi.testclient import TestClient

    db_dir = tempfile.mkdtemp(prefix="clarifyd-test-")
    db_path = Path(db_dir) / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("JWT_SECRET", "test-secret-must-be-long-enough")
    monkeypatch.setenv("RATE_LIMIT_LOGIN_PER_MIN", "1000")
    monkeypatch.setenv("RATE_LIMIT_ANALYZE_PER_MIN", "1000")

    from app import config as config_module

    config_module.get_settings.cache_clear()  # type: ignore[attr-defined]

    import app.main as main_module
    import app.routes.auth as auth_module
    import app.rate_limit as rl_module

    importlib.reload(rl_module)
    importlib.reload(auth_module)
    importlib.reload(main_module)
    rl_module.reset_limiter_for_tests()

    with TestClient(main_module.app) as client:
        yield client

    try:
        os.remove(db_path)
    except OSError:
        pass


def _seed_user(email: str, password: str, role: str) -> str:
    from sqlalchemy import select

    from app.auth.password import hash_password
    from app.db.engine import get_sessionmaker
    from app.db.models import User

    async def _run() -> str:
        async with get_sessionmaker()() as session:
            existing = (
                await session.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()
            if existing:
                return existing.id
            user = User(email=email, hashed_password=hash_password(password), role=role)
            session.add(user)
            await session.commit()
            return user.id

    return asyncio.run(_run())


@pytest.fixture
def seeded_users(app_client: Any) -> dict[str, dict[str, str]]:
    accounts = {
        "viewer": {"email": "viewer@example.com", "password": "viewer-pass-1234"},
        "reviewer": {"email": "reviewer@example.com", "password": "reviewer-pass-1234"},
        "admin": {"email": "admin@example.com", "password": "admin-pass-1234"},
    }
    for role, creds in accounts.items():
        creds["id"] = _seed_user(creds["email"], creds["password"], role)
    return accounts
