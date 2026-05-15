from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import PurePosixPath, PureWindowsPath
from typing import BinaryIO

from app.config import Settings
from app.contracts.ingestion import UploadValidationResult
from app.models.contract import ContractDraft, ProcessingStatus

_FILENAME_SAFE = re.compile(r"[^A-Za-z0-9._-]")
_MAX_FILENAME_LENGTH = 255

# (extension, accepted magic-byte prefixes)
_MAGIC_BYTES: dict[str, tuple[bytes, ...]] = {
    ".pdf": (b"%PDF-",),
    ".docx": (b"PK\x03\x04",),
}

_MIME_BY_EXT: dict[str, str] = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@dataclass(frozen=True)
class HashedUpload:
    canonical_name: str
    extension: str
    mime: str
    size_bytes: int
    sha256: str


def canonicalize_filename(file_name: str) -> str:
    """Strip path components, restrict charset, cap length. Raises ValueError on empty."""
    if not file_name:
        raise ValueError("File name is required.")
    # Strip any directory parts from either separator style.
    base = PureWindowsPath(file_name).name or PurePosixPath(file_name).name
    base = base.strip()
    if not base or base in {".", ".."}:
        raise ValueError("File name is invalid.")
    cleaned = _FILENAME_SAFE.sub("_", base)
    if len(cleaned) > _MAX_FILENAME_LENGTH:
        # Preserve extension when truncating.
        suffix_idx = cleaned.rfind(".")
        if suffix_idx > 0 and len(cleaned) - suffix_idx <= 16:
            head = cleaned[: _MAX_FILENAME_LENGTH - (len(cleaned) - suffix_idx)]
            cleaned = head + cleaned[suffix_idx:]
        else:
            cleaned = cleaned[:_MAX_FILENAME_LENGTH]
    return cleaned


def sniff_mime(extension: str, head: bytes) -> str | None:
    """Return MIME if magic bytes match the extension; else None."""
    expected = _MAGIC_BYTES.get(extension)
    if not expected:
        return None
    if any(head.startswith(prefix) for prefix in expected):
        return _MIME_BY_EXT.get(extension)
    return None


class ContractIngestionService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._allowed_types = {
            ext.strip().lower()
            for ext in settings.allowed_file_types.split(",")
            if ext.strip()
        }

    @property
    def max_upload_file_size(self) -> int:
        return self._settings.max_upload_file_size

    @property
    def allowed_types(self) -> set[str]:
        return set(self._allowed_types)

    def extension_of(self, canonical_name: str) -> str:
        idx = canonical_name.rfind(".")
        return canonical_name[idx:].lower() if idx >= 0 else ""

    def validate_upload(self, file_name: str, file_size_bytes: int) -> UploadValidationResult:
        try:
            canonical = canonicalize_filename(file_name)
        except ValueError as exc:
            return UploadValidationResult(valid=False, reason=str(exc))

        extension = self.extension_of(canonical)
        if extension not in self._allowed_types:
            return UploadValidationResult(
                valid=False, reason=f"Unsupported file type: {extension or 'none'}"
            )

        if file_size_bytes <= 0:
            return UploadValidationResult(
                valid=False, reason="File size must be greater than zero"
            )

        if file_size_bytes > self._settings.max_upload_file_size:
            max_mb = self._settings.max_upload_file_size // (1024 * 1024)
            return UploadValidationResult(
                valid=False, reason=f"File exceeds {max_mb}MB upload limit"
            )

        return UploadValidationResult(valid=True)

    def hash_stream(self, stream: BinaryIO, *, chunk_size: int = 64 * 1024) -> tuple[str, int, bytes]:
        """Stream-hash a binary stream. Returns (sha256_hex, size_bytes, head_bytes).

        Raises ValueError if size exceeds configured cap (size enforced before hashing completes).
        """
        hasher = hashlib.sha256()
        total = 0
        head = b""
        cap = self._settings.max_upload_file_size
        while True:
            chunk = stream.read(chunk_size)
            if not chunk:
                break
            total += len(chunk)
            if total > cap:
                max_mb = cap // (1024 * 1024)
                raise ValueError(f"File exceeds {max_mb}MB upload limit")
            if len(head) < 16:
                head = (head + chunk)[:16]
            hasher.update(chunk)
        return hasher.hexdigest(), total, head

    def inspect_upload(self, file_name: str, payload: bytes) -> HashedUpload:
        """End-to-end validate + canonicalize + magic-byte sniff + hash for an in-memory payload.

        Raises ValueError on any rejection — caller maps to 422.
        """
        canonical = canonicalize_filename(file_name)
        extension = self.extension_of(canonical)
        if extension not in self._allowed_types:
            raise ValueError(f"Unsupported file type: {extension or 'none'}")
        size = len(payload)
        if size <= 0:
            raise ValueError("File size must be greater than zero")
        if size > self._settings.max_upload_file_size:
            max_mb = self._settings.max_upload_file_size // (1024 * 1024)
            raise ValueError(f"File exceeds {max_mb}MB upload limit")
        head = payload[:16]
        mime = sniff_mime(extension, head)
        if mime is None:
            raise ValueError(
                f"File content does not match declared type {extension}"
            )
        sha = hashlib.sha256(payload).hexdigest()
        return HashedUpload(
            canonical_name=canonical,
            extension=extension,
            mime=mime,
            size_bytes=size,
            sha256=sha,
        )

    def create_draft(self, file_name: str, file_size_bytes: int) -> ContractDraft:
        validation = self.validate_upload(file_name, file_size_bytes)
        if not validation.valid:
            raise ValueError(validation.reason)
        canonical = canonicalize_filename(file_name)
        return ContractDraft(
            file_name=canonical,
            file_size_bytes=file_size_bytes,
            status=ProcessingStatus.ready_for_processing,
        )
