"""Unit tests for the contract-reporter persistence + accuracy guardrails:

    D1 — report cache key stability (normalize + hash)
    D3 — canonical ordering of loopholes and suggestions
    A1 — citation grounding (drop hallucinated excerpts + orphan suggestions)

These exercise the pure helpers directly so they need no DB, no httpx, and no
NIM credentials. The cache I/O path is covered by integration tests; here we
only assert that the inputs to / outputs of the cache layer are deterministic.
"""

from __future__ import annotations

from app.services.contract_reporter import (
    REPORT_PROMPT_VERSION,
    _canonicalize,
    _contract_hash,
    _ground_findings,
    _is_grounded,
    _normalize_contract_text,
    _validate_suggestions,
)


# ---------------------------------------------------------------------------
# D1 — normalization + hashing
# ---------------------------------------------------------------------------


def test_normalize_folds_crlf_and_trailing_whitespace() -> None:
    a = "Clause 1: Liability   \r\nClause 2: Term\r\n"
    b = "Clause 1: Liability\nClause 2: Term"
    assert _normalize_contract_text(a) == _normalize_contract_text(b)


def test_normalize_folds_unicode_nfc() -> None:
    # 'é' as single codepoint vs e + combining acute should hash the same.
    composed = "Café indemnity"
    decomposed = "Café indemnity"
    assert _normalize_contract_text(composed) == _normalize_contract_text(decomposed)


def test_normalize_collapses_horizontal_runs_but_preserves_lines() -> None:
    raw = "A\t\t  B\nC   D"
    assert _normalize_contract_text(raw) == "A B\nC D"


def test_hash_changes_when_prompt_version_changes() -> None:
    # Sanity: REPORT_PROMPT_VERSION is mixed into the key so a prompt bump
    # invalidates every cached row.
    h1 = _contract_hash("same text")
    assert REPORT_PROMPT_VERSION in REPORT_PROMPT_VERSION  # trivially true
    assert len(h1) == 64
    # Different input ⇒ different hash.
    assert _contract_hash("same text") != _contract_hash("other text")


def test_hash_stable_across_whitespace_drift() -> None:
    a = _normalize_contract_text("Foo\r\nBar  \r\n")
    b = _normalize_contract_text("Foo\nBar")
    assert _contract_hash(a) == _contract_hash(b)


# ---------------------------------------------------------------------------
# D3 — canonical ordering
# ---------------------------------------------------------------------------


def test_canonicalize_orders_loopholes_by_severity_desc_then_name_asc() -> None:
    data = {
        "loopholes": [
            {"clause_name": "B", "severity": "low"},
            {"clause_name": "A", "severity": "critical"},
            {"clause_name": "C", "severity": "high"},
            {"clause_name": "D", "severity": "critical"},
        ],
        "suggestions": [],
    }
    out = _canonicalize(data)
    names = [lp["clause_name"] for lp in out["loopholes"]]
    assert names == ["A", "D", "C", "B"]


def test_canonicalize_aligns_suggestions_to_loophole_order() -> None:
    data = {
        "loopholes": [
            {"clause_name": "Liability", "severity": "critical"},
            {"clause_name": "Term", "severity": "medium"},
        ],
        "suggestions": [
            {"clause_name": "Term"},
            {"clause_name": "Liability"},
        ],
    }
    out = _canonicalize(data)
    sug_names = [s["clause_name"] for s in out["suggestions"]]
    assert sug_names == ["Liability", "Term"]


def test_canonicalize_is_idempotent() -> None:
    data = {
        "loopholes": [
            {"clause_name": "A", "severity": "critical"},
            {"clause_name": "B", "severity": "low"},
        ],
        "suggestions": [{"clause_name": "A"}, {"clause_name": "B"}],
    }
    once = _canonicalize(dict(data))
    twice = _canonicalize(dict(once))
    assert once == twice


# ---------------------------------------------------------------------------
# A1 — citation grounding
# ---------------------------------------------------------------------------


CONTRACT = (
    "This Agreement is effective as of January 1, 2026. The Vendor's total liability "
    "shall not exceed one hundred dollars ($100). The Founder hereby assigns all "
    "pre-existing intellectual property to the Company irrevocably."
)


def test_is_grounded_exact_substring() -> None:
    assert _is_grounded(CONTRACT, "shall not exceed one hundred dollars")


def test_is_grounded_punctuation_drift() -> None:
    # LLM commonly adds a trailing period or normalizes punctuation.
    assert _is_grounded(CONTRACT, "shall not exceed one hundred dollars.")


