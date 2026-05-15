from __future__ import annotations

from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

import jwt

from app.config import Settings


class Role(str, Enum):
    admin = "admin"
    reviewer = "reviewer"
    viewer = "viewer"

    def rank(self) -> int:
        return {"viewer": 0, "reviewer": 1, "admin": 2}[self.value]


_ROLE_RANKS: dict[str, int] = {"viewer": 0, "reviewer": 1, "admin": 2}


def role_satisfies(actual: str, required: str) -> bool:
    if actual not in _ROLE_RANKS or required not in _ROLE_RANKS:
        return False
    return _ROLE_RANKS[actual] >= _ROLE_RANKS[required]


def create_access_token(
    *, user_id: str, role: str, settings: Settings, now: datetime | None = None
) -> str:
    issued = now or datetime.now(timezone.utc)
    expires = issued + timedelta(minutes=settings.jwt_access_ttl_minutes)
    payload: dict[str, Any] = {
        "sub": user_id,
        "role": role,
        "iat": int(issued.timestamp()),
        "exp": int(expires.timestamp()),
        "typ": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, settings: Settings) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
