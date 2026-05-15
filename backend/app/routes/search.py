"""Full-text Search — PRD §4.9 (SQL LIKE; Elasticsearch out of SLC scope)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.contracts.api import RiskLevel, SearchHit, SearchResponse
from app.db.models import ClauseFinding, ContractDraft
from app.db.session import get_session
from app.errors import AppError, ErrorCode

router = APIRouter(prefix="/api/v1/search", tags=["search"])


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    risk: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> SearchResponse:
    needle = f"%{q.strip()}%"
    stmt = (
        select(ClauseFinding, ContractDraft)
        .join(ContractDraft, ContractDraft.id == ClauseFinding.draft_id)
        .where(ContractDraft.deleted_at.is_(None))
        .where(
            or_(
                ClauseFinding.excerpt.ilike(needle),
                ClauseFinding.clause_name.ilike(needle),
                ClauseFinding.explanation.ilike(needle),
            )
        )
        .limit(limit)
    )
    if risk:
        if risk.lower() not in {"low", "medium", "high", "critical"}:
            raise AppError(
                code=ErrorCode.request_validation_error,
                message="Invalid risk filter.",
                status_code=422,
            )
        stmt = stmt.where(ClauseFinding.risk_level == risk.lower())

    rows = (await session.execute(stmt)).all()
    hits = [
        SearchHit(
            draft_id=draft.id,
            finding_id=finding.finding_id,
            clause_name=finding.clause_name,
            excerpt=finding.excerpt[:300],
            risk_level=RiskLevel(finding.risk_level),
        )
        for finding, draft in rows
    ]
    return SearchResponse(query=q, hits=hits)
