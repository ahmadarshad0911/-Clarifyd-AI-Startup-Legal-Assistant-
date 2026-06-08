from __future__ import annotations

import json
import logging

import httpx
from pydantic import ValidationError
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.contracts.analysis import ExtractedClause
from app.services.reasoning.prompts import (
    JSON_SCHEMA,
    build_batch_assessment_prompt,
    build_clause_assessment_prompt,
)
from app.services.reasoning.provider import (
    ClauseAssessment,
    ProviderError,
    ReasoningProvider,
    SchemaViolationError,
)

logger = logging.getLogger(__name__)

_RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}


class _RetryableProviderError(ProviderError):
    pass


class OpenAIProvider(ReasoningProvider):
    """OpenAI Chat Completions provider with structured JSON output.

    Kimi exposes the same OpenAI-compatible surface; subclass for base URL only.
    """

    name = "openai"

    def __init__(
        self,
        *,
        client: httpx.AsyncClient,
        api_key: str,
        model: str,
        base_url: str = "https://api.openai.com/v1",
        max_retries: int = 3,
    ) -> None:
        self._client = client
        self._api_key = api_key
        self.model = model
        self._base_url = base_url.rstrip("/")
        self._max_retries = max(1, max_retries)

    async def assess_clause(self, clause: ExtractedClause) -> ClauseAssessment:
        if not self._api_key:
            raise ProviderError("Reasoning API key is not configured.")
        system, user = build_clause_assessment_prompt(clause)
        body: dict[str, object] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0,
            # Clause assessments are a tight JSON object (~300-500 tokens
            # typical, up to ~1000 on a complex multi-issue clause). 1200
            # keeps headroom so the model doesn't truncate mid-finding while
            # still capping over-generation.
            "max_tokens": 1200,
        }

        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(self._max_retries),
                wait=wait_exponential(multiplier=0.25, max=4.0),
                retry=retry_if_exception_type(_RetryableProviderError),
                reraise=True,
            ):
                with attempt:
                    return await self._call_once(body)
        except RetryError as exc:  # pragma: no cover — reraise=True covers most cases
            raise ProviderError("Provider retries exhausted.") from exc
        except _RetryableProviderError as exc:
            raise ProviderError(str(exc)) from exc
        raise ProviderError("Provider did not return a result.")

    async def assess_clauses(
        self, clauses: list[ExtractedClause]
    ) -> list[ClauseAssessment]:
        """Score many clauses in ONE request. Falls back to the single-clause
        path for trivial batch sizes; raises ProviderError (so the fallback
        chain can try the next provider) if the API key is missing."""
        if not clauses:
            return []
        if len(clauses) == 1:
            return [await self.assess_clause(clauses[0])]
        if not self._api_key:
            raise ProviderError("Reasoning API key is not configured.")
        system, user = build_batch_assessment_prompt(clauses)
        body: dict[str, object] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0,
            # ~300-400 tokens per clause assessment; cap with headroom but stay
            # within a single response so nothing truncates mid-batch.
            "max_tokens": min(8192, 420 * len(clauses) + 256),
        }
        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(self._max_retries),
                wait=wait_exponential(multiplier=0.25, max=4.0),
                retry=retry_if_exception_type(_RetryableProviderError),
                reraise=True,
            ):
                with attempt:
                    return await self._call_batch_once(body, len(clauses))
        except RetryError as exc:  # pragma: no cover — reraise=True covers most
            raise ProviderError("Provider retries exhausted.") from exc
        except _RetryableProviderError as exc:
            raise ProviderError(str(exc)) from exc
        raise ProviderError("Provider did not return a batch result.")

    async def _call_batch_once(
        self, body: dict[str, object], expected: int
    ) -> list[ClauseAssessment]:
        url = f"{self._base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        try:
            response = await self._client.post(url, json=body, headers=headers)
        except httpx.TimeoutException as exc:
            raise _RetryableProviderError(f"Provider timeout: {exc}") from exc
        except httpx.TransportError as exc:
            raise _RetryableProviderError(f"Provider transport error: {exc}") from exc

        if response.status_code in _RETRYABLE_STATUS:
            raise _RetryableProviderError(
                f"Provider HTTP {response.status_code}: {response.text[:256]}"
            )
        if response.status_code >= 400:
            raise ProviderError(
                f"Provider HTTP {response.status_code}: {response.text[:256]}"
            )

        try:
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
            data = json.loads(content) if isinstance(content, str) else content
            items = data.get("assessments") if isinstance(data, dict) else None
            if not isinstance(items, list):
                raise ValueError("missing 'assessments' array")
            by_index: dict[int, ClauseAssessment] = {}
            for item in items:
                if not isinstance(item, dict):
                    continue
                idx = item.get("index")
                if not isinstance(idx, int) or not (0 <= idx < expected):
                    continue
                fields = {k: v for k, v in item.items() if k != "index"}
                by_index[idx] = ClauseAssessment.model_validate(fields)
            # Every clause must be covered, else realignment would be wrong.
            if len(by_index) != expected:
                raise ValueError(
                    f"expected {expected} assessments, got {len(by_index)}"
                )
            return [by_index[i] for i in range(expected)]
        except (KeyError, ValueError, TypeError, ValidationError) as exc:
            raise _RetryableProviderError(
                f"Provider returned invalid batch payload: {exc}"
            ) from exc

    async def _call_once(self, body: dict[str, object]) -> ClauseAssessment:
        url = f"{self._base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        try:
            response = await self._client.post(url, json=body, headers=headers)
        except httpx.TimeoutException as exc:
            raise _RetryableProviderError(f"Provider timeout: {exc}") from exc
        except httpx.TransportError as exc:
            raise _RetryableProviderError(f"Provider transport error: {exc}") from exc

        if response.status_code in _RETRYABLE_STATUS:
            logger.error(
                "Reasoning provider %s/%s retryable HTTP %s: %s",
                self.name, self.model, response.status_code, response.text[:256],
            )
            raise _RetryableProviderError(
                f"Provider HTTP {response.status_code}: {response.text[:256]}"
            )
        if response.status_code >= 400:
            logger.error(
                "Reasoning provider %s/%s fatal HTTP %s: %s",
                self.name, self.model, response.status_code, response.text[:256],
            )
            raise ProviderError(
                f"Provider HTTP {response.status_code}: {response.text[:256]}"
            )

        try:
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
            data = json.loads(content) if isinstance(content, str) else content
            return ClauseAssessment.model_validate(data)
        except (KeyError, ValueError, TypeError, ValidationError) as exc:
            # Treat schema violations as retryable; the model may correct itself.
            raise _RetryableProviderError(
                f"Provider returned invalid payload: {exc}"
            ) from exc
