from app.config import Settings
from app.services.contract_ingestion import ContractIngestionService


def _service() -> ContractIngestionService:
    settings = Settings(allowed_file_types=".pdf,.docx", max_upload_file_size=25 * 1024 * 1024)
    return ContractIngestionService(settings=settings)


def test_validate_upload_rejects_unknown_extension() -> None:
    service = _service()
    result = service.validate_upload("contract.txt", 1024)
    assert result.valid is False
    assert "Unsupported file type" in (result.reason or "")


def test_validate_upload_accepts_pdf() -> None:
    service = _service()
    result = service.validate_upload("contract.pdf", 2048)
    assert result.valid is True


def test_create_draft_sets_ready_status() -> None:
    service = _service()
    draft = service.create_draft("msa.docx", 4096)
    assert draft.file_name == "msa.docx"
    assert draft.status.value == "ready_for_processing"

