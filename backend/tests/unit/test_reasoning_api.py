from __future__ import annotations

import io
import zipfile

from fastapi.testclient import TestClient


def _docx_bytes(text: str) -> bytes:
    doc = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("word/document.xml", doc)
    return buf.getvalue()


def _login(client: TestClient, creds: dict[str, str]) -> str:
    r = client.post("/auth/login", json={"email": creds["email"], "password": creds["password"]})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _seed_draft(client: TestClient, token: str) -> str:
    body = (
        "Termination: The provider may terminate this agreement at any time without notice. "
        "Liability: The provider's total liability shall be unlimited. "
        "Confidentiality: Both parties agree to keep information confidential."
    )
    r = client.post(
        "/analyze/contract",
        files={"file": ("c.docx", _docx_bytes(body), "application/octet-stream")},
        headers=_bearer(token),
    )
    assert r.status_code == 200, r.text
    return r.json()["draft_id"]


def test_categories_public(app_client: TestClient) -> None:
    r = app_client.get("/api/v1/reasoning/categories")
    assert r.status_code == 200
    body = r.json()
    assert "termination" in body["categories"]
    assert "liability" in body["categories"]


def test_evaluate_requires_draft_or_text(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["viewer"])
    r = app_client.post("/api/v1/reasoning/evaluate", json={}, headers=_bearer(token))
    assert r.status_code == 422


def test_evaluate_ranks_findings_and_carries_disclaimer(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    reviewer = _login(app_client, seeded_users["reviewer"])
    draft_id = _seed_draft(app_client, reviewer)

    viewer = _login(app_client, seeded_users["viewer"])
    r = app_client.post(
        "/api/v1/reasoning/evaluate",
        json={"draft_id": draft_id},
        headers=_bearer(viewer),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["not_legal_advice"] is True
    assert "licensed counsel" in body["disclaimer"].lower() or "decision-support" in body["disclaimer"].lower()
    assert body["findings"], "findings should not be empty"

    rank = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    last_key: tuple[int, float, float] | None = None
    for f in body["findings"]:
        assert f["founder_guidance"]["plain_english"]
        assert len(f["categories"]) >= 1
        key = (rank[f["risk_level"]], f["risk_score"], f["confidence"])
        if last_key is not None:
            assert key <= last_key, "findings must be sorted desc by (level, score, confidence)"
        last_key = key


def test_guidance_refuses_jurisdictional_question(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    reviewer = _login(app_client, seeded_users["reviewer"])
    draft_id = _seed_draft(app_client, reviewer)

    viewer = _login(app_client, seeded_users["viewer"])
    r = app_client.post(
        "/api/v1/reasoning/guidance",
        json={"draft_id": draft_id, "question": "Is this enforceable under California law?"},
        headers=_bearer(viewer),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["refused"] is True
    assert body["refusal_reason"] == "jurisdiction_specific"
    assert body["not_legal_advice"] is True


def test_guidance_general_question_returns_answer(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    reviewer = _login(app_client, seeded_users["reviewer"])
    draft_id = _seed_draft(app_client, reviewer)

    viewer = _login(app_client, seeded_users["viewer"])
    r = app_client.post(
        "/api/v1/reasoning/guidance",
        json={"draft_id": draft_id, "question": "What should I push back on first?"},
        headers=_bearer(viewer),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["refused"] is False
    assert body["answer"]
    assert body["not_legal_advice"] is True


def test_metrics_endpoint_exposes_counters(app_client: TestClient) -> None:
    r = app_client.get("/metrics")
    assert r.status_code == 200
    text = r.text
    assert "clarifyd_reasoning_calls_total" in text
    assert "clarifyd_llm_calls_total" in text
