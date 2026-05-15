import pytest

from app.contracts.analysis import ClauseType, RiskSeverity
from app.services.contract_analysis import ContractAnalysisService


def _service() -> ContractAnalysisService:
    return ContractAnalysisService()


def test_extract_clauses_classifies_known_taxonomy() -> None:
    service = _service()
    text = (
        "Supplier may terminate this agreement with immediate termination rights. "
        "Payment is due net 30 from invoice date."
    )

    clauses = service.extract_clauses(text)
    clause_types = {clause.clause_type for clause in clauses}
    assert ClauseType.termination in clause_types
    assert ClauseType.payment_terms in clause_types


def test_analyze_text_returns_summary_and_findings() -> None:
    service = _service()
    text = (
        "The customer agrees to indemnify and hold harmless the supplier. "
        "Governing law shall be the laws of California."
    )

    result = service.analyze_text(text)
    assert result.summary.findings_count == len(result.findings)
    assert result.summary.overall_score >= 1
    assert len(result.clauses) == 2


def test_analyze_text_rejects_empty_content() -> None:
    service = _service()
    with pytest.raises(ValueError, match="Contract text is empty"):
        service.analyze_text("   \n\t")


def test_score_risks_flags_unlimited_liability_as_critical() -> None:
    service = _service()
    result = service.analyze_text("Vendor has unlimited liability for all indirect damages.")

    assert result.summary.highest_severity == RiskSeverity.critical
    assert result.findings[0].risk_score == 10
