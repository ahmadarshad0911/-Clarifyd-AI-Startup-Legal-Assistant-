from __future__ import annotations

import io
import zipfile
from typing import Any

import pytest
from fastapi.testclient import TestClient


def _docx_bytes(text: str) -> bytes:
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("word/document.xml", document_xml)
    return buf.getvalue()


def _login(client: TestClient, creds: dict[str, str]) -> str:
    r = client.post("/auth/login", json={"email": creds["email"], "password": creds["password"]})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


CRITICAL_TEXT = (
    "The provider accepts unlimited liability for all damages. "
    "Termination requires 30 days notice. "
    "Confidential information must not be disclosed."
)


def _upload(client: TestClient, token: str, payload: bytes) -> dict[str, Any]:
    r = client.post(
        "/analyze/contract",
        files={"file": ("contract.docx", payload, "application/octet-stream")},
        headers=_bearer(token),
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_analyze_auto_routes_high_risk_findings(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    _upload(app_client, token, _docx_bytes(CRITICAL_TEXT))

    r = app_client.get("/reviews?state=pending", headers=_bearer(token))
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) >= 1
    assert all(it["state"] == "pending" for it in items)
    # At least one critical/high item must be present.
    assert any(it["risk_level"] in {"critical", "high"} for it in items)


def test_reviews_require_reviewer_role(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    viewer_token = _login(app_client, seeded_users["viewer"])
    r = app_client.get("/reviews", headers=_bearer(viewer_token))
    assert r.status_code == 403


def test_claim_then_decide_full_lifecycle(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    _upload(app_client, token, _docx_bytes(CRITICAL_TEXT))

    items = app_client.get("/reviews?state=pending", headers=_bearer(token)).json()["items"]
    assert items, "expected pending review items"
    item = items[0]

    claim = app_client.post(f"/reviews/{item['id']}/claim", headers=_bearer(token))
    assert claim.status_code == 200
    body = claim.json()
    assert body["state"] == "in_review"
    assert body["assignee_id"] == seeded_users["reviewer"]["id"]

    decide = app_client.post(
        f"/reviews/{item['id']}/decide",
        headers=_bearer(token),
        json={
            "draft_id": item["draft_id"],
            "finding_id": item["finding_id"],
            "decision": "accept",
            "reviewer_note": "looks fine",
        },
    )
    assert decide.status_code == 200, decide.text
    decided = decide.json()
    assert decided["recorded"] is True
    assert decided["not_legal_advice"] is True
    assert decided["decision"] == "accept"

    # Item now resolved + ReviewAction row + audit chain still valid.
    import asyncio

    from sqlalchemy import select

    from app.db.engine import get_sessionmaker
    from app.db.models import AuditEvent, ReviewAction, ReviewQueueItem
    from app.services.audit import verify_audit_chain

    async def _check() -> None:
        async with get_sessionmaker()() as session:
            item_row = (
                await session.execute(
                    select(ReviewQueueItem).where(ReviewQueueItem.id == item["id"])
                )
            ).scalar_one()
            assert item_row.state == "resolved"
            assert item_row.closed_at is not None
            actions = (await session.execute(select(ReviewAction))).scalars().all()
            assert any(a.decision == "accept" and a.reviewer_note == "looks fine" for a in actions)
            audit_actions = [
                e.action
                for e in (
                    await session.execute(select(AuditEvent).order_by(AuditEvent.id))
                ).scalars()
            ]
            assert "review.claim" in audit_actions
            assert "review.decide" in audit_actions
            assert await verify_audit_chain(session) is None

    asyncio.run(_check())


def test_double_claim_returns_409(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    _upload(app_client, token, _docx_bytes(CRITICAL_TEXT))
    item = app_client.get("/reviews?state=pending", headers=_bearer(token)).json()["items"][0]

    first = app_client.post(f"/reviews/{item['id']}/claim", headers=_bearer(token))
    second = app_client.post(f"/reviews/{item['id']}/claim", headers=_bearer(token))
    assert first.status_code == 200
    assert second.status_code == 409


def test_decide_rejects_mismatched_body(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    _upload(app_client, token, _docx_bytes(CRITICAL_TEXT))
    item = app_client.get("/reviews?state=pending", headers=_bearer(token)).json()["items"][0]

    r = app_client.post(
        f"/reviews/{item['id']}/decide",
        headers=_bearer(token),
        json={
            "draft_id": "wrong-draft",
            "finding_id": item["finding_id"],
            "decision": "accept",
        },
    )
    assert r.status_code == 422


def test_decide_blocks_other_reviewer(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    reviewer_token = _login(app_client, seeded_users["reviewer"])
    admin_token = _login(app_client, seeded_users["admin"])
    _upload(app_client, reviewer_token, _docx_bytes(CRITICAL_TEXT))
    item = app_client.get("/reviews?state=pending", headers=_bearer(reviewer_token)).json()[
        "items"
    ][0]

    app_client.post(f"/reviews/{item['id']}/claim", headers=_bearer(reviewer_token))
    r = app_client.post(
        f"/reviews/{item['id']}/decide",
        headers=_bearer(admin_token),
        json={
            "draft_id": item["draft_id"],
            "finding_id": item["finding_id"],
            "decision": "escalate",
        },
    )
    assert r.status_code == 403
