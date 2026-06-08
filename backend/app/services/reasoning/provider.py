from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel, ConfigDict, Field

from app.contracts.analysis import ClauseRiskFinding, ExtractedClause, RiskSeverity


class ProviderError(Exception):
    """Raised when a provider fails permanently (after retries)."""


class SchemaViolationError(ProviderError):
    """Provider returned a payload that does not match the expected JSON schema."""


class ClauseAssessment(BaseModel):
    """Structured LLM output schema for a single clause assessment."""

    model_config = ConfigDict(extra="forbid")

    severity: RiskSeverity
    risk_score: int = Field(ge=1, le=10)
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str = Field(min_length=1, max_length=2000)

    def to_finding(
        self, clause: ExtractedClause, *, injection_suspected: bool = False
    ) -> ClauseRiskFinding:
        rationale = self.rationale
        if injection_suspected:
            rationale = "[injection-suspect] " + rationale
        return ClauseRiskFinding(
            clause=clause,
            severity=self.severity,
            risk_score=self.risk_score,
            confidence=self.confidence,
            rationale=rationale,
        )


class ReasoningProvider(ABC):
    """All providers expose a single async method that returns a structured assessment."""

    name: str = "base"
    model: str = ""

    @abstractmethod
    async def assess_clause(self, clause: ExtractedClause) -> ClauseAssessment:  # pragma: no cover
        ...

    async def assess_clauses(
        self, clauses: list[ExtractedClause]
    ) -> list[ClauseAssessment]:
        """Assess several clauses, returned in input order.

        Default routes each clause through `assess_clause`. Network providers
        override this with a single batched call to cut round-trips; local
        providers (e.g. rules) inherit the default since they have no latency.
        """
        return [await self.assess_clause(c) for c in clauses]
