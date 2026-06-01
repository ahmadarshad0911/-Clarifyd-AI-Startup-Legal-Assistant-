"""Contract Comparison & Benchmarking — PRD §4.7."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.contracts.api import ClauseVariance, CompareRequest, CompareResponse, RiskLevel
from app.db.models import ClauseFinding, ContractDraft
from app.db.session import get_session
from app.errors import AppError, ErrorCode

router = APIRouter(prefix="/api/v1/compare", tags=["compare"])


@router.post("", response_model=CompareResponse)
async def compare(
    body: CompareRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> CompareResponse:
    drafts = list(
        (
            await session.execute(
                select(ContractDraft).where(
                    ContractDraft.id.in_(body.draft_ids),
                    ContractDraft.owner_id == user.id,
                    ContractDraft.deleted_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    if len(drafts) != len(set(body.draft_ids)):
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="One or more drafts not found.",
            status_code=404,
        )

    findings_by_draft: dict[str, list[ClauseFinding]] = {}
    for draft_id in body.draft_ids:
        rows = list(
            (
                await session.execute(
                    select(ClauseFinding).where(ClauseFinding.draft_id == draft_id)
                )
            )
            .scalars()
            .all()
        )
        findings_by_draft[draft_id] = rows

    _RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    clause_names = sorted(
        {f.clause_name for rows in findings_by_draft.values() for f in rows}
    )

    variances: list[ClauseVariance] = []
    for clause_name in clause_names:
        present_in: list[str] = []
        risk_levels: dict[str, RiskLevel] = {}
        for draft_id, rows in findings_by_draft.items():
            match = next((f for f in rows if f.clause_name == clause_name), None)
            if match is not None:
                present_in.append(draft_id)
                risk_levels[draft_id] = RiskLevel(match.risk_level)
        variances.append(
            ClauseVariance(
                clause_name=clause_name,
                present_in=present_in,
                risk_levels=risk_levels,
            )
        )
    variances.sort(
        key=lambda v: (
            -len(set(v.risk_levels.values())),
            -max((_RANK[lvl.value] for lvl in v.risk_levels.values()), default=0),
        )
    )
    return CompareResponse(draft_ids=list(body.draft_ids), variances=variances)
