from app.contracts.analysis import ClauseType, ExtractedClause, RiskSeverity
from app.services.custom_reasoning_model import CustomReasoningModel


def _clause(text: str, clause_type: ClauseType = ClauseType.liability) -> ExtractedClause:
    return ExtractedClause(
        clause_id="c1",
        clause_type=clause_type,
        text=text,
        start_offset=0,
        end_offset=len(text),
        confidence=0.9,
    )


def test_custom_reasoner_scores_critical_triggers() -> None:
    model = CustomReasoningModel()
    finding = model.assess_clause(_clause("Vendor has unlimited liability for all losses."))
    assert finding.severity == RiskSeverity.critical
    assert finding.risk_score == 10


def test_custom_reasoner_scores_medium_for_payment_terms() -> None:
    model = CustomReasoningModel()
    finding = model.assess_clause(_clause("Payment is due net 30 days.", ClauseType.payment_terms))
    assert finding.severity == RiskSeverity.medium


def test_custom_reasoner_summary_uses_highest_score_and_severity() -> None:
    model = CustomReasoningModel()
    low = model.assess_clause(_clause("Standard confidentiality obligations apply.", ClauseType.confidentiality))
    critical = model.assess_clause(_clause("Provider may terminate at sole discretion with unlimited liability."))
    summary = model.summarize([low, critical])
    assert summary.overall_score == 10
    assert summary.highest_severity == RiskSeverity.critical
    assert summary.findings_count == 2
