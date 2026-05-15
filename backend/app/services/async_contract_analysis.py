from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.analysis import (
    AnalysisSummary,
    ClauseRiskFinding,
    ClauseType,
    ContractAnalysisResult,
    ExtractedClause,
    RiskSeverity,
)
from app.db.models import ClauseCache
from app.services.contract_analysis import ContractAnalysisService
from app.services.reasoning.injection import detect_injection
from app.services.reasoning.provider import (
    ClauseAssessment,
    ProviderError,
    ReasoningProvider,
)

logger = logging.getLogger(__name__)

_SEVERITY_RANK: dict[RiskSeverity, int] = {
    RiskSeverity.low: 1,
    RiskSeverity.medium: 2,
    RiskSeverity.high: 3,
    RiskSeverity.critical: 4,
}


@dataclass
class AnalysisResultWithFlags:
    result: ContractAnalysisResult
    injection_flags: dict[str, bool]


def _clause_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class AsyncContractAnalysisService:
    """Async clause-extraction + LLM-driven scoring with per-clause cache.

    Reuses the sync ContractAnalysisService for clause extraction (no LLM call),
    then awaits the provider for risk scoring. Cache is keyed on
    (provider.name, provider.model, sha256(clause_text)).
    """

    def __init__(self, *, provider: ReasoningProvider) -> None:
        self._provider = provider
        self._extractor = ContractAnalysisService()

    @property
    def provider(self) -> ReasoningProvider:
        return self._provider

    def extract_clauses(self, contract_text: str) -> list[ExtractedClause]:
        return self._extractor.extract_clauses(contract_text)

    async def analyze(
        self, contract_text: str, *, session: AsyncSession
    ) -> AnalysisResultWithFlags:
        clauses = self.extract_clauses(contract_text)
        injection_flags: dict[str, bool] = {
            clause.clause_id: detect_injection(clause.text) for clause in clauses
        }

        # Parallel per-clause LLM calls. Bounded concurrency keeps NIM happy.
        sem = asyncio.Semaphore(8)

        async def _run(clause: ExtractedClause) -> ClauseAssessment:
            async with sem:
                return await self._cached_assessment(clause, session=session)

        assessments = await asyncio.gather(*[_run(c) for c in clauses])
        findings = [
            a.to_finding(c, injection_suspected=injection_flags[c.clause_id])
            for a, c in zip(assessments, clauses)
        ]

        summary = self._summarize(findings)
        result = ContractAnalysisResult(clauses=clauses, findings=findings, summary=summary)
        return AnalysisResultWithFlags(result=result, injection_flags=injection_flags)

    async def _cached_assessment(
        self, clause: ExtractedClause, *, session: AsyncSession
    ) -> ClauseAssessment:
        sha = _clause_hash(clause.text)
        provider_name = self._provider.name
        model = self._provider.model

        cached = (
            await session.execute(
                select(ClauseCache).where(
                    ClauseCache.provider == provider_name,
                    ClauseCache.model == model,
                    ClauseCache.clause_sha256 == sha,
                )
            )
        ).scalar_one_or_none()
        if cached is not None:
            try:
                return ClauseAssessment.model_validate_json(cached.body_json)
            except Exception:  # pragma: no cover — corrupt cache row, fall through
                logger.warning("Corrupt clause cache row for %s/%s/%s", provider_name, model, sha)

        try:
            assessment = await self._provider.assess_clause(clause)
        except ProviderError:
            raise

        # Best-effort cache write; failures must not break the request.
        try:
            session.add(
                ClauseCache(
                    provider=provider_name,
                    model=model,
                    clause_sha256=sha,
                    body_json=assessment.model_dump_json(),
                )
            )
            await session.flush()
        except Exception:  # pragma: no cover
            logger.warning("Failed to write clause cache row.")
        return assessment

    @staticmethod
    def _summarize(findings: list[ClauseRiskFinding]) -> AnalysisSummary:
        if not findings:
            return AnalysisSummary(
                overall_score=1, highest_severity=RiskSeverity.low, findings_count=0
            )
        highest = max(findings, key=lambda f: _SEVERITY_RANK[f.severity]).severity
        overall = max(f.risk_score for f in findings)
        return AnalysisSummary(
            overall_score=overall, highest_severity=highest, findings_count=len(findings)
        )
