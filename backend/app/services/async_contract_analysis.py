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


# Bump this when the assessor prompt changes so the cache can't serve
# answers calibrated on the prior rubric. The version string is mixed into
# the per-clause sha256 so the cache key implicitly carries the prompt
# generation. Last bump: 2026-05-16 — added severity + risk_score rubrics
# + calibration examples to CLAUSE_SYSTEM_PROMPT.
_CLAUSE_PROMPT_VERSION = "v2-2026-05-16-rubric"


def _clause_hash(text: str) -> str:
    return hashlib.sha256(
        (_CLAUSE_PROMPT_VERSION + "\n" + text).encode("utf-8")
    ).hexdigest()


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
        # Each task is read-only against the DB (cache lookup) and against the
        # provider (assess_clause). The cache *write* happens once, serially,
        # after gather() returns — this is the fix for the pre-existing
        # "Failed to write clause cache row" warning, which was caused by
        # concurrent `session.add()` calls landing while the session was
        # mid-flush (async SQLAlchemy sessions are not coroutine-safe for
        # concurrent writes).
        # Per-clause LLM concurrency. Higher = lower wall-clock latency on a
        # cold contract; bounded so we don't burst past the provider's quota.
        # The provider already retries 429 with exponential backoff, so a
        # transient burst self-recovers instead of degrading every clause.
        sem = asyncio.Semaphore(6)

        async def _run(
            clause: ExtractedClause,
        ) -> tuple[ClauseAssessment, str, bool]:
            async with sem:
                return await self._lookup_or_compute(clause, session=session)

        results = await asyncio.gather(*[_run(c) for c in clauses])
        assessments = [r[0] for r in results]

        # Serial post-gather cache write. Dedupe by sha so two identical
        # clauses in the same contract don't double-insert. Each row is
        # flushed individually so a PK conflict from a concurrent request
        # writing the same clause text doesn't kill the whole batch.
        new_rows: dict[str, ClauseAssessment] = {}
        for assessment, sha, was_cached in results:
            if not was_cached and sha not in new_rows:
                new_rows[sha] = assessment
        if new_rows:
            await self._write_cache_rows(session, new_rows)

        findings = [
            a.to_finding(c, injection_suspected=injection_flags[c.clause_id])
            for a, c in zip(assessments, clauses)
        ]

        summary = self._summarize(findings)
        result = ContractAnalysisResult(clauses=clauses, findings=findings, summary=summary)
        return AnalysisResultWithFlags(result=result, injection_flags=injection_flags)

    async def _lookup_or_compute(
        self, clause: ExtractedClause, *, session: AsyncSession
    ) -> tuple[ClauseAssessment, str, bool]:
        """Return (assessment, clause_sha, was_cached). No DB writes here."""
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
                return ClauseAssessment.model_validate_json(cached.body_json), sha, True
            except Exception:  # pragma: no cover — corrupt cache row, fall through
                logger.warning(
                    "Corrupt clause cache row for %s/%s/%s", provider_name, model, sha
                )

        assessment = await self._provider.assess_clause(clause)
        return assessment, sha, False

    async def _write_cache_rows(
        self, session: AsyncSession, new_rows: dict[str, ClauseAssessment]
    ) -> None:
        """Serial best-effort batch insert. Per-row try/except so a PK
        conflict from a concurrent request for the same clause text doesn't
        abort the whole batch.
        """
        provider_name = self._provider.name
        model = self._provider.model
        for sha, assessment in new_rows.items():
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
            except Exception:
                # Most common cause: another concurrent request wrote the same
                # row first. Rollback the per-row state and continue.
                logger.info(
                    "ClauseCache row already exists or insert raced for "
                    "%s/%s/%s — skipping.",
                    provider_name,
                    model,
                    sha[:12],
                )
                try:
                    await session.rollback()
                except Exception:  # pragma: no cover
                    pass

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
