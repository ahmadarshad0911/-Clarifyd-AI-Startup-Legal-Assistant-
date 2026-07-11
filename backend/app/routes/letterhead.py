from __future__ import annotations

import re
from datetime import datetime

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.db.models import UserLetterhead
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.services.letterhead import (
    MAX_LETTERHEAD_BYTES,
    render_on_letterhead,
    validate_letterhead,
)

router = APIRouter(prefix="/api/v1", tags=["letterhead"])

_MAX_CONTENT_SLACK = 4096


class LetterheadStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    has_letterhead: bool
    file_name: str | None = None
    kind: str | None = None
    uploaded_at: datetime | None = None


class RenderDocumentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(default="", max_length=200)
    content: str = Field(min_length=1, max_length=200_000)


async def _get_letterhead(session: AsyncSession, user_id: str) -> UserLetterhead | None:
    return (
        await session.execute(
            select(UserLetterhead).where(UserLetterhead.user_id == user_id)
        )
    ).scalar_one_or_none()


@router.get("/letterhead", response_model=LetterheadStatusResponse)
async def get_letterhead_status(
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> LetterheadStatusResponse:
    row = await _get_letterhead(session, user.id)
    if row is None:
        return LetterheadStatusResponse(has_letterhead=False)
    return LetterheadStatusResponse(
        has_letterhead=True,
        file_name=row.file_name,
        kind=row.kind,
        uploaded_at=row.uploaded_at,
    )


@router.post("/letterhead", response_model=LetterheadStatusResponse)
async def upload_letterhead(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> LetterheadStatusResponse:
    if not file.filename:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Missing file name.",
            status_code=422,
        )
    payload = await file.read()
    if len(payload) > MAX_LETTERHEAD_BYTES + _MAX_CONTENT_SLACK:
        mb = MAX_LETTERHEAD_BYTES // (1024 * 1024)
        raise AppError(
            code=ErrorCode.upload_rejected,
            message=f"The letterhead must be under {mb}MB.",
            status_code=413,
        )
    try:
        meta = await run_in_threadpool(validate_letterhead, file.filename, payload)
    except ValueError as exc:
        raise AppError(
            code=ErrorCode.upload_rejected,
            message=str(exc),
            status_code=422,
        ) from exc

    row = await _get_letterhead(session, user.id)
    if row is None:
        row = UserLetterhead(user_id=user.id)
        session.add(row)
    row.file_name = file.filename[:255]
    row.mime = meta.mime
    row.kind = meta.kind
    row.size_bytes = len(payload)
    row.content = payload
    await session.commit()

    return LetterheadStatusResponse(
        has_letterhead=True,
        file_name=row.file_name,
        kind=row.kind,
        uploaded_at=row.uploaded_at,
    )


@router.delete("/letterhead", status_code=204, response_class=Response)
async def delete_letterhead(
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> Response:
    row = await _get_letterhead(session, user.id)
    if row is not None:
        await session.delete(row)
        await session.commit()
    return Response(status_code=204)


def _safe_filename(title: str, ext: str) -> str:
    base = re.sub(r"[^A-Za-z0-9 _-]+", "", title).strip().replace(" ", "-")
    return f"{(base or 'document')[:60]}.{ext}"


@router.post("/documents/render")
async def render_document_on_letterhead(
    body: RenderDocumentRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> Response:
    row = await _get_letterhead(session, user.id)
    if row is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="No letterhead on file. Upload an A4 letterhead first, then "
            "generate the document on it.",
            status_code=422,
        )
    try:
        data, mime, ext = await run_in_threadpool(
            render_on_letterhead, row.kind, row.content, body.title, body.content
        )
    except ValueError as exc:
        raise AppError(
            code=ErrorCode.internal_error,
            message=str(exc),
            status_code=422,
        ) from exc

    filename = _safe_filename(body.title, ext)
    return Response(
        content=data,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
