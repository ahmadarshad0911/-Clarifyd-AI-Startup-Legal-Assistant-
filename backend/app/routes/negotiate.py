"""Negotiation Recommendations — PRD §4.6."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.contracts.api import (
    NegotiateRequest,
    NegotiateResponse,
    NegotiationSuggestion,
    RiskLevel,
)
from app.db.models import ClauseFinding, ContractDraft
from app.db.session import get_session
from app.errors import AppError, ErrorCode

router = APIRouter(prefix="/api/v1/negotiate", tags=["negotiate"])


_TEMPLATES: dict[str, dict[str, str]] = {
    "liability": {
        "counter": "Cap each party's aggregate liability at fees paid in the prior 12 months. "
                   "Carve out indemnity, IP infringement, and confidentiality breaches.",
        "fallback": "Mutual cap at 24 months of fees with the same carve-outs.",
    },
    "indemnity": {
        "counter": "Make indemnity mutual; limit to third-party claims arising from the indemnifier's "
                   "breach or IP infringement.",
        "fallback": "One-sided indemnity tied to indemnifier-owned IP only.",
    },
    "termination": {
        "counter": "Either party may terminate for convenience on 30 days' written notice; "
                   "fees prorated to termination date.",
        "fallback": "Mutual termination for material breach with 30-day cure period.",
    },
    "payment_terms": {
        "counter": "Net-30 payment terms with 1.5% monthly interest on past-due balances.",
        "fallback": "Net-45 with 30-day grace before late fees.",
    },
    "confidentiality": {
        "counter": "Mutual confidentiality for 3 years post-termination with standard exclusions.",
        "fallback": "Mutual confidentiality for 2 years post-termination.",
    },
    "ip_ownership": {
        "counter": "Each party retains its pre-existing IP; deliverables licensed, not assigned.",
        "fallback": "Assignment only of deliverables explicitly created under the SOW.",
    },
    "governing_law": {
        "counter": "Governing law: state of customer's principal place of business; courts in same.",
        "fallback": "Neutral jurisdiction (e.g., Delaware) acceptable if mutual.",
    },
    "dispute_resolution": {
        "counter": "Good-faith negotiation, then JAMS arbitration in customer's home state.",
        "fallback": "Mutual escalation followed by mediation.",
    },
}


@router.post("", response_model=NegotiateResponse)
async def negotiate(
    body: NegotiateRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("reviewer")),
) -> NegotiateResponse:
    draft = (
        await session.execute(
            select(ContractDraft).where(
                ContractDraft.id == body.draft_id,
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

    stmt = select(ClauseFinding).where(ClauseFinding.draft_id == draft.id)
    if body.finding_ids:
        stmt = stmt.where(ClauseFinding.finding_id.in_(body.finding_ids))
    findings = list((await session.execute(stmt)).scalars().all())

    suggestions: list[NegotiationSuggestion] = []
    for f in findings:
        tpl = _TEMPLATES.get(
            f.clause_name,
            {
                "counter": "Request mutual obligations and a cap on financial exposure.",
                "fallback": "Add written notice requirement for any change.",
            },
        )
        suggestions.append(
            NegotiationSuggestion(
                finding_id=f.finding_id,
                clause_name=f.clause_name,
                risk_level=RiskLevel(f.risk_level),
                counter_language=tpl["counter"],
                rationale=f.explanation or "Risk identified by analyzer.",
                fallback_position=tpl.get("fallback"),
            )
        )
    return NegotiateResponse(draft_id=draft.id, suggestions=suggestions)
