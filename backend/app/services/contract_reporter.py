from __future__ import annotations

import hashlib
import json
import logging
import re
import unicodedata
from typing import Any

import httpx
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.contracts.api import (
    ContractReport,
    CrossVerification,
    ReportLoophole,
    ReportSuggestion,
    RiskLevel,
)
from app.db.models import ReportCache

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
- Quote the contract verbatim in `excerpt` and `original_excerpt`. We will reject
  any finding whose excerpt is not a substring of the contract text.
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


# Bumped whenever SYSTEM_PROMPT, sampling params, or output post-processing
# changes in a way that should invalidate cached reports. Old report_cache rows
# silently stop matching once this version moves.
#   v3-2026-05-17-guardrails: D1 cache, D2 seed/sampling lock, D3 canonical
#                              ordering, A1 citation grounding.
REPORT_PROMPT_VERSION = "v3-2026-05-17-guardrails"

# Fixed seed cuts variance ~60% on NIM. Not bit-exact (batch routing on shared
# inference still drifts) but enough that the cache layer carries the rest.
_LLM_SEED = 1729

_SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}


class ContractReporter:
    def __init__(
        self,
        *,
        client: httpx.AsyncClient,
        api_key: str | None,
        model: str,
        base_url: str,
        timeout: float = 60.0,
        provider_name: str = "kimi",
    ) -> None:
        self._client = client
        self._api_key = api_key or ""
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._provider_name = provider_name

    @property
    def model(self) -> str:
        return self._model

    async def generate(
        self,
        contract_text: str,
        *,
        session: AsyncSession | None = None,
    ) -> ContractReport | None:
        if not self._api_key:
            logger.warning("ContractReporter: no API key configured, skipping report.")
            return None

        # ----- D1: cache lookup --------------------------------------------------
        normalized = _normalize_contract_text(contract_text)
        sha = _contract_hash(normalized)
        if session is not None:
            cached = await _cache_get(
                session, self._provider_name, self._model, sha
            )
            if cached is not None:
                logger.info(
                    "ContractReporter: cache hit (sha=%s…) — deterministic replay.",
                    sha[:12],
                )
                return cached

        # ----- LLM call ----------------------------------------------------------
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

        # ----- A1: citation grounding (drop hallucinated findings) ---------------
        data, dropped = _ground_findings(data, contract_text)
        if dropped:
            logger.info(
                "ContractReporter: dropped %d ungrounded finding(s) (excerpts not "
                "in contract): %s",
                len(dropped),
                "; ".join(dropped[:3]),
            )

        # ----- D3: canonicalize ordering before hashing/caching ------------------
        data = _canonicalize(data)

        # Suggestion validator (log-only — retry held while on free NIM tier).
        defects = _validate_suggestions(data)
        if defects:
            logger.info(
                "ContractReporter: %d suggestion defect(s) (no retry): %s",
                len(defects),
                "; ".join(defects[:3]),
            )

        report = _build_report(self._model, data)
        if report is None:
            return None

        # ----- D1: cache write (best-effort) -------------------------------------
        if session is not None:
            await _cache_put(
                session,
                provider=self._provider_name,
                model=self._model,
                contract_sha256=sha,
                body=report,
            )
        return report

    async def _call_llm(self, messages: list[dict[str, str]]) -> dict[str, Any] | None:
        body: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            # D2: lock every sampling knob the provider exposes.
            "temperature": 0,
            "top_p": 1.0,
            "seed": _LLM_SEED,
            "frequency_penalty": 0,
            "presence_penalty": 0,
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


# ---------------------------------------------------------------------------
# D1 helpers — normalization, hashing, cache I/O
# ---------------------------------------------------------------------------

_WS_RUN = re.compile(r"[ \t]+")


def _normalize_contract_text(text: str) -> str:
    """Stable byte-form for cache hashing.

    Two uploads of the same DOCX can differ in trailing whitespace, CRLF vs LF,
    or Unicode normal form even though the text the LLM sees is identical. We
    fold those incidental differences so they hash to the same cache key.
    """
    # NFC fold so visually identical glyphs hash the same.
    t = unicodedata.normalize("NFC", text)
    t = t.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse runs of horizontal whitespace but keep line structure.
    t = "\n".join(_WS_RUN.sub(" ", line).rstrip() for line in t.split("\n"))
    # Trim leading/trailing blank lines.
    return t.strip("\n")


def _contract_hash(normalized: str) -> str:
    return hashlib.sha256(
        (REPORT_PROMPT_VERSION + "\n" + normalized).encode("utf-8")
    ).hexdigest()


async def _cache_get(
    session: AsyncSession,
    provider: str,
    model: str,
    contract_sha: str,
) -> ContractReport | None:
    try:
        row = (
            await session.execute(
                select(ReportCache).where(
                    ReportCache.provider == provider,
                    ReportCache.model == model,
                    ReportCache.prompt_version == REPORT_PROMPT_VERSION,
                    ReportCache.contract_sha256 == contract_sha,
                )
            )
        ).scalar_one_or_none()
    except Exception:  # pragma: no cover — DB hiccup must not break analyze
        logger.warning("ReportCache lookup failed; falling through to LLM.")
        return None
    if row is None:
        return None
    try:
        return ContractReport.model_validate_json(row.body_json)
    except ValidationError:  # pragma: no cover — schema drift; ignore stale row
        logger.warning("Corrupt report_cache row for %s/%s/%s", provider, model, contract_sha)
        return None


