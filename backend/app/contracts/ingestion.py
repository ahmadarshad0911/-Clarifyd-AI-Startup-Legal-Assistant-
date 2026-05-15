from typing import Protocol

from pydantic import BaseModel, ConfigDict

from app.models.contract import ContractDraft


class UploadValidationResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    valid: bool
    reason: str | None = None


class IngestionContract(Protocol):
    def validate_upload(self, file_name: str, file_size_bytes: int) -> UploadValidationResult: ...

    def create_draft(self, file_name: str, file_size_bytes: int) -> ContractDraft: ...

