from __future__ import annotations

import io

import pytest

from app.config import Settings
from app.services.contract_ingestion import (
    ContractIngestionService,
    canonicalize_filename,
    sniff_mime,
)


def _service(max_size: int = 1024) -> ContractIngestionService:
    return ContractIngestionService(
        Settings(allowed_file_types=".pdf,.docx", max_upload_file_size=max_size)
    )


def test_canonicalize_strips_path_components() -> None:
    assert canonicalize_filename("../etc/passwd.pdf") == "passwd.pdf"
    assert canonicalize_filename("..\\..\\boot.docx") == "boot.docx"
    assert canonicalize_filename("/abs/path/x.pdf") == "x.pdf"


def test_canonicalize_replaces_unsafe_chars() -> None:
    assert canonicalize_filename("My File (v2).pdf") == "My_File__v2_.pdf"


def test_canonicalize_rejects_empty_or_dot() -> None:
    with pytest.raises(ValueError):
        canonicalize_filename("")
    with pytest.raises(ValueError):
        canonicalize_filename("..")


def test_sniff_mime_pdf_match_and_mismatch() -> None:
    assert sniff_mime(".pdf", b"%PDF-1.7\n") == "application/pdf"
    assert sniff_mime(".pdf", b"PK\x03\x04not-a-pdf") is None


def test_sniff_mime_docx_match_and_mismatch() -> None:
    assert sniff_mime(".docx", b"PK\x03\x04zipped\x00") is not None
    assert sniff_mime(".docx", b"%PDF-disguised") is None


def test_sniff_mime_unknown_extension() -> None:
    assert sniff_mime(".exe", b"MZ\x90\x00") is None


def test_inspect_upload_happy_pdf() -> None:
    service = _service()
    payload = b"%PDF-1.7\n%fake-but-magic-ok\n"
    result = service.inspect_upload("good.pdf", payload)
    assert result.canonical_name == "good.pdf"
    assert result.extension == ".pdf"
    assert result.mime == "application/pdf"
    assert result.size_bytes == len(payload)
    assert len(result.sha256) == 64


def test_inspect_upload_rejects_extension_mismatch() -> None:
    service = _service()
    with pytest.raises(ValueError, match="content does not match"):
        service.inspect_upload("evil.pdf", b"PK\x03\x04zipped")


def test_inspect_upload_rejects_unsupported_extension() -> None:
    service = _service()
    with pytest.raises(ValueError, match="Unsupported file type"):
        service.inspect_upload("malware.exe", b"MZ\x90\x00")


def test_inspect_upload_rejects_zero_byte() -> None:
    service = _service()
    with pytest.raises(ValueError, match="must be greater than zero"):
        service.inspect_upload("empty.pdf", b"")


def test_inspect_upload_rejects_oversize() -> None:
    service = _service(max_size=8)
    with pytest.raises(ValueError, match="upload limit"):
        service.inspect_upload("big.pdf", b"%PDF-1.7\nlots-of-bytes-after-header")


def test_inspect_upload_canonicalizes_traversal() -> None:
    service = _service()
    result = service.inspect_upload("../../etc/spec.pdf", b"%PDF-1.7\n")
    assert result.canonical_name == "spec.pdf"


def test_hash_stream_caps_size() -> None:
    service = _service(max_size=16)
    stream = io.BytesIO(b"%PDF-1.7\n" + b"A" * 64)
    with pytest.raises(ValueError, match="upload limit"):
        service.hash_stream(stream)


def test_hash_stream_returns_hash_size_head() -> None:
    service = _service(max_size=1024)
    payload = b"%PDF-1.7\nhello"
    sha, size, head = service.hash_stream(io.BytesIO(payload))
    assert size == len(payload)
    assert head.startswith(b"%PDF-")
    assert len(sha) == 64
