"""Read-side endpoint for previously-stored analyses.

The /analyze* routes persist the full `AnalyzeContractResponse` JSON onto
`ContractDraft.analysis_json` so the Findings tab can rehydrate without
relying on per-origin browser localStorage. This module exposes them.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.db.models import ContractDraft
from app.db.session import get_session
from app.errors import AppError, ErrorCode


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/analyses", tags=["analyses"])


class StoredAnalysisItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    draft_id: str
    file_name: str
    analyzed_at: str
    # ISO timestamp set when the user accepted a suggestion or generated
    # a collaborator doc in /negotiate. NULL = still in Findings bucket.
    negotiated_at: str | None = None
    # `analysis` matches the AnalyzeContractResponse shape on the wire
    # without re-declaring it here — frontend already has the type.
    analysis: dict


class MarkNegotiatedResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    draft_id: str
    negotiated_at: str


class StoredAnalysesResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[StoredAnalysisItem]


@router.get("", response_model=StoredAnalysesResponse)
async def list_analyses(
    user: AuthenticatedUser = Depends(require_role("reviewer")),
    session: AsyncSession = Depends(get_session),
) -> StoredAnalysesResponse:
    """Return every persisted analysis belonging to the caller, newest first.

    Skips drafts whose `analysis_json` is NULL (older rows from before the
    column existed) and drafts that are soft-deleted.
    """
    rows = (
        await session.execute(
            select(ContractDraft)
            .where(ContractDraft.owner_id == user.id)
            .where(ContractDraft.deleted_at.is_(None))
            .where(ContractDraft.analysis_json.is_not(None))
            .order_by(ContractDraft.uploaded_at.desc())
            .limit(50)
        )
    ).scalars().all()

    items: list[StoredAnalysisItem] = []
    for r in rows:
        try:
            payload = json.loads(r.analysis_json or "{}")
        except ValueError:
            logger.warning("Bad analysis_json for draft %s", r.id)
            continue
        items.append(
            StoredAnalysisItem(
                draft_id=r.id,
                file_name=r.file_name,
                analyzed_at=r.uploaded_at.isoformat(),
                negotiated_at=r.negotiated_at.isoformat() if r.negotiated_at else None,
                analysis=payload,
            )
        )
    return StoredAnalysesResponse(items=items)


@router.post("/{draft_id}/negotiate", response_model=MarkNegotiatedResponse)
async def mark_negotiated(
    draft_id: str,
    user: AuthenticatedUser = Depends(require_role("reviewer")),
    session: AsyncSession = Depends(get_session),
) -> MarkNegotiatedResponse:
    """Flag a draft as actively negotiated.

    Idempotent: only sets `negotiated_at` the first time. Subsequent calls
    return the original timestamp so the UI doesn't reshuffle if the user
    re-toggles suggestions.
    """
    row = (
        await session.execute(
            select(ContractDraft)
            .where(ContractDraft.id == draft_id)
            .where(ContractDraft.owner_id == user.id)
            .where(ContractDraft.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if row is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Draft not found.",
            status_code=404,
        )
    if row.negotiated_at is None:
        row.negotiated_at = datetime.now(timezone.utc)
        await session.commit()
        logger.info("draft %s marked negotiated by %s", draft_id, user.id)
    return MarkNegotiatedResponse(
        draft_id=row.id,
        negotiated_at=row.negotiated_at.isoformat(),
    )


class RegenerateReportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    draft_id: str
    report_generated: bool


@router.post("/{draft_id}/regenerate-report", response_model=RegenerateReportResponse)
async def regenerate_report(
    draft_id: str,
    user: AuthenticatedUser = Depends(require_role("reviewer")),
    session: AsyncSession = Depends(get_session),
) -> RegenerateReportResponse:
    """Re-run ContractReporter for a draft whose report was null (e.g. API key was missing at analysis time).

    Updates analysis_json in-place with the new report. No-ops if reporter is unconfigured.
    """
    from app.main import get_contract_reporter  # avoid circular at import time

    row = (
        await session.execute(
            select(ContractDraft)
            .where(ContractDraft.id == draft_id)
            .where(ContractDraft.owner_id == user.id)
            .where(ContractDraft.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if row is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Draft not found.",
            status_code=404,
        )

    try:
        payload = json.loads(row.analysis_json or "{}")
    except ValueError:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Stored analysis is corrupt.",
            status_code=500,
        )

    contract_text: str = payload.get("extracted_text") or ""
    if not contract_text.strip():
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="No contract text available for this draft.",
            status_code=422,
        )

    reporter = get_contract_reporter()
    if reporter is None:
        return RegenerateReportResponse(draft_id=draft_id, report_generated=False)

    report = await reporter.generate(contract_text, session=session)
    if report is None:
        logger.warning("regenerate_report: reporter returned None for draft %s", draft_id)
        return RegenerateReportResponse(draft_id=draft_id, report_generated=False)

    payload["report"] = json.loads(report.model_dump_json())
    row.analysis_json = json.dumps(payload)
    await session.commit()
    logger.info("regenerate_report: report updated for draft %s", draft_id)
    return RegenerateReportResponse(draft_id=draft_id, report_generated=True)
