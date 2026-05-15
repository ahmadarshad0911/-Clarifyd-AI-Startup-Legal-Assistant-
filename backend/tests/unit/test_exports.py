from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def _docx_bytes(text: str = "Provider has unlimited liability for all damages.") -> bytes:
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


def _bearer(t: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {t}"}


def _upload(client: TestClient, token: str) -> str:
    r = client.post(
        "/analyze/contract",
        files={"file": ("contract.docx", _docx_bytes(), "application/octet-stream")},
        headers=_bearer(token),
    )
    assert r.status_code == 200, r.text
    return r.json()["draft_id"]


def test_export_json_full_lifecycle(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    draft_id = _upload(app_client, token)

    create = app_client.post(
        "/exports",
        headers=_bearer(token),
        json={"draft_id": draft_id, "format": "json"},
    )
    assert create.status_code == 200
    body = create.json()
    assert body["status"] == "queued"
    export_id = body["export_id"]

    status = app_client.get(f"/exports/{export_id}", headers=_bearer(token))
    assert status.status_code == 200
    assert status.json()["status"] in {"ready", "queued"}

    # BackgroundTasks runs synchronously inside TestClient, so file is ready now.
    download = app_client.get(f"/exports/{export_id}/download", headers=_bearer(token))
    assert download.status_code == 200, download.text
    payload = json.loads(download.content)
    assert payload["draft"]["id"] == draft_id
    assert payload["audit_chain_intact"] is True
    assert payload["not_legal_advice"] is True
    assert isinstance(payload["findings"], list) and len(payload["findings"]) >= 1
    assert isinstance(payload["audit_trail"], list)


def test_export_pdf_when_supported(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    from app.services.export import is_pdf_supported

    if not is_pdf_supported():
        pytest.skip("reportlab not available")

    token = _login(app_client, seeded_users["reviewer"])
    draft_id = _upload(app_client, token)

    r = app_client.post(
        "/exports",
        headers=_bearer(token),
        json={"draft_id": draft_id, "format": "pdf"},
    )
    assert r.status_code == 200
    export_id = r.json()["export_id"]
    download = app_client.get(f"/exports/{export_id}/download", headers=_bearer(token))
    assert download.status_code == 200
    assert download.content.startswith(b"%PDF-")
    assert len(download.content) > 500


def test_export_create_requires_reviewer(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    reviewer_token = _login(app_client, seeded_users["reviewer"])
    draft_id = _upload(app_client, reviewer_token)

    viewer_token = _login(app_client, seeded_users["viewer"])
    r = app_client.post(
        "/exports",
        headers=_bearer(viewer_token),
        json={"draft_id": draft_id, "format": "json"},
    )
    assert r.status_code == 403


def test_viewer_can_download_existing_export(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    reviewer_token = _login(app_client, seeded_users["reviewer"])
    draft_id = _upload(app_client, reviewer_token)
    export_id = app_client.post(
        "/exports",
        headers=_bearer(reviewer_token),
        json={"draft_id": draft_id, "format": "json"},
    ).json()["export_id"]

    viewer_token = _login(app_client, seeded_users["viewer"])
    r = app_client.get(f"/exports/{export_id}/download", headers=_bearer(viewer_token))
    assert r.status_code == 200


def test_export_unknown_draft_404(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    r = app_client.post(
        "/exports",
        headers=_bearer(token),
        json={"draft_id": "no-such-draft", "format": "json"},
    )
    assert r.status_code == 404


def test_audit_verify_endpoint_admin_only(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    reviewer_token = _login(app_client, seeded_users["reviewer"])
    r1 = app_client.get("/audit/verify", headers=_bearer(reviewer_token))
    assert r1.status_code == 403

    admin_token = _login(app_client, seeded_users["admin"])
    r2 = app_client.get("/audit/verify", headers=_bearer(admin_token))
    assert r2.status_code == 200
    assert r2.json()["intact"] is True


def test_audit_verify_detects_tamper(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    reviewer_token = _login(app_client, seeded_users["reviewer"])
    _upload(app_client, reviewer_token)

    import asyncio

    from sqlalchemy import select

    from app.db.engine import get_sessionmaker
    from app.db.models import AuditEvent

    async def _tamper() -> None:
        async with get_sessionmaker()() as session:
            row = (
                await session.execute(select(AuditEvent).order_by(AuditEvent.id))
            ).scalar()
            assert row is not None
            row.payload_json = '{"tampered": true}'
            await session.commit()

    asyncio.run(_tamper())

    admin_token = _login(app_client, seeded_users["admin"])
    r = app_client.get("/audit/verify", headers=_bearer(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert body["intact"] is False
    assert body["first_break_id"] is not None


def test_soft_delete_owner_then_dedup_ignores_deleted(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    draft_id_1 = _upload(app_client, token)

    delete = app_client.delete(f"/drafts/{draft_id_1}", headers=_bearer(token))
    assert delete.status_code == 200
    assert delete.json()["draft_id"] == draft_id_1

    # Re-uploading the same payload must yield a NEW draft (deleted one is ignored).
    new_draft_id = _upload(app_client, token)
    assert new_draft_id != draft_id_1


def test_soft_delete_blocks_other_user(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    reviewer_token = _login(app_client, seeded_users["reviewer"])
    draft_id = _upload(app_client, reviewer_token)

    # A different reviewer cannot delete someone else's draft.
    # Seed an extra reviewer-role account by manipulating DB directly.
    import asyncio

    from app.auth.password import hash_password
    from app.db.engine import get_sessionmaker
    from app.db.models import User

    async def _add_user() -> str:
        async with get_sessionmaker()() as session:
            other = User(
                email="other-reviewer@example.com",
                hashed_password=hash_password("other-pass-1234"),
                role="reviewer",
            )
            session.add(other)
            await session.commit()
            return other.id

    asyncio.run(_add_user())
    other_token = _login(
        app_client,
        {"email": "other-reviewer@example.com", "password": "other-pass-1234"},
    )
    r = app_client.delete(f"/drafts/{draft_id}", headers=_bearer(other_token))
    assert r.status_code == 403
