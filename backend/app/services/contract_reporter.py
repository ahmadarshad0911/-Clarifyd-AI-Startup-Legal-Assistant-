from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from pydantic import ValidationError

from app.contracts.api import (
    ContractReport,
    CrossVerification,
    ReportLoophole,
    ReportSuggestion,
    RiskLevel,
)

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are a senior commercial-contracts attorney advising a startup founder.

Your job: analyze the contract the user pastes, find every clause that creates legal,
financial, or operational risk for the founder's company, propose a replacement that is
favorable to the founder's company while still commercially reasonable, then cross-verify
your own analysis and produce an executive summary.

Return STRICT JSON matching this schema (no prose outside JSON):

{
  "verdict": "critical" | "high" | "medium" | "low",
  "executive_summary": "2-4 sentence summary for the founder",
  "loopholes": [
    {
      "clause_name": "short name (e.g. 'Unlimited Liability')",
      "excerpt": "exact text from the contract",
      "issue": "what is wrong / the legal loophole",
      "severity": "critical" | "high" | "medium" | "low",
      "impact": "concrete commercial impact on the company"
    }
  ],
  "suggestions": [
    {
      "clause_name": "same name as the loophole it replaces",
      "original_excerpt": "exact text being replaced",
      "suggested_clause": "drop-in replacement language favorable to the founder",
      "rationale": "why this rewrite is safer and still acceptable to counterparty"
    }
  ],
  "cross_verification": {
    "risks_resolved": true | false,
    "residual_concerns": "any risks the suggestions do NOT fully solve",
    "notes": "brief audit of whether the suggested clauses actually fix the loopholes"
  }
}

Rules:
- Quote the contract verbatim in `excerpt` and `original_excerpt`.
- One suggestion per loophole; align by `clause_name`.
- If contract is clean, return verdict='low', empty loopholes/suggestions, and explain
  in executive_summary and cross_verification.notes.
- Be terse, concrete, founder-focused.
- Output JSON only.
"""


class ContractReporter:
    def __init__(
        self,
        *,
        client: httpx.AsyncClient,
        api_key: str | None,
        model: str,
        base_url: str,
        timeout: float = 60.0,
    ) -> None:
        self._client = client
        self._api_key = api_key or ""
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    @property
    def model(self) -> str:
        return self._model

    async def generate(self, contract_text: str) -> ContractReport | None:
        if not self._api_key:
            logger.warning("ContractReporter: no API key configured, skipping report.")
            return None

        body: dict[str, Any] = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"CONTRACT START\n{contract_text}\nCONTRACT END",
                },
            ],
            "temperature": 0,
            "max_tokens": 4096,
            "response_format": {"type": "json_object"},
        }
        url = f"{self._base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        try:
            response = await self._client.post(
                url, json=body, headers=headers, timeout=self._timeout
            )
        except httpx.HTTPError as exc:
            logger.error("ContractReporter HTTP error %s: %r", type(exc).__name__, exc)
            return None
        except Exception as exc:  # pragma: no cover
            logger.error("ContractReporter unexpected error %s: %r", type(exc).__name__, exc)
            return None
        if response.status_code >= 400:
            logger.error(
                "ContractReporter HTTP %s: %s", response.status_code, response.text[:400]
            )
            return None
        try:
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
            data = json.loads(content) if isinstance(content, str) else content
        except (KeyError, ValueError, TypeError) as exc:
            logger.error("ContractReporter parse error: %s — body: %s", exc, response.text[:400])
            return None

        try:
            report = ContractReport(
                model_name=self._model,
                verdict=RiskLevel(data.get("verdict", "low")),
                executive_summary=str(data.get("executive_summary", "")).strip()
                or "No summary returned.",
                loopholes=[
                    ReportLoophole(
                        clause_name=str(l.get("clause_name", "")),
                        excerpt=str(l.get("excerpt", "")),
                        issue=str(l.get("issue", "")),
                        severity=RiskLevel(l.get("severity", "low")),
                        impact=str(l.get("impact", "")),
                    )
                    for l in data.get("loopholes", []) or []
                ],
                suggestions=[
                    ReportSuggestion(
                        clause_name=str(s.get("clause_name", "")),
                        original_excerpt=str(s.get("original_excerpt", "")),
                        suggested_clause=str(s.get("suggested_clause", "")),
                        rationale=str(s.get("rationale", "")),
                    )
                    for s in data.get("suggestions", []) or []
                ],
                cross_verification=CrossVerification(
                    risks_resolved=bool(
                        (data.get("cross_verification") or {}).get("risks_resolved", False)
                    ),
                    residual_concerns=str(
                        (data.get("cross_verification") or {}).get("residual_concerns", "")
                    ),
                    notes=str((data.get("cross_verification") or {}).get("notes", "")),
                ),
            )
            return report
        except (ValidationError, ValueError) as exc:
            logger.error("ContractReporter schema validation failed: %s", exc)
            return None
