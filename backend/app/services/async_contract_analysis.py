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


# Clauses scored per LLM call. Batching collapses N round-trips into
# ceil(uncached / _BATCH_SIZE), the main lever for cold-contract latency.
_BATCH_SIZE = 6
# Batch calls run concurrently; this caps the burst so we stay within the
# provider's rate limit. _BATCH_SIZE * _BATCH_CONCURRENCY clauses can be in
# flight at once (e.g. 36), covering most contracts in a single wave.
_BATCH_CONCURRENCY = 6


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

        # Per-clause cache reads first (cheap, indexed). Serial because async
        # SQLAlchemy sessions are not coroutine-safe for concurrent ops.
        provider_name = self._provider.name
        model = self._provider.model
        shas = [_clause_hash(c.text) for c in clauses]
        cached: list[ClauseAssessment | None] = [
            await self._cache_get(session, provider_name, model, sha) for sha in shas
        ]

        # Only the uncached clauses hit the provider, batched so N clauses cost
        # ceil(N / _BATCH_SIZE) round-trips instead of N. Batches run
        # concurrently (bounded) so a typical contract finishes in one wave.
        todo = [(i, clauses[i]) for i in range(len(clauses)) if cached[i] is None]
        computed: dict[int, ClauseAssessment] = {}
        if todo:
            batches = [
                todo[j : j + _BATCH_SIZE] for j in range(0, len(todo), _BATCH_SIZE)
            ]
            batch_sem = asyncio.Semaphore(_BATCH_CONCURRENCY)

            async def _run_batch(
                batch: list[tuple[int, ExtractedClause]],
            ) -> tuple[list[tuple[int, ExtractedClause]], list[ClauseAssessment]]:
                async with batch_sem:
                    items = await self._provider.assess_clauses(
                        [c for _, c in batch]
                    )
                    return batch, items

            for batch, items in await asyncio.gather(
                *[_run_batch(b) for b in batches]
            ):
                for (idx, _clause), assessment in zip(batch, items):
                    computed[idx] = assessment

        assessments: list[ClauseAssessment] = [
            cached[i] if cached[i] is not None else computed[i]
            for i in range(len(clauses))
        ]

        # Serial post-gather cache write. Dedupe by sha so two identical
        # clauses in the same contract don't double-insert. Each row is
        # flushed individually so a PK conflict from a concurrent request
        # writing the same clause text doesn't kill the whole batch.
        new_rows: dict[str, ClauseAssessment] = {}
        for i in range(len(clauses)):
            if cached[i] is None and shas[i] not in new_rows:
                new_rows[shas[i]] = assessments[i]
        if new_rows:
            await self._write_cache_rows(session, new_rows)

        findings = [
            a.to_finding(c, injection_suspected=injection_flags[c.clause_id])
            for a, c in zip(assessments, clauses)
        ]

        summary = self._summarize(findings)
        result = ContractAnalysisResult(clauses=clauses, findings=findings, summary=summary)
        return AnalysisResultWithFlags(result=result, injection_flags=injection_flags)

    async def _cache_get(
        self, session: AsyncSession, provider_name: str, model: str, sha: str
    ) -> ClauseAssessment | None:
        """Read a cached assessment for this clause sha, or None. No writes."""
        cached = (
            await session.execute(
                select(ClauseCache).where(
                    ClauseCache.provider == provider_name,
                    ClauseCache.model == model,
                    ClauseCache.clause_sha256 == sha,
                )
            )
        ).scalar_one_or_none()
        if cached is None:
            return None
        try:
            return ClauseAssessment.model_validate_json(cached.body_json)
        except Exception:  # pragma: no cover — corrupt cache row, recompute
            logger.warning(
                "Corrupt clause cache row for %s/%s/%s", provider_name, model, sha
            )
            return None

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
