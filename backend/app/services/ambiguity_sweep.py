"""Whole-contract ambiguity sweep.

Flags parts of the contract that are vague, undefined, or open to
interpretation — undefined terms ("reasonable", "as needed", "promptly"),
missing definitions, unspecified amounts/dates/parties, and clauses that
could be read more than one way. Distinct from the loophole sweep: a
clause can be perfectly enforceable yet dangerously ambiguous.

One extra Kimi call over the full text, returning structured items the
analyze handler attaches to the response as `ambiguities`.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.contracts.api import ContractAmbiguity, RiskLevel

logger = logging.getLogger(__name__)

_SYSTEM = (
    "You are a senior contracts lawyer auditing a contract for a pre-seed "
    "founder. Identify ONLY genuinely ambiguous or undefined language that "
    "a competent lawyer would actually flag for THIS contract: undefined "
    "terms ('reasonable', 'promptly', 'material'), missing definitions, "
    "unspecified amounts/dates/parties/scope, or clauses open to more than "
    "one reading. For each, quote the exact phrase and say what is "
    "undefined and why it matters. THEN give a concrete fix: the exact "
    "sentence or clause line the founder should add or substitute to remove "
    "the ambiguity (define the term, name the amount/date/party, or pin the "
    "single intended reading). Make the fix specific and drop-in ready, not "
    "generic advice. A clearly-drafted contract may have few or zero such "
    "issues — if so, return a short list or an empty list. Do NOT invent "
    "ambiguities, pad the list, or flag precise, standard wording. Return "
    "strict JSON only."
)

_USER_TEMPLATE = (
    'Contract:\n"""\n{text}\n"""\n\n'
    "Output JSON in this exact shape:\n"
    "{{\n"
    '  "ambiguities": [\n'
    '    {{"clause_name": "<the clause or section name>",\n'
    '     "excerpt": "<the exact ambiguous phrase, verbatim>",\n'
    '     "issue": "<what is undefined / open to interpretation and the '
    "risk it creates>\",\n"
    '     "suggestion": "<the exact sentence/clause line to ADD or substitute '
    "to remove this ambiguity — drop-in ready, specific>\",\n"
    '     "severity": "<low|medium|high|critical>"}}\n'
    "  ]\n"
    "}}\n"
    "Only list genuine ambiguities. If the contract is clearly drafted, "
    "return an empty list."
)

_VALID_SEV = {"low", "medium", "high", "critical"}


class AmbiguitySweeper:
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

    async def sweep(self, contract_text: str) -> list[ContractAmbiguity]:
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
            logger.warning("AmbiguitySweep failed: %r", exc)
            return []

        items = data.get("ambiguities") if isinstance(data, dict) else None
        if not isinstance(items, list):
            return []

        out: list[ContractAmbiguity] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            clause_name = str(item.get("clause_name") or "").strip()
            excerpt = str(item.get("excerpt") or "").strip()
            issue = str(item.get("issue") or "").strip()
            suggestion = str(item.get("suggestion") or "").strip()
            sev_raw = str(item.get("severity") or "low").strip().lower()
            if sev_raw not in _VALID_SEV:
                sev_raw = "low"
            if not issue or not (clause_name or excerpt):
                continue
            out.append(
                ContractAmbiguity(
                    clause_name=clause_name or "Unnamed clause",
                    excerpt=excerpt,
                    issue=issue,
                    suggestion=suggestion,
                    severity=RiskLevel(sev_raw),
                )
            )
        return out
