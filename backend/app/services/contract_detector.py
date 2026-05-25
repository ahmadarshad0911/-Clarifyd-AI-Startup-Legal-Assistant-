from __future__ import annotations

import json as _json
import logging
import re
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)


# Lemma-style stems so morphological variants count once each.
_CONTRACT_STEMS = (
    "agreement", "party", "parties", "hereinafter", "hereby", "herein",
    "whereas", "indemnif", "liabilit", "jurisdiction", "govern", "terminat",
    "breach", "warrant", "represent", "covenant", "obligation",
    "consideration", "confidential", "non-disclosure", "non-compete",
    "non-solicit", "execute", "counterpart", "force majeure",
    "arbitration", "intellectual property", "shall not", "shall be",
    "the effective date", "in witness whereof", "vendor", "client",
    "contractor", "services rendered", "compensation", "this agreement",
    "this contract", "subject to the terms",
)

# Hard NO markers — present in non-contracts.
_NEGATIVE_MARKERS = (
    "account statement", "bank statement", "statement of account",
    "curriculum vitae", "boarding pass", "transaction history",
    "deposit slip", "credit card statement", "invoice number",
    "purchase order", "tax invoice", "lorem ipsum",
    "table of contents", "abstract", "introduction", "conclusion",
    "references", "bibliography", "chapter 1", "chapter one",
)


@dataclass
class DetectionResult:
    is_contract: bool
    confidence: float
    reason: str


def _heuristic(text: str) -> DetectionResult | None:
    """Return a confident YES/NO, or None when the LLM should weigh in."""
    if not text or len(text.strip()) < 40:
        return DetectionResult(False, 0.99, "Document text is too short to be a contract.")

    lower = text.lower()
    stems_hit = sum(1 for stem in _CONTRACT_STEMS if stem in lower)
    word_count = len(re.findall(r"\b\w+\b", text))

    # Strong NO: any hard negative marker AND fewer than 4 contract stems.
    for marker in _NEGATIVE_MARKERS:
        if marker in lower and stems_hit < 4:
            article = "an" if marker[0] in "aeiou" else "a"
            return DetectionResult(
                False,
                0.95,
                f"Document looks like {article} {marker}, not a contract.",
            )

    # Strong NO: long document with virtually no legal vocabulary.
    if word_count > 300 and stems_hit <= 1:
        return DetectionResult(
            False,
            0.90,
            "Document has almost no legal language — does not appear to be a contract.",
        )

    # Strong YES: rich contract vocabulary.
    if stems_hit >= 6:
        return DetectionResult(True, 0.95, "Document contains many contract terms.")

    # Ambiguous — needs the LLM.
    return None


_CLASSIFIER_PROMPT = (
    "You classify a document as either a CONTRACT or NOT-A-CONTRACT. "
    "Contract = any binding agreement: SAFE, NDA, MSA, SOW, lease, "
    "license, employment offer, term sheet, partnership / collaboration "
    "agreement, service agreement, settlement, or similar. "
    "NOT-a-contract = bank statements, invoices, resumes, articles, "
    "marketing copy, code, README files, blog posts, emails, recipes. "
    'Respond with exactly one JSON object: '
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
        timeout: float = 8.0,
    ) -> None:
        self._client = client
        self._api_key = api_key or ""
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    async def classify(self, text: str) -> DetectionResult:
        h = _heuristic(text)
        if h is not None:
            return h
        # Ambiguous — call the LLM. Fast path: very short prompt, low
        # max_tokens. ~1-2s typical. On any failure we DEFAULT TO REJECT
        # here because the heuristic already exhausted the easy cases —
        # anything reaching the LLM is genuinely uncertain.
        if not self._api_key:
            return DetectionResult(
                False, 0.6, "Classifier unavailable; document not confirmed as a contract."
            )
        snippet = text[:3500]
        body = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": _CLASSIFIER_PROMPT},
                {"role": "user", "content": snippet},
            ],
            "temperature": 0,
            "max_tokens": 60,
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
            logger.warning("ContractDetector HTTP error: %r — rejecting on uncertainty.", exc)
            return DetectionResult(
                False, 0.55, "Could not verify document; please upload a clear contract."
            )
        if response.status_code >= 400:
            logger.warning(
                "ContractDetector HTTP %s: %s — rejecting on uncertainty.",
                response.status_code, response.text[:200],
            )
            return DetectionResult(
                False, 0.55, "Could not verify document; please upload a clear contract."
            )
        try:
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
            data = _json.loads(content) if isinstance(content, str) else content
            is_contract = bool(data.get("is_contract"))
            reason = str(data.get("reason") or "").strip()
            if not reason:
                reason = (
                    "Document accepted as a contract."
                    if is_contract
                    else "Document does not look like a contract."
                )
            return DetectionResult(is_contract, 0.9, reason)
        except (KeyError, ValueError, TypeError) as exc:
            logger.warning("ContractDetector parse error: %s — rejecting on uncertainty.", exc)
            return DetectionResult(
                False, 0.55, "Could not verify document; please upload a clear contract."
            )
