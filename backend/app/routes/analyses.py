"""Read-side endpoint for previously-stored analyses.

The /analyze* routes persist the full `AnalyzeContractResponse` JSON onto
`ContractDraft.analysis_json` so the Findings tab can rehydrate without
relying on per-origin browser localStorage. This module exposes them.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.db.models import ContractDraft
from app.db.session import get_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/analyses", tags=["analyses"])


class StoredAnalysisItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    draft_id: str
    file_name: str
    analyzed_at: str
    # `analysis` matches the AnalyzeContractResponse shape on the wire
    # without re-declaring it here — frontend already has the type.
    analysis: dict


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
                analysis=payload,
            )
        )
    return StoredAnalysesResponse(items=items)
