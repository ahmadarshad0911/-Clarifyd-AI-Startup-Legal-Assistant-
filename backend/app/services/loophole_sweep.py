"""Whole-contract loophole sweep.

The per-clause analyzer only ever emits ONE finding per extracted clause
and is blind to loopholes that come from *absent* clauses ("no exit
obligations", "no IP assignment", missing data-return on termination,
etc.). This sweeper runs one extra Kimi call over the full text and asks
for a structured list of every loophole — present OR missing — and
returns them as synthetic findings the analyze handler merges into the
clause-level findings.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.contracts.analysis import (
    ClauseRiskFinding,
    ClauseType,
    ExtractedClause,
    RiskSeverity,
)

logger = logging.getLogger(__name__)

_SYSTEM = (
    "You are a senior startup counsel reviewing a contract for a pre-seed "
    "founder. Identify ONLY genuine, material loopholes, risky clauses, and "
    "MISSING protections — including those from absent terms (e.g. no exit "
    "obligations, no IP assignment, no data return on termination). "
    "Report a problem only when a competent lawyer would flag it for THIS "
    "contract. A well-drafted contract may have few or zero issues — if so, "
    "return a short list or an empty list. Do NOT invent problems, pad the "
    "list, or flag standard, reasonable, market-standard clauses. Return "
    "strict JSON only."
)

_USER_TEMPLATE = (
    'Contract:\n"""\n{text}\n"""\n\n'
    "Output JSON in this exact shape:\n"
    "{{\n"
    '  "loopholes": [\n'
    '    {{"title": "<3-7 word headline>",\n'
    '     "severity": "<low|medium|high|critical>",\n'
    '     "rationale": "<1-2 sentence explanation grounded in the contract '
    "or in what is missing from it>\"}}\n"
    "  ]\n"
    "}}"
)


class LoopholeSweeper:
    def __init__(
        self,
        client: httpx.AsyncClient,
        api_key: str | None,
        base_url: str,
        model: str,
        timeout: float = 30.0,
    ) -> None:
        self._client = client
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout = timeout

    async def sweep(self, contract_text: str) -> list[ClauseRiskFinding]:
        if not self._api_key:
            return []
        body: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": _USER_TEMPLATE.format(text=contract_text)},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0,
            "max_tokens": 2000,
        }
        url = f"{self._base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        try:
            resp = await self._client.post(
                url, json=body, headers=headers, timeout=self._timeout
            )
            resp.raise_for_status()
            payload = resp.json()
            content = payload["choices"][0]["message"]["content"]
            data = json.loads(content) if isinstance(content, str) else content
        except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
            logger.warning("LoopholeSweep failed: %r", exc)
            return []

        items = data.get("loopholes") if isinstance(data, dict) else None
        if not isinstance(items, list):
            return []

        findings: list[ClauseRiskFinding] = []
        for i, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            rationale = str(item.get("rationale") or "").strip()
            sev_raw = str(item.get("severity") or "low").strip().lower()
            if sev_raw not in {"low", "medium", "high", "critical"}:
                sev_raw = "low"
            if not title or not rationale:
                continue
            severity = RiskSeverity(sev_raw)
            score = {"low": 3, "medium": 5, "high": 7, "critical": 9}[sev_raw]
            synthetic = ExtractedClause(
                clause_id=f"sweep-{i + 1}",
                clause_type=ClauseType.uncategorized,
                text=title,
                start_offset=0,
                end_offset=0,
                confidence=0.85,
            )
            findings.append(
                ClauseRiskFinding(
                    clause=synthetic,
                    severity=severity,
                    risk_score=score,
                    confidence=0.85,
                    rationale=rationale,
                )
            )
        return findings
