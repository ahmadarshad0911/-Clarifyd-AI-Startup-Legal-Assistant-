from __future__ import annotations

import io
import zipfile

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


def test_analyze_url_rejects_link_local_metadata_host(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    r = app_client.post(
        "/analyze/url",
        headers=_bearer(token),
        json={"url": "http://169.254.169.254/latest/meta-data/"},
    )
    assert r.status_code == 422


def test_analyze_url_rejects_localhost(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    token = _login(app_client, seeded_users["reviewer"])
    r = app_client.post(
        "/analyze/url",
        headers=_bearer(token),
        json={"url": "http://localhost:8000/health"},
    )
    assert r.status_code == 422


def test_export_not_downloadable_by_other_user(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    owner = _login(app_client, seeded_users["reviewer"])
    other = _login(app_client, seeded_users["admin"])

    draft_id = _upload(app_client, owner)
    created = app_client.post(
        "/exports", headers=_bearer(owner), json={"draft_id": draft_id, "format": "json"}
    )
    assert created.status_code == 200
    export_id = created.json()["export_id"]

    # A different account must not see another tenant's export job (IDOR).
    status = app_client.get(f"/exports/{export_id}", headers=_bearer(other))
    assert status.status_code == 404


def test_create_export_rejects_other_users_draft(
    app_client: TestClient, seeded_users: dict[str, dict[str, str]]
) -> None:
    owner = _login(app_client, seeded_users["reviewer"])
    other = _login(app_client, seeded_users["admin"])

    draft_id = _upload(app_client, owner)
    # Another account must not be able to export a draft it doesn't own.
    r = app_client.post(
        "/exports", headers=_bearer(other), json={"draft_id": draft_id, "format": "json"}
    )
    assert r.status_code == 404
