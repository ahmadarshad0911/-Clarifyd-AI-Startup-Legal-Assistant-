"""Compliance & Regulatory Framework — PRD §4.4."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthenticatedUser, require_role
from app.contracts.api import (
    ComplianceCheckRequest,
    ComplianceCheckResponse,
    ComplianceFlag,
    JURISDICTIONS,
    RiskLevel,
)
from app.db.models import ClauseFinding, ContractDraft
from app.db.session import get_session
from app.errors import AppError, ErrorCode
from app.services.audit import append_audit_event

router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])


_REG_RULES: dict[str, dict[str, str]] = {
    "GDPR": {"data_protection": "GDPR requires lawful basis + subject rights."},
    "CCPA": {"data_protection": "CCPA requires opt-out + disclosure."},
    "HIPAA": {"data_protection": "HIPAA requires BAA + safeguards on PHI."},
    "FCPA": {"governing_law": "FCPA prohibits foreign-official bribery."},
}

_JURISDICTION_DEFAULTS: dict[str, tuple[str, ...]] = {
    "US": ("CCPA", "FCPA"),
    "UK": ("GDPR",),
    "EU": ("GDPR",),
    "APAC": (),
    "GLOBAL": ("GDPR", "CCPA", "HIPAA", "FCPA"),
}


@router.get("/jurisdictions")
async def list_jurisdictions(
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> dict[str, list[str]]:
    return {"jurisdictions": list(JURISDICTIONS)}


@router.post("/check", response_model=ComplianceCheckResponse)
async def check(
    body: ComplianceCheckRequest,
    session: AsyncSession = Depends(get_session),
    user: AuthenticatedUser = Depends(require_role("viewer")),
) -> ComplianceCheckResponse:
    juris = body.jurisdiction.upper()
    if juris not in JURISDICTIONS:
        raise AppError(
            code=ErrorCode.request_validation_error,
            message=f"Unknown jurisdiction '{body.jurisdiction}'.",
            status_code=422,
        )
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

    regs = body.regulations or list(_JURISDICTION_DEFAULTS.get(juris, ()))
    findings = list(
        (
            await session.execute(
                select(ClauseFinding).where(ClauseFinding.draft_id == draft.id)
            )
        )
        .scalars()
        .all()
    )

    flags: list[ComplianceFlag] = []
    for reg in regs:
        rules = _REG_RULES.get(reg, {})
        for finding in findings:
            rationale = rules.get(finding.clause_name)
            if rationale is None:
                continue
            flags.append(
                ComplianceFlag(
                    finding_id=finding.finding_id,
                    clause_name=finding.clause_name,
                    rule=reg,
                    severity=RiskLevel(finding.risk_level),
                    rationale=rationale,
                )
            )

    await append_audit_event(
        session,
        action="compliance.check",
        target_type="contract_draft",
        target_id=draft.id,
        actor_id=user.id,
        payload={"jurisdiction": juris, "regulations": regs, "flags": len(flags)},
    )
    await session.commit()
    return ComplianceCheckResponse(
        draft_id=draft.id,
        jurisdiction=juris,
        compliant=len(flags) == 0,
        flags=flags,
    )
