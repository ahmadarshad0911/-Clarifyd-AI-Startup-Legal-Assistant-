import pytest
from pydantic import ValidationError

from app.contracts.api import (
    API_CONTRACT_VERSION,
    AnalyzeContractRequest,
    AnalyzeContractResponse,
    ClauseFinding,
    RiskLevel,
    RiskSummary,
    UploadContractRequest,
    UploadContractResponse,
)
from app.models.contract import ProcessingStatus


def test_upload_contract_request_accepts_valid_payload() -> None:
    payload = UploadContractRequest(file_name="msa.pdf", file_size_bytes=1024)
    assert payload.file_name == "msa.pdf"
    assert payload.file_size_bytes == 1024


def test_upload_contract_request_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError):
        UploadContractRequest(file_name="msa.pdf", file_size_bytes=1024, unknown="x")


def test_upload_contract_response_has_frozen_contract_version() -> None:
    response = UploadContractResponse(draft_id="draft-1", status=ProcessingStatus.queued)
    assert response.contract_version == API_CONTRACT_VERSION


def test_analyze_contract_response_uses_frozen_schema_shape() -> None:
    summary = RiskSummary(overall_score=7, highest_risk=RiskLevel.high, findings_count=1)
    finding = ClauseFinding(
        finding_id="f1",
        clause_name="Termination",
        excerpt="Either party may terminate with 7 days notice.",
        risk_level=RiskLevel.high,
        confidence=0.91,
        explanation="Notice period is shorter than preferred baseline.",
        safer_language="Either party may terminate with 30 days notice.",
    )
    response = AnalyzeContractResponse(
        draft_id="draft-1",
        status=ProcessingStatus.ready_for_processing,
        summary=summary,
        findings=[finding],
    )
    assert response.contract_version == API_CONTRACT_VERSION
    assert response.summary.findings_count == 1


def test_analyze_contract_request_requires_non_empty_draft_id() -> None:
    with pytest.raises(ValidationError):
        AnalyzeContractRequest(draft_id="")