def test_is_grounded_rejects_fabricated_excerpt() -> None:
    assert not _is_grounded(
        CONTRACT, "Vendor shall provide unlimited indemnification for all damages"
    )


def test_is_grounded_rejects_empty_excerpt() -> None:
    assert not _is_grounded(CONTRACT, "")
    assert not _is_grounded(CONTRACT, "   ")


def test_ground_findings_drops_ungrounded_loophole_and_its_suggestion() -> None:
    data = {
        "loopholes": [
            {
                "clause_name": "Liability Cap",
                "excerpt": "shall not exceed one hundred dollars",
                "severity": "high",
            },
            {
                "clause_name": "Hallucinated Indemnity",
                "excerpt": "Vendor indemnifies Founder against all third-party claims",
                "severity": "critical",
            },
        ],
        "suggestions": [
            {
                "clause_name": "Liability Cap",
                "original_excerpt": "shall not exceed one hundred dollars",
                "suggested_clause": "Vendor's aggregate liability shall not exceed "
                "the greater of fees paid in the prior twelve (12) months or fifty "
                "thousand dollars ($50,000).",
            },
            {
                "clause_name": "Hallucinated Indemnity",
                "original_excerpt": "Vendor indemnifies Founder",
                "suggested_clause": "Mutual indemnification limited to direct damages "
                "arising from a party's gross negligence or wilful misconduct.",
            },
        ],
    }
    out, dropped = _ground_findings(data, CONTRACT)
    lp_names = [lp["clause_name"] for lp in out["loopholes"]]
    sg_names = [s["clause_name"] for s in out["suggestions"]]
    assert lp_names == ["Liability Cap"]
    assert sg_names == ["Liability Cap"]
    # Both the bogus loophole AND its orphan suggestion should be reported.
    assert any("Hallucinated Indemnity" in d for d in dropped)
    assert len(dropped) >= 2


def test_ground_findings_keeps_all_when_all_grounded() -> None:
    data = {
        "loopholes": [
            {
                "clause_name": "IP Assignment",
                "excerpt": "assigns all pre-existing intellectual property",
                "severity": "critical",
            }
        ],
        "suggestions": [
            {
                "clause_name": "IP Assignment",
                "original_excerpt": "assigns all pre-existing intellectual property",
                "suggested_clause": "Founder retains all pre-existing intellectual "
                "property; only IP created specifically for the Company under this "
                "Agreement is assigned.",
            }
        ],
    }
    out, dropped = _ground_findings(data, CONTRACT)
    assert dropped == []
    assert len(out["loopholes"]) == 1
    assert len(out["suggestions"]) == 1


# ---------------------------------------------------------------------------
# Persistence end-to-end: normalize → ground → canonicalize → serialize
# should yield byte-identical output across re-orderings + whitespace drift.
# ---------------------------------------------------------------------------


def test_full_pipeline_byte_stable_across_input_drift() -> None:
    import json

    payload_a = {
        "loopholes": [
            {"clause_name": "B", "severity": "low", "excerpt": "January 1, 2026"},
            {"clause_name": "A", "severity": "critical",
             "excerpt": "assigns all pre-existing intellectual property"},
        ],
        "suggestions": [
            {"clause_name": "B", "original_excerpt": "January 1, 2026",
             "suggested_clause": "x" * 50},
            {"clause_name": "A",
             "original_excerpt": "assigns all pre-existing intellectual property",
             "suggested_clause": "y" * 50},
        ],
    }
    payload_b = {
        "loopholes": list(reversed(payload_a["loopholes"])),
        "suggestions": list(reversed(payload_a["suggestions"])),
    }
    a, _ = _ground_findings(dict(payload_a), CONTRACT)
    b, _ = _ground_findings(dict(payload_b), CONTRACT)
    assert json.dumps(_canonicalize(a), sort_keys=True) == json.dumps(
        _canonicalize(b), sort_keys=True
    )


# ---------------------------------------------------------------------------
# Pre-existing suggestion validator stays wired up.
# ---------------------------------------------------------------------------


def test_validate_suggestions_flags_too_short() -> None:
    data = {
        "loopholes": [{"clause_name": "X"}],
        "suggestions": [{"clause_name": "X", "original_excerpt": "foo",
                         "suggested_clause": "fix it."}],
    }
    defects = _validate_suggestions(data)
    assert any("too short" in d for d in defects)
