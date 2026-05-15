from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_exposes_reasoning_provider() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["reasoning_provider"] in {"openai", "kimi"}


def test_policy_check_failure_returns_structured_app_error() -> None:
    response = client.get("/infra/policy-check?fail=true")
    assert response.status_code == 400
    payload = response.json()["error"]
    assert payload["code"] == "policy_violation"
    assert "request_id" in payload


def test_request_id_header_is_always_returned() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID")
