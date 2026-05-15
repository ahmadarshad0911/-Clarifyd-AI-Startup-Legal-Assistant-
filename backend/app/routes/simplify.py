"""Simplification & Explanation — PRD §4.5."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.contracts.api import SimplifiedClause, SimplifyResponse
from app.db.models import ClauseFinding, ContractDraft
from app.db.session import get_session
from app.errors import AppError, ErrorCode

router = APIRouter(prefix="/api/v1/simplify", tags=["simplify"])


_LEGALESE = re.compile(
    r"\b(heretofore|hereinafter|notwithstanding|whereas|aforementioned|"
    r"pursuant to|in witness whereof|indemnification)\b",
    re.IGNORECASE,
)


def _simplify_text(text: str) -> str:
    cleaned = _LEGALESE.sub(lambda m: m.group(0).lower(), text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:500] + ("…" if len(cleaned) > 500 else "")


def _key_terms(text: str) -> list[str]:
    terms = set(_LEGALESE.findall(text))
    return sorted({t.lower() for t in terms})


@router.get("/{draft_id}", response_model=SimplifyResponse)
async def simplify(
    draft_id: str = Path(..., min_length=1),
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> SimplifyResponse:
    draft = (
        await session.execute(
            select(ContractDraft).where(
                ContractDraft.id == draft_id,
                ContractDraft.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if draft is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Draft not found.",
            status_code=404,
        )
    findings = list(
        (
            await session.execute(
                select(ClauseFinding).where(ClauseFinding.draft_id == draft.id)
            )
        )
        .scalars()
        .all()
    )
    simplified = [
        SimplifiedClause(
            finding_id=f.finding_id,
            clause_name=f.clause_name,
            plain_english=_simplify_text(f.excerpt),
            key_terms=_key_terms(f.excerpt),
        )
        for f in findings
    ]
    return SimplifyResponse(draft_id=draft.id, clauses=simplified)
