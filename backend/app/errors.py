from enum import Enum


class ErrorCode(str, Enum):
    policy_violation = "policy_violation"
    request_validation_error = "request_validation_error"
    upload_rejected = "upload_rejected"
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