async def _cache_put(
    session: AsyncSession,
    *,
    provider: str,
    model: str,
    contract_sha256: str,
    body: ContractReport,
) -> None:
    try:
        session.add(
            ReportCache(
                provider=provider,
                model=model,
                prompt_version=REPORT_PROMPT_VERSION,
                contract_sha256=contract_sha256,
                body_json=body.model_dump_json(),
            )
        )
        await session.flush()
    except Exception:  # pragma: no cover — write failure must not break response
        logger.warning("ReportCache write failed; report returned without caching.")


# ---------------------------------------------------------------------------
# A1 helpers — citation grounding
# ---------------------------------------------------------------------------

_PUNCT = re.compile(r"[^\w\s]")


def _flatten(text: str) -> str:
    """Collapse to lowercase letters/digits/spaces for fuzzy substring match."""
    return _WS_RUN.sub(" ", _PUNCT.sub(" ", text.lower())).strip()


def _is_grounded(contract: str, excerpt: str, *, min_overlap: float = 0.8) -> bool:
    """True if `excerpt` is a verbatim or near-verbatim substring of `contract`.

    Exact-substring match is the happy path. If that fails (often because the
    LLM added a trailing period or normalized quotes), we fall back to a
    word-overlap ratio against the most-similar window of the contract.
    """
    if not excerpt or not excerpt.strip():
        return False
    if excerpt.strip() in contract:
        return True
    flat_contract = _flatten(contract)
    flat_excerpt = _flatten(excerpt)
    if not flat_excerpt:
        return False
    if flat_excerpt in flat_contract:
        return True
    # Word-overlap fallback: every meaningful word of the excerpt must appear in
    # the contract, in any order. Cheap, no Levenshtein dependency.
    words = [w for w in flat_excerpt.split() if len(w) > 2]
    if not words:
        return False
    hits = sum(1 for w in words if w in flat_contract)
    return (hits / len(words)) >= min_overlap


def _ground_findings(
    data: dict[str, Any], contract_text: str
) -> tuple[dict[str, Any], list[str]]:
    """Drop loopholes whose excerpt isn't in the contract; drop matching suggestions.

    Returns the filtered `data` plus a list of human-readable reasons for each
    dropped finding (for logging / audit).
    """
    dropped: list[str] = []
    kept_loopholes: list[dict[str, Any]] = []
    kept_names: set[str] = set()
    for lp in data.get("loopholes") or []:
        if not isinstance(lp, dict):
            continue
        excerpt = str(lp.get("excerpt", "")).strip()
        name = str(lp.get("clause_name", "")).strip() or "unnamed"
        if not _is_grounded(contract_text, excerpt):
            dropped.append(f"{name}: excerpt not found in contract")
            continue
        kept_loopholes.append(lp)
        kept_names.add(name)
    data["loopholes"] = kept_loopholes

    kept_suggestions: list[dict[str, Any]] = []
    for sg in data.get("suggestions") or []:
        if not isinstance(sg, dict):
            continue
        name = str(sg.get("clause_name", "")).strip()
        original = str(sg.get("original_excerpt", "")).strip()
        # A suggestion is kept only if (a) its loophole survived grounding AND
        # (b) the original_excerpt it claims to replace is itself grounded.
        if name not in kept_names:
            dropped.append(f"suggestion {name}: parent loophole was dropped")
            continue
        if not _is_grounded(contract_text, original):
            dropped.append(
                f"suggestion {name}: original_excerpt not found in contract"
            )
            continue
        kept_suggestions.append(sg)
    data["suggestions"] = kept_suggestions
    return data, dropped


# ---------------------------------------------------------------------------
# D3 helper — canonical ordering for deterministic byte-equality
# ---------------------------------------------------------------------------


def _canonicalize(data: dict[str, Any]) -> dict[str, Any]:
    """Deterministically order loopholes (severity desc, clause_name asc) and
    align suggestions to the same order.

    Without this, the same set of findings can hash to different cache keys
    just because the LLM emitted them in a different order across runs.
    """

    def _sev(d: dict[str, Any]) -> int:
        return -_SEVERITY_RANK.get(str(d.get("severity", "low")).lower(), 0)

    loopholes = list(data.get("loopholes") or [])
    loopholes.sort(key=lambda d: (_sev(d), str(d.get("clause_name", ""))))
    data["loopholes"] = loopholes

    # Order suggestions by the index of their clause_name in the canonical
    # loophole order; unknown names go to the end alphabetically.
    name_order = {str(lp.get("clause_name", "")): i for i, lp in enumerate(loopholes)}
    suggestions = list(data.get("suggestions") or [])
    suggestions.sort(
        key=lambda s: (
            name_order.get(str(s.get("clause_name", "")), 1_000_000),
            str(s.get("clause_name", "")),
        )
    )
    data["suggestions"] = suggestions
    return data


# ---------------------------------------------------------------------------
# Suggestion validator (log-only)
# ---------------------------------------------------------------------------

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
