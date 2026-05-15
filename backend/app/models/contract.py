from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class ProcessingStatus(str, Enum):
    queued = "queued"
    validating = "validating"
    ready_for_processing = "ready_for_processing"


class ContractDraft(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    draft_id: str = Field(default_factory=lambda: str(uuid4()))
    file_name: str = Field(min_length=1)
    file_size_bytes: int = Field(ge=1)
    status: ProcessingStatus = ProcessingStatus.queued

