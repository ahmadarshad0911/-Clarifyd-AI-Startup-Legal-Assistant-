from __future__ import annotations

import json
import re
import time
from uuid import uuid4

from app.contracts.analysis import AnalysisSummary, ClauseRiskFinding, ClauseType, ExtractedClause, RiskSeverity


class CustomReasoningModel:
    _SEVERITY_RANK: dict[RiskSeverity, int] = {
        RiskSeverity.low: 1,
        RiskSeverity.medium: 2,
        RiskSeverity.high: 3,
        RiskSeverity.critical: 4,
    }

    # Ordered by priority — first hit wins. Broad lexicon so most real clauses get
    # categorized; only truly content-free fragments remain uncategorized.
    _CATEGORY_LEXICON: tuple[tuple[ClauseType, tuple[str, ...]], ...] = (
        (ClauseType.indemnity, ("indemnif", "hold harmless", "defend", "save and hold")),
        (ClauseType.liability, (
            "liability", "liable", "damages", "limitation of liab", "cap on", "aggregate liability",
            "consequential", "incidental", "punitive",
        )),
        (ClauseType.data_protection, (
            "data protection", "personal data", "privacy", "gdpr", "ccpa", "hipaa", "process data",
            "data subject", "controller", "processor",
        )),
        (ClauseType.confidentiality, (
            "confidential", "non-disclosure", "nda", "trade secret", "proprietary information",
        )),
        (ClauseType.ip_ownership, (
            "intellectual property", "ip ownership", "license grant", "work product", "moral rights",
            "patent", "copyright", "trademark",
        )),
        (ClauseType.termination, (
            "termination", "terminate", "notice period", "expir", "cancellation", "for convenience",
            "material breach",
        )),
        (ClauseType.payment_terms, (
            "payment", "invoice", "fees", "net 30", "net-30", "net 45", "late fee", "interest",
            "remuneration", "consideration", "billing",
        )),
        (ClauseType.dispute_resolution, (
            "arbitration", "dispute", "mediation", "jams", "icc rules", "class action waiver",
        )),
        (ClauseType.governing_law, ("governing law", "jurisdiction", "venue", "choice of law")),
        (ClauseType.assignment, ("assignment", "assign", "transfer rights", "successor")),
    )

    def classify_clause(self, text: str) -> tuple[ClauseType, float]:
        """Return (category, confidence). Reusable by extractor + downstream services."""
        lower = text.lower()
        for clause_type, keywords in self._CATEGORY_LEXICON:
            if any(k in lower for k in keywords):
                return clause_type, 0.9
        return ClauseType.uncategorized, 0.5

    _SAFER_LANGUAGE: dict[ClauseType, str] = {
        ClauseType.liability: (
            "Cap each party's aggregate liability at fees paid in the prior 12 months. "
            "Carve out indemnity, IP infringement, and breaches of confidentiality."
        ),
        ClauseType.indemnity: (
            "Make indemnity mutual; limit to third-party claims arising from the "
            "indemnifier's breach or IP infringement only."
        ),
        ClauseType.termination: (
            "Either party may terminate for convenience on 30 days' written notice; "
            "fees prorated to the termination date."
        ),
        ClauseType.payment_terms: (
            "Net-30 payment terms with a 1.5% monthly cap on late-fee interest."
        ),
        ClauseType.confidentiality: (
            "Mutual confidentiality for 3 years post-termination with standard "
            "exclusions (publicly known, independently developed, lawfully obtained)."
        ),
        ClauseType.ip_ownership: (
            "Each party retains its pre-existing IP; deliverables are licensed, "
            "not assigned."
        ),
        ClauseType.data_protection: (
            "Include a DPA with defined controller/processor roles, sub-processor "
            "notice, breach-notification SLAs, and audit rights."
        ),
        ClauseType.dispute_resolution: (
            "Good-faith negotiation first, then JAMS arbitration in the customer's "
            "home state; carve out IP and injunctive relief."
        ),
        ClauseType.governing_law: (
            "Governing law and venue in the customer's principal place of business; "
            "neutral state (e.g., Delaware) acceptable if mutual."
        ),
        ClauseType.assignment: (
            "Assignment permitted with consent (not unreasonably withheld) and a "
            "carve-out for assignment to affiliates or in connection with an M&A event."
        ),
    }

    def safer_language_for(self, clause_type: ClauseType) -> str | None:
        return self._SAFER_LANGUAGE.get(clause_type)

    # ------------------------------------------------------------------
    # OpenAI-style chat completion API surface.
    #
    # Mirrors `openai.ChatCompletion.create(model=..., messages=[...],
    # response_format={"type": "json_schema", ...})`. Lets callers (provider
    # chain, tests, future swap-in of a real LLM) use the same code shape
    # whether scoring is done by rules or by GPT-4o. Internally still 100%
    # deterministic rules — no pre-trained model.
    # ------------------------------------------------------------------

    _CLAUSE_TAG_RE = re.compile(r"<clause>(.*?)</clause>", re.DOTALL)

    def _extract_clause_text(self, messages: list[dict[str, str]]) -> str:
        """Pull the clause body out of the user message, fenced as `<clause>...</clause>`.

        Falls back to the raw user-message content when the fence is absent so
        the rules engine still gets text to reason over.
        """
        user_msg = next(
            (m.get("content", "") for m in messages if m.get("role") == "user"),
            "",
        )
        match = self._CLAUSE_TAG_RE.search(user_msg)
        return (match.group(1) if match else user_msg).strip()

    def create(
        self,
        *,
        model: str = "clarifyd-rules-v1",
        messages: list[dict[str, str]],
        response_format: dict | None = None,
    ) -> dict:
        """OpenAI-compatible chat-completion entry point.

        Returns the same envelope shape as `openai.ChatCompletion.create()`:
        `{id, object, created, model, choices: [{index, message, finish_reason}],
        usage: {...}}`. `message.content` is a JSON string matching the
        reasoning schema (severity, risk_score, confidence, rationale).
        """
        clause_text = self._extract_clause_text(messages)
        if not clause_text:
            raise ValueError("No clause text found in messages.")

        clause_type, classify_conf = self.classify_clause(clause_text)
        clause = ExtractedClause(
            clause_id="adhoc",
            clause_type=clause_type,
            text=clause_text,
            start_offset=0,
            end_offset=len(clause_text),
            confidence=classify_conf,
        )
        finding = self.assess_clause(clause)
        body = {
            "severity": finding.severity.value,
            "risk_score": finding.risk_score,
            "confidence": finding.confidence,
            "rationale": finding.rationale,
            "category": clause_type.value,
        }

        prompt_tokens = sum(len(m.get("content", "").split()) for m in messages)
        completion_tokens = len(json.dumps(body).split())
        return {
            "id": f"chatcmpl-rules-{uuid4().hex[:12]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": json.dumps(body),
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }

    def assess_clause(self, clause: ExtractedClause) -> ClauseRiskFinding:
        lower = clause.text.lower()

        if any(trigger in lower for trigger in ("unlimited liability", "sole discretion", "waive all claims")):
            severity = RiskSeverity.critical
            risk_score = 10
            confidence = 0.94
            rationale = "Clause contains highly one-sided legal exposure with no practical safeguards."
        elif any(trigger in lower for trigger in ("immediate termination", "non-refundable", "penalty interest")):
            severity = RiskSeverity.high
            risk_score = 8
            confidence = 0.9
            rationale = "Clause can cause significant business or financial downside."
        elif clause.clause_type in {ClauseType.indemnity, ClauseType.liability, ClauseType.data_protection}:
            severity = RiskSeverity.high
            risk_score = 7
            confidence = 0.85
            rationale = "Clause category is commonly associated with elevated contractual risk."
        elif clause.clause_type in {ClauseType.payment_terms, ClauseType.termination, ClauseType.assignment}:
            severity = RiskSeverity.medium
            risk_score = 5
            confidence = 0.8
            rationale = "Clause should be reviewed to align with commercial expectations."
        else:
            severity = RiskSeverity.low
            risk_score = 3
            confidence = 0.73
            rationale = "No immediate high-risk signal detected by the custom reasoning rules."

        return ClauseRiskFinding(
            clause=clause,
            severity=severity,
            risk_score=risk_score,
            confidence=confidence,
            rationale=rationale,
        )

    def summarize(self, findings: list[ClauseRiskFinding]) -> AnalysisSummary:
        if not findings:
            return AnalysisSummary(
                overall_score=1, highest_severity=RiskSeverity.low, findings_count=0
            )
        highest_severity = max(findings, key=lambda finding: self._SEVERITY_RANK[finding.severity]).severity
        overall_score = max(finding.risk_score for finding in findings)
        return AnalysisSummary(
            overall_score=overall_score,
            highest_severity=highest_severity,
            findings_count=len(findings),
        )
