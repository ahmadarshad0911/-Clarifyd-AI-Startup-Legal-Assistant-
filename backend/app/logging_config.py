import logging
from contextvars import ContextVar

_request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id_ctx.get()
        return True


def set_request_id(value: str) -> None:
    _request_id_ctx.set(value)


def get_request_id() -> str:
    return _request_id_ctx.get()


def clear_request_id() -> None:
    _request_id_ctx.set("-")


def configure_logging(level: str) -> None:
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s [%(name)s] [req=%(request_id)s] %(message)s"))
    handler.addFilter(RequestIdFilter())
    root_logger.addHandler(handler)

