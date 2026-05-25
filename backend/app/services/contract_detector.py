from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)


# Lemma-style stems so morphological variants count once each.
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
    "vendor",
    "client",
    "contractor",
    "services",
    "compensation",
    "term",
)

# Hard NO markers — reject only when present AND legal-vocabulary is near zero.
# A real services contract can mention "invoice" or "transaction" in passing;
# we only block if the doc has fewer than 3 contract stems.
_NEGATIVE_MARKERS = (
    "account statement",
    "bank statement",
    "statement of account",
    "curriculum vitae",
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


def _heuristic(text: str) -> DetectionResult:
    if not text or len(text.strip()) < 40:
        return DetectionResult(False, 0.99, "Document text is too short to be a contract.")

    lower = text.lower()
    stems_hit = sum(1 for stem in _CONTRACT_STEMS if stem in lower)
    word_count = len(re.findall(r"\b\w+\b", text))

    # Hard NO requires BOTH a negative marker AND virtually no legal language.
    for marker in _NEGATIVE_MARKERS:
        if marker in lower and stems_hit < 3:
            article = "an" if marker[0] in "aeiou" else "a"
            return DetectionResult(
                False,
                0.90,
                f"Document looks like {article} {marker.replace('_', ' ')}, not a contract.",
            )

    # Reject long documents that have zero legal vocabulary at all.
    if word_count > 300 and stems_hit == 0:
        return DetectionResult(
            False,
            0.80,
            "Document has no legal language — does not appear to be a contract.",
        )

    # Everything else is accepted. Cheap heuristic, no LLM round trip on the
    # upload path — accepting a borderline doc is much cheaper than falsely
    # rejecting a real contract.
    return DetectionResult(True, 0.85, "Document accepted for analysis.")


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
        # client/api_key/model/base_url/timeout kept for forward-compat;
        # current implementation is heuristic-only and doesn't call the LLM.
        del client, api_key, model, base_url, timeout

    async def classify(self, text: str) -> DetectionResult:
        return _heuristic(text)
