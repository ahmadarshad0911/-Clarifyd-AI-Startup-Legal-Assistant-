from __future__ import annotations

import json

from app.contracts.analysis import ExtractedClause
from app.services.custom_reasoning_model import CustomReasoningModel
from app.services.reasoning.prompts import build_clause_assessment_prompt
from app.services.reasoning.provider import ClauseAssessment, ReasoningProvider


class RulesBasedProvider(ReasoningProvider):
    """Deterministic fallback. Routes through the OpenAI-style
    `CustomReasoningModel.create()` so the rules engine and a live LLM
    share the exact same call shape (system+user messages → JSON envelope).
    """

    name = "rules"
    model = "rules-v1"

    def __init__(self, model_name: str = "rules-v1") -> None:
        self._impl = CustomReasoningModel()
        self.model = model_name

    async def assess_clause(self, clause: ExtractedClause) -> ClauseAssessment:
        system, user = build_clause_assessment_prompt(clause)
        completion = self._impl.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        body = json.loads(completion["choices"][0]["message"]["content"])
        return ClauseAssessment(
            severity=body["severity"],
            risk_score=body["risk_score"],
            confidence=body["confidence"],
            rationale=body["rationale"],
        )
