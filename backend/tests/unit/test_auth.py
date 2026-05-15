from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from app.auth.password import hash_password, verify_password
from app.auth.tokens import create_access_token, decode_token, role_satisfies
from app.config import Settings


def _settings() -> Settings:
    return Settings(jwt_secret="unit-test-secret", jwt_algorithm="HS256", jwt_access_ttl_minutes=5)


def test_password_roundtrip() -> None:
    h = hash_password("hunter2-strong-password")
    assert h != "hunter2-strong-password"
    assert verify_password("hunter2-strong-password", h) is True
    assert verify_password("wrong-password", h) is False


def test_hash_password_rejects_empty() -> None:
    with pytest.raises(ValueError):
        hash_password("")


def test_token_encode_decode_roundtrip() -> None:
    s = _settings()
    token = create_access_token(user_id="u-1", role="reviewer", settings=s)
    payload = decode_token(token, s)
    assert payload["sub"] == "u-1"
    assert payload["role"] == "reviewer"
    assert payload["typ"] == "access"


def test_token_expiry() -> None:
    s = _settings()
    past = datetime.now(timezone.utc) - timedelta(minutes=10)
    token = create_access_token(user_id="u-1", role="viewer", settings=s, now=past)
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(token, s)


def test_role_satisfies_hierarchy() -> None:
    assert role_satisfies("admin", "viewer") is True
    assert role_satisfies("admin", "reviewer") is True
    assert role_satisfies("reviewer", "admin") is False
    assert role_satisfies("viewer", "reviewer") is False
    assert role_satisfies("unknown", "viewer") is False


def test_login_happy_and_me(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    creds = seeded_users["admin"]
    r = app_client.post(
        "/auth/login", json={"email": creds["email"], "password": creds["password"]}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["role"] == "admin"
    token = body["access_token"]

    r2 = app_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    me = r2.json()
    assert me["email"] == creds["email"]
    assert me["role"] == "admin"


def test_login_invalid_credentials(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    creds = seeded_users["viewer"]
    r = app_client.post(
        "/auth/login", json={"email": creds["email"], "password": "wrong-password"}
    )
    assert r.status_code == 401
    assert r.json()["error"]["message"] == "Invalid credentials."


def test_me_rejects_missing_token(app_client: TestClient) -> None:
    r = app_client.get("/auth/me")
    assert r.status_code == 401


def test_me_rejects_invalid_token(app_client: TestClient) -> None:
    r = app_client.get("/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401


def test_cors_preflight_allows_configured_origin(app_client: TestClient) -> None:
    r = app_client.options(
        "/auth/login",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_rate_limit_login(
    monkeypatch: pytest.MonkeyPatch,
    seeded_users: dict[str, dict[str, str]],
    app_client: TestClient,
) -> None:
    # Override settings cache to a tiny limit and reset bucket so the two prior
    # logins inside seeded_users do not pre-fill the window.
    from app.config import get_settings

    get_settings.cache_clear()  # type: ignore[attr-defined]
    monkeypatch.setenv("RATE_LIMIT_LOGIN_PER_MIN", "2")
    get_settings.cache_clear()  # type: ignore[attr-defined]

    from app.rate_limit import reset_limiter_for_tests

    reset_limiter_for_tests()

    creds = seeded_users["viewer"]
    body = {"email": creds["email"], "password": "wrong"}
    statuses = [app_client.post("/auth/login", json=body).status_code for _ in range(4)]
    assert 429 in statuses
