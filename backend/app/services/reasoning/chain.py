from __future__ import annotations

import logging
from collections.abc import Sequence

from app.contracts.analysis import ExtractedClause
from app.services.reasoning.provider import (
    ClauseAssessment,
    ProviderError,
    ReasoningProvider,
)

logger = logging.getLogger(__name__)


class FallbackChainProvider(ReasoningProvider):
    """Try each provider in order; on ProviderError fall through to the next."""

    name = "chain"

    def __init__(self, providers: Sequence[ReasoningProvider]) -> None:
        if not providers:
            raise ValueError("FallbackChainProvider requires at least one provider.")
        self._providers = list(providers)
        self.model = self._providers[0].model

    @property
    def providers(self) -> list[ReasoningProvider]:
        return list(self._providers)

    async def assess_clause(self, clause: ExtractedClause) -> ClauseAssessment:
        last_error: Exception | None = None
        for provider in self._providers:
            try:
                return await provider.assess_clause(clause)
            except ProviderError as exc:
                last_error = exc
                logger.error(
                    "Reasoning provider %s/%s failed: %s — falling through.",
                    provider.name,
                    provider.model,
                    exc,
                )
                continue
        # Every provider failed.
        raise ProviderError(
            f"All providers in chain failed; last error: {last_error}"
        )
