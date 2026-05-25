from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)


# Lemma-style stems so morphological variants count once each.
# "agreement/agree" both hit, "indemnify/indemnification" both hit.
_CONTRACT_STEMS = (
    "agreement",
    "party",
    "parties",
    "hereinafter",
    "hereby",
    "herein",
    "whereas",
    "indemnif",
    "liabilit",
    "jurisdiction",
    "govern",
    "terminat",
    "breach",
    "warrant",
    "represent",
    "covenant",
    "obligation",
    "consideration",
    "confidential",
    "non-disclosure",
    "non-compete",
    "non-solicit",
    "assign",
    "execute",
    "counterpart",
    "force majeure",
    "arbitration",
    "intellectual property",
    "shall not",
    "shall be",
    "the effective date",
    "in witness whereof",
)

# Hard NO markers — if any present, almost certainly not a contract.
_NEGATIVE_MARKERS = (
    "account statement",
    "bank statement",
    "statement of account",
    "invoice number",
    "purchase order",
    "tax invoice",
    "curriculum vitae",
    "resume",
    "lorem ipsum",
    "boarding pass",
    "ticket number",
    "transaction history",
    "deposit slip",
    "credit card statement",
)


@dataclass
class DetectionResult:
    is_contract: bool
    confidence: float
    reason: str


def _heuristic(text: str) -> DetectionResult | None:
    """Cheap pre-screen. Returns None when ambiguous (needs LLM)."""
    if not text or len(text.strip()) < 40:
        return DetectionResult(False, 0.99, "Document text is too short to be a contract.")

    lower = text.lower()

    for marker in _NEGATIVE_MARKERS:
        if marker in lower:
            return DetectionResult(
                False,
                0.95,
                f"Document looks like a {marker.replace('_', ' ')}, not a contract.",
            )

    stems_hit = sum(1 for stem in _CONTRACT_STEMS if stem in lower)
    word_count = len(re.findall(r"\b\w+\b", text))

    # Strong YES — many distinct contract stems present.
    if stems_hit >= 8:
        return DetectionResult(True, 0.95, "Document contains many contract terms.")

    # Strong NO — virtually no legal vocabulary in a reasonably long document.
    if word_count > 200 and stems_hit <= 1:
        return DetectionResult(
            False,
            0.85,
            "Document has very little legal language — does not appear to be a contract.",
        )

    # Ambiguous band — defer to LLM.
    return None


_CLASSIFIER_PROMPT = (
    "You classify a document as either a CONTRACT or NOT-A-CONTRACT. "
    "A contract is any agreement, term sheet, SAFE, NDA, MSA, SOW, lease, license, "
    "employment offer, partnership/collaboration agreement, or similar legally binding "
    "document. Bank statements, invoices, resumes, articles, marketing copy, code, "
    "and emails are NOT contracts.\n\n"
    "Respond with EXACTLY one JSON object on a single line, no prose around it:\n"
    '{"is_contract": true|false, "reason": "<one short sentence>"}'
)


class ContractDetector:
    def __init__(
        self,
        *,
        client: httpx.AsyncClient,
        api_key: str | None,
        model: str,
        base_url: str,
        timeout: float = 20.0,
    ) -> None:
        self._client = client
        self._api_key = api_key or ""
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    async def classify(self, text: str) -> DetectionResult:
        heuristic = _heuristic(text)
        if heuristic is not None:
            return heuristic
        if not self._api_key:
            # No LLM available — fall back to permissive default so legitimate
            # documents aren't blocked when reasoning isn't configured.
            return DetectionResult(True, 0.5, "LLM classifier unavailable; accepted by default.")

        snippet = text[:4000]
        body = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": _CLASSIFIER_PROMPT},
                {"role": "user", "content": snippet},
            ],
            "temperature": 0,
            "max_tokens": 80,
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
            logger.warning("ContractDetector HTTP error: %r — accepting by default.", exc)
            return DetectionResult(True, 0.5, "Classifier unreachable; accepted by default.")
        if response.status_code >= 400:
            logger.warning(
                "ContractDetector HTTP %s: %s — accepting by default.",
                response.status_code,
                response.text[:200],
            )
            return DetectionResult(True, 0.5, "Classifier error; accepted by default.")
        try:
            import json as _json
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
            data = _json.loads(content) if isinstance(content, str) else content
            is_contract = bool(data.get("is_contract"))
            reason = str(data.get("reason") or "").strip()
            if not reason:
                reason = (
                    "Document looks like a contract."
                    if is_contract
                    else "Document does not look like a contract."
                )
            return DetectionResult(is_contract, 0.9, reason)
        except (KeyError, ValueError, TypeError) as exc:
            logger.warning("ContractDetector parse error: %s — accepting by default.", exc)
            return DetectionResult(True, 0.5, "Classifier parse error; accepted by default.")
