from enum import Enum


class ErrorCode(str, Enum):
    policy_violation = "policy_violation"
    request_validation_error = "request_validation_error"
    upload_rejected = "upload_rejected"
    not_a_contract = "not_a_contract"
    off_topic_question = "off_topic_question"
    internal_error = "internal_error"


class AppError(Exception):
    def __init__(
        self,
        *,
        code: ErrorCode,
        message: str,
        status_code: int = 400,
        details: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
