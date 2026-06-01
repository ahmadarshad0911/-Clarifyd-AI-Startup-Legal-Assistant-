from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.config import Settings, get_settings
from app.contracts.api import (
    API_CONTRACT_VERSION,
    ExportReportRequest,
    ExportReportResponse,
    ExportStatus,
)
from app.db.models import ContractDraft, ExportJob
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.services.audit import append_audit_event
from app.services.export import finalize_export_job, is_pdf_supported

router = APIRouter(tags=["exports"])


async def _owned_export_job(
    session: AsyncSession, export_id: str, user_id: str
) -> ExportJob:
    """Fetch an export job ONLY if its draft belongs to the caller. Prevents
    cross-tenant export access (IDOR) — ids are non-enumerable but still leak
    via audit/exports, so ownership must be enforced server-side."""
    job = (
        await session.execute(select(ExportJob).where(ExportJob.id == export_id))
    ).scalar_one_or_none()
    if job is not None:
        owns = (
            await session.execute(
                select(ContractDraft.id).where(
                    ContractDraft.id == job.draft_id,
                    ContractDraft.owner_id == user_id,
                )
            )
        ).scalar_one_or_none()
        if owns is None:
            job = None
    if job is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Export not found.",
            status_code=404,
        )
    return job


class ExportStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contract_version: str = API_CONTRACT_VERSION
    export_id: str
    draft_id: str
    format: Literal["pdf", "json"]
    status: ExportStatus
    file_path: str | None
    error_message: str | None


@router.post("/exports", response_model=ExportReportResponse)
async def create_export(
    body: ExportReportRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
    user: AuthenticatedUser = Depends(require_role("reviewer")),
) -> ExportReportResponse:
    if body.format == "pdf" and not is_pdf_supported():
        raise AppError(
            code=ErrorCode.policy_violation,
            message="PDF generation is disabled on this server.",
            status_code=422,
        )

    draft = (
        await session.execute(
            select(ContractDraft).where(
                ContractDraft.id == body.draft_id,
                ContractDraft.owner_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if draft is None or draft.deleted_at is not None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Draft not found.",
            status_code=404,
        )

    job = ExportJob(draft_id=body.draft_id, format=body.format, status="queued")
    session.add(job)
    await session.flush()

    await append_audit_event(
        session,
        action="export.queued",
        target_type="export_job",
        target_id=job.id,
        actor_id=user.id,
        payload={"draft_id": body.draft_id, "format": body.format},
    )
    await session.commit()

    target_dir = Path(settings.export_dir).resolve()
    background_tasks.add_task(
        finalize_export_job,
        export_id=job.id,
        draft_id=body.draft_id,
        fmt=body.format,
        target_dir=target_dir,
    )

    return ExportReportResponse(
        draft_id=body.draft_id,
        export_id=job.id,
        format=body.format,
        status=ExportStatus.queued,
    )


@router.get("/exports/{export_id}", response_model=ExportStatusResponse)
async def get_export_status(
    export_id: str,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> ExportStatusResponse:
    job = await _owned_export_job(session, export_id, user.id)
    return ExportStatusResponse(
        export_id=job.id,
        draft_id=job.draft_id,
        format=job.format,  # type: ignore[arg-type]
        status=ExportStatus(job.status),
        file_path=job.file_path,
        error_message=job.error_message,
    )


@router.get("/exports/{export_id}/download")
async def download_export(
    export_id: str,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> FileResponse:
    job = await _owned_export_job(session, export_id, user.id)
    if job.status != "ready" or not job.file_path:
        raise AppError(
            code=ErrorCode.policy_violation,
            message=f"Export is not ready (status={job.status}).",
            status_code=409,
        )

    # Block path-traversal: file must live under configured export_dir.
    target_dir = Path(settings.export_dir).resolve()
    file_path = Path(job.file_path).resolve()
    try:
        file_path.relative_to(target_dir)
    except ValueError as exc:
        raise AppError(
            code=ErrorCode.policy_violation,
            message="Export path is outside allowed directory.",
            status_code=403,
        ) from exc
    if not file_path.is_file():
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Export file is missing on disk.",
            status_code=410,
        )

    media_type = "application/json" if job.format == "json" else "application/pdf"
    await append_audit_event(
        session,
        action="export.downloaded",
        target_type="export_job",
        target_id=job.id,
        actor_id=user.id,
        payload={"draft_id": job.draft_id, "format": job.format},
    )
    await session.commit()
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=file_path.name,
    )
