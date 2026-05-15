"""Reasoning Model API — PRD §4.12.

Exposes contract evaluation, founder legal-guidance Q&A, taxonomy listing,
and async job polling. Reuses existing AsyncContractAnalysisService and
audit chain. No new persistence tables.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from time import perf_counter
from typing import TYPE_CHECKING
from uuid import uuid4

from fastapi import APIRouter, Depends, Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.contracts.api import (
    CLAUSE_CATEGORIES,
    FounderGuidance,
    REASONING_DISCLAIMER,
    ReasoningCategoriesResponse,
    ReasoningEvaluateRequest,
    ReasoningEvaluateResponse,
    ReasoningFinding,
    ReasoningGuidanceRequest,
    ReasoningGuidanceResponse,
    ReasoningJobResponse,
    ReasoningJobStatus,
    RiskLevel,
)
from app.contracts.analysis import ClauseType, RiskSeverity
from app.db.models import ClauseFinding as ClauseFindingRow
from app.db.models import ContractDraft as ContractDraftRow
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.observability import (
    record_reasoning_call,
    record_reasoning_latency,
)
from app.services.audit import append_audit_event

if TYPE_CHECKING:
    from app.services.async_contract_analysis import AsyncContractAnalysisService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/reasoning", tags=["reasoning"])


_SEVERITY_RANK: dict[str, int] = {"low": 1, "medium": 2, "high": 3, "critical": 4}

_CATEGORY_MAP: dict[str, tuple[str, ...]] = {
    ClauseType.liability.value: ("liability", "limitation_of_liability"),
    ClauseType.indemnity.value: ("indemnification", "liability"),
    ClauseType.payment_terms.value: ("payment_terms",),
    ClauseType.termination.value: ("termination",),
    ClauseType.confidentiality.value: ("confidentiality",),
    ClauseType.ip_ownership.value: ("intellectual_property",),
    ClauseType.governing_law.value: ("governing_law",),
    ClauseType.dispute_resolution.value: ("dispute_resolution",),
    ClauseType.data_protection.value: ("data_protection",),
    ClauseType.assignment.value: ("general",),
    ClauseType.uncategorized.value: ("general",),
}

# Refusal triggers for jurisdiction-specific or definitive-opinion asks.
_JURISDICTION_TRIGGERS = re.compile(
    r"\b(under\s+(california|delaware|new york|texas|uk|eu|gdpr|hipaa)|"
    r"is this (legal|enforceable|valid)|will (i|we) win|"
    r"can (i|we) sue|legal opinion|legally binding)\b",
    re.IGNORECASE,
)


# --- Async job registry (in-memory; SLC scope) ---------------------------------------

@dataclass
class _Job:
    job_id: str
    status: ReasoningJobStatus
    draft_id: str | None = None
    result: ReasoningEvaluateResponse | None = None
    error: str | None = None


_JOBS: dict[str, _Job] = {}


# --- Helpers -------------------------------------------------------------------------

def _categories_for(clause_name: str) -> list[str]:
    return list(_CATEGORY_MAP.get(clause_name, ("general",)))


def _normalize_score(score_1_to_10: int | float) -> int:
    return max(1, min(100, int(round(float(score_1_to_10) * 10))))


def _founder_guidance_for(
    clause_name: str, excerpt: str, risk_level: str
) -> FounderGuidance:
    """Deterministic founder-guidance scaffold.

    The structure matches what an LLM provider would return; this keeps the
    SLC working without an API key while preserving the schema contract.
    """
    severity = risk_level.lower()
    why = {
        "termination": "Loose termination rights expose runway and customer retention.",
        "liability": "Uncapped or one-sided liability can sink the company on a single dispute.",
        "indemnity": "Broad indemnity transfers third-party-claim risk onto the startup.",
        "payment_terms": "Long net terms and penalties hurt cash flow during scale-up.",
        "confidentiality": "Weak confidentiality can leak product or roadmap to competitors.",
        "ip_ownership": "IP assignment gaps risk losing core product ownership.",
        "governing_law": "Unfavorable venue raises dispute cost and operational drag.",
        "dispute_resolution": "Forced venue or class waivers shape negotiation leverage.",
        "data_protection": "Data-handling obligations drive compliance cost and audit risk.",
        "assignment": "Restrictions on assignment block M&A and financing pathways.",
    }.get(clause_name, "Material clause — review carefully before signing.")
    suggested = None
    if severity in {"high", "critical"}:
        suggested = (
            "Cap liability at 12 months of fees; carve out IP, confidentiality, "
            "and indemnity-only obligations; require mutual termination for convenience "
            "with reasonable notice."
        )
    points = [
        "Ask for mutual obligations, not one-sided.",
        "Push for caps on financial exposure tied to fees paid.",
        "Require advance written notice for any termination or change.",
    ]
    if severity == "critical":
        points.insert(0, "Treat this clause as a blocker until counsel reviews.")
    return FounderGuidance(
        plain_english=(
            f"This is a {clause_name.replace('_', ' ')} clause: "
            f"{excerpt[:160].rstrip()}{'…' if len(excerpt) > 160 else ''}"
        ),
        why_it_matters=why,
        suggested_language=suggested,
        negotiation_points=points,
        market_standard_reference=(
            "NVCA model / YC SAFE conventions" if severity in {"high", "critical"} else None
        ),
    )


def _build_findings(rows: list[ClauseFindingRow]) -> list[ReasoningFinding]:
    findings: list[ReasoningFinding] = []
    rows = [r for r in rows if r.clause_name != "uncategorized"]
    for row in rows:
        findings.append(
            ReasoningFinding(
                finding_id=row.finding_id,
                clause_name=row.clause_name,
                categories=_categories_for(row.clause_name),
                excerpt=row.excerpt,
                risk_score=_normalize_score(row.risk_score),
                risk_level=RiskLevel(row.risk_level),
                confidence=row.confidence,
                rationale=row.explanation,
                founder_guidance=_founder_guidance_for(
                    row.clause_name, row.excerpt, row.risk_level
                ),
                injection_suspected=bool(row.injection_suspected),
            )
        )
    findings.sort(
        key=lambda f: (
            _SEVERITY_RANK[f.risk_level.value],
            f.risk_score,
            f.confidence,
        ),
        reverse=True,
    )
    return findings


def _overall(findings: list[ReasoningFinding]) -> tuple[int, RiskLevel]:
    if not findings:
        return 1, RiskLevel.low
    top = findings[0]
    return top.risk_score, top.risk_level


def _provider_label() -> tuple[str, str]:
    # Lazy import to dodge circular import at module load.
    from app import main as _main  # type: ignore

    svc: "AsyncContractAnalysisService | None" = getattr(_main, "_async_analysis", None)
    if svc is None:
        return "rules", "rules-fallback"
    return svc.provider.name, svc.provider.model


# --- Routes --------------------------------------------------------------------------

@router.get("/categories", response_model=ReasoningCategoriesResponse)
async def list_categories() -> ReasoningCategoriesResponse:
    return ReasoningCategoriesResponse(categories=list(CLAUSE_CATEGORIES))


@router.post("/evaluate", response_model=ReasoningEvaluateResponse)
async def evaluate(
    body: ReasoningEvaluateRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> ReasoningEvaluateResponse:
    if not body.draft_id and not body.raw_text:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Provide draft_id or raw_text.",
            status_code=422,
        )

    provider_name, provider_model = _provider_label()
    started = perf_counter()

    draft_id: str
    rows: list[ClauseFindingRow]
    if body.draft_id:
        draft = (
            await session.execute(
                select(ContractDraftRow).where(
                    ContractDraftRow.id == body.draft_id,
                    ContractDraftRow.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if draft is None:
            raise AppError(
                code=ErrorCode.request_validation_error,
                message="Draft not found.",
                status_code=404,
            )
        draft_id = draft.id
        rows = list(
            (
                await session.execute(
                    select(ClauseFindingRow).where(ClauseFindingRow.draft_id == draft_id)
                )
            )
            .scalars()
            .all()
        )
    else:
        # raw_text path — analyze inline, do not persist a draft row.
        from app.main import get_async_analysis  # avoid import cycle at top

        try:
            analysis_with_flags = await get_async_analysis().analyze(
                body.raw_text or "", session=session
            )
        except ValueError as exc:
            raise AppError(
                code=ErrorCode.request_validation_error,
                message=str(exc),
                status_code=422,
            ) from exc
        analysis = analysis_with_flags.result
        rows = []
        important = [
            f for f in analysis.findings if f.clause.clause_type.value != "uncategorized"
        ]
        for index, finding in enumerate(important, start=1):
            rows.append(
                ClauseFindingRow(
                    draft_id="inline",
                    finding_id=f"finding-{index}",
                    clause_name=finding.clause.clause_type.value,
                    excerpt=finding.clause.text,
                    risk_level=finding.severity.value,
                    risk_score=finding.risk_score,
                    confidence=finding.confidence,
                    explanation=finding.rationale,
                    injection_suspected=analysis_with_flags.injection_flags.get(
                        finding.clause.clause_id, False
                    ),
                )
            )
        draft_id = "inline-" + uuid4().hex[:12]

    findings = _build_findings(rows)
    overall_score, overall_level = _overall(findings)

    response = ReasoningEvaluateResponse(
        draft_id=draft_id,
        model=provider_model or "rules-fallback",
        overall_risk_score=overall_score,
        overall_risk_level=overall_level,
        findings=findings,
    )

    elapsed = perf_counter() - started
    record_reasoning_call(provider=provider_name, model=provider_model or "rules-fallback")
    record_reasoning_latency(elapsed, provider=provider_name, model=provider_model or "rules-fallback")

    if body.draft_id:
        await append_audit_event(
            session,
            action="reasoning.evaluate",
            target_type="contract_draft",
            target_id=draft_id,
            actor_id=user.id,
            payload={
                "findings": len(findings),
                "overall_score": overall_score,
                "overall_level": overall_level.value,
                "provider": provider_name,
                "model": provider_model,
            },
        )
        await session.commit()

    return response


@router.post("/guidance", response_model=ReasoningGuidanceResponse)
async def guidance(
    body: ReasoningGuidanceRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> ReasoningGuidanceResponse:
    draft = (
        await session.execute(
            select(ContractDraftRow).where(
                ContractDraftRow.id == body.draft_id,
                ContractDraftRow.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if draft is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Draft not found.",
            status_code=404,
        )

    if _JURISDICTION_TRIGGERS.search(body.question):
        await append_audit_event(
            session,
            action="reasoning.guidance.refused",
            target_type="contract_draft",
            target_id=draft.id,
            actor_id=user.id,
            payload={"reason": "jurisdiction_specific"},
        )
        await session.commit()
        return ReasoningGuidanceResponse(
            draft_id=draft.id,
            finding_id=body.finding_id,
            answer=(
                "I can't provide a jurisdiction-specific legal opinion. "
                "Please consult licensed counsel in your jurisdiction. "
                "I can still walk you through general structure, common market terms, "
                "and negotiation points if useful."
            ),
            refused=True,
            refusal_reason="jurisdiction_specific",
        )

    if body.finding_id:
        finding = (
            await session.execute(
                select(ClauseFindingRow).where(
                    ClauseFindingRow.draft_id == draft.id,
                    ClauseFindingRow.finding_id == body.finding_id,
                )
            )
        ).scalar_one_or_none()
        if finding is None:
            raise AppError(
                code=ErrorCode.request_validation_error,
                message="Finding not found on draft.",
                status_code=404,
            )
        scoped = (
            f"For the {finding.clause_name} clause (risk: {finding.risk_level}), "
            f"the practical takeaway is: focus on capping exposure, requiring mutual "
            f"obligations, and adding notice periods. "
            f"You asked: {body.question.strip()[:200]}"
        )
    else:
        scoped = (
            "General guidance: prioritize clauses tagged high/critical, push for "
            "mutual terms, cap monetary exposure, and require written notice for "
            "changes. " + f"You asked: {body.question.strip()[:200]}"
        )

    await append_audit_event(
        session,
        action="reasoning.guidance",
        target_type="contract_draft",
        target_id=draft.id,
        actor_id=user.id,
        payload={"finding_id": body.finding_id, "q_len": len(body.question)},
    )
    await session.commit()
    return ReasoningGuidanceResponse(
        draft_id=draft.id,
        finding_id=body.finding_id,
        answer=scoped + " " + REASONING_DISCLAIMER,
    )


@router.get("/jobs/{job_id}", response_model=ReasoningJobResponse)
async def get_job(
    job_id: str = Path(..., min_length=1),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> ReasoningJobResponse:
    job = _JOBS.get(job_id)
    if job is None:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message="Job not found.",
            status_code=404,
        )
    return ReasoningJobResponse(
        job_id=job.job_id,
        status=job.status,
        draft_id=job.draft_id,
        result=job.result,
        error=job.error,
    )
