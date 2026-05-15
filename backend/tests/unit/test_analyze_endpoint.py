from __future__ import annotations

import asyncio
import io
import zipfile
from typing import Any

import pytest
from fastapi.testclient import TestClient


def _docx_bytes(text: str = "This contract has unlimited liability for the provider.") -> bytes:
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
    r = client.post(
        "/auth/login",
        json={"email": creds["email"], "password": creds["password"]},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_analyze_requires_auth(app_client: TestClient) -> None:
    response = app_client.post(
        "/analyze/contract",
        files={"file": ("contract.docx", _docx_bytes(), "application/octet-stream")},
    )
    assert response.status_code == 401


def test_analyze_rejects_missing_filename(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    response = app_client.post(
        "/analyze/contract",
        files={"file": ("", b"%PDF-1.7\n", "application/pdf")},
        headers=_bearer(token),
    )
    assert response.status_code == 422


def test_analyze_rejects_extension_content_mismatch(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    response = app_client.post(
        "/analyze/contract",
        files={"file": ("evil.pdf", b"PK\x03\x04not-a-pdf", "application/pdf")},
        headers=_bearer(token),
    )
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "upload_rejected"
    assert "content does not match" in body["message"]


def test_analyze_rejects_unsupported_extension(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    response = app_client.post(
        "/analyze/contract",
        files={"file": ("malware.exe", b"MZ\x90\x00", "application/octet-stream")},
        headers=_bearer(token),
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "upload_rejected"


def test_analyze_persists_draft_findings_and_audit(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    payload = _docx_bytes()
    response = app_client.post(
        "/analyze/contract",
        files={"file": ("contract.docx", payload, "application/octet-stream")},
        headers=_bearer(token),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ready_for_processing"
    assert body["summary"]["findings_count"] >= 1

    from sqlalchemy import select

    from app.db.engine import get_sessionmaker
    from app.db.models import AuditEvent, ClauseFinding, ContractDraft
    from app.services.audit import verify_audit_chain

    async def _check() -> None:
        async with get_sessionmaker()() as session:
            drafts = (await session.execute(select(ContractDraft))).scalars().all()
            findings = (await session.execute(select(ClauseFinding))).scalars().all()
            events = (
                (await session.execute(select(AuditEvent).order_by(AuditEvent.id))).scalars().all()
            )
            assert len(drafts) == 1
            assert len(findings) >= 1
            assert any(e.action == "upload.created" for e in events)
            assert drafts[0].owner_id == seeded_users["reviewer"]["id"]
            assert await verify_audit_chain(session) is None

    asyncio.run(_check())


def test_analyze_dedupes_by_sha256(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    payload = _docx_bytes()
    files = {"file": ("contract.docx", payload, "application/octet-stream")}
    r1 = app_client.post("/analyze/contract", files=files, headers=_bearer(token))
    r2 = app_client.post(
        "/analyze/contract",
        files={"file": ("contract.docx", payload, "application/octet-stream")},
        headers=_bearer(token),
    )
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["draft_id"] == r2.json()["draft_id"]


def test_analyze_viewer_role_denied(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["viewer"])
    r = app_client.post(
        "/analyze/contract",
        files={"file": ("contract.docx", _docx_bytes(), "application/octet-stream")},
        headers=_bearer(token),
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "policy_violation"
