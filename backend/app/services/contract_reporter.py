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

SEVERITY RUBRIC — pick the LOWEST band that fits (default to lower band on doubt):
- low      : Clause is non-standard but easily lived with. Reversible. No material exposure.
- medium   : Clause is unfavourable. Needs negotiation but not a deal-breaker.
             Affects cost / flexibility but not survival.
- high     : Clause meaningfully exposes the founder to financial loss, lock-in, or
             work-blocking risk. Must be renegotiated before signing.
- critical : Existential risk to the company OR founder personal liability. Do not sign
             without rewriting.

CALIBRATION EXAMPLES (do NOT echo these verbatim — use them to anchor your judgement):
- "Vendor's liability shall not exceed $100" → high (cap is absurdly low but bounded).
- "Founder assigns all pre-existing IP irrevocably" → critical (existential IP loss).
- "30-day net payment, 1.5%/mo late fee" → medium (standard commercial term, push for net-45).
- "Change of control acceleration including any equity financing > $1M" → critical
  (funding round triggers acceleration → existential cashflow risk).
- "Auto-renew with 180-day non-renewal notice window" → medium (unfavourable, push to 30 days).

SUGGESTED_CLAUSE RUBRIC — your `suggested_clause` MUST:
- Be a complete, drop-in replacement sentence (NOT commentary, NOT a description of what to fix).
- Name the numeric fix where applicable (e.g. "twelve (12) months", "1.5% per month",
  "the greater of fees paid in the prior twelve months or fifty thousand dollars ($50,000)").
- Preserve the original clause's legal structure (defined terms, signature blocks).
- Be at least 40 characters long. A two-word fix is not a suggestion.
- Never be a verbatim copy of `original_excerpt`.
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

        messages: list[dict[str, str]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"CONTRACT START\n{contract_text}\nCONTRACT END",
            },
        ]
        data = await self._call_llm(messages)
        if data is None:
            return None

        # Log validator defects for visibility but do NOT auto-retry — a
        # second LLM round-trip doubles NIM rate-limit pressure and on the
        # current free tier produces empty responses on 30-40% of cases.
        # If we move to a paid NIM tier or a higher-throughput provider,
        # flip ENABLE_REPORTER_RETRY back on.
        defects = _validate_suggestions(data)
        if defects:
            logger.info(
                "ContractReporter: %d suggestion defect(s) (no retry): %s",
                len(defects),
                "; ".join(defects[:3]),
            )

        return _build_report(self._model, data)

    async def _call_llm(self, messages: list[dict[str, str]]) -> dict[str, Any] | None:
        body: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "temperature": 0,
            # Capping output is the single biggest latency knob on NIM. Real
            # responses for a typical contract fit in ~1.6 K tokens; 2048
            # gives 25 % headroom and roughly halves p50 latency.
            "max_tokens": 2048,
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
            return json.loads(content) if isinstance(content, str) else content
        except (KeyError, ValueError, TypeError) as exc:
            logger.error(
                "ContractReporter parse error: %s — body: %s", exc, response.text[:400]
            )
            return None


_MIN_SUGGESTION_LEN = 40


def _validate_suggestions(data: dict[str, Any]) -> list[str]:
    """Return a list of human-readable defect lines (empty = no defects).

    Catches the three failure modes the eval surfaced:
      - suggestion too short (e.g. "Use safer language.")
      - suggestion is a verbatim copy of original_excerpt (no fix at all)
      - suggestion clause_name doesn't match the loophole it's supposed to fix
    """
    defects: list[str] = []
    loophole_names = {
        str(lp.get("clause_name", "")).strip()
        for lp in (data.get("loopholes") or [])
        if isinstance(lp, dict)
    }
    for i, s in enumerate(data.get("suggestions") or []):
        if not isinstance(s, dict):
            defects.append(f"suggestion #{i + 1} is not an object")
            continue
        name = str(s.get("clause_name", "")).strip()
        original = str(s.get("original_excerpt", "")).strip()
        replacement = str(s.get("suggested_clause", "")).strip()
        if len(replacement) < _MIN_SUGGESTION_LEN:
            defects.append(
                f"suggestion #{i + 1} ({name or 'unnamed'}) is too short "
                f"({len(replacement)} chars; need >= {_MIN_SUGGESTION_LEN})"
            )
        if original and replacement and replacement == original:
            defects.append(
                f"suggestion #{i + 1} ({name or 'unnamed'}) is a verbatim copy "
                "of original_excerpt — no actual fix"
            )
        if loophole_names and name and name not in loophole_names:
            defects.append(
                f"suggestion #{i + 1} clause_name '{name}' does not match any "
                f"loophole clause_name ({sorted(loophole_names)[:3]}...)"
            )
    return defects


def _build_report(model_name: str, data: dict[str, Any]) -> ContractReport | None:
    try:
        return ContractReport(
            model_name=model_name,
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
    except (ValidationError, ValueError) as exc:
        logger.error("ContractReporter schema validation failed: %s", exc)
        return None
