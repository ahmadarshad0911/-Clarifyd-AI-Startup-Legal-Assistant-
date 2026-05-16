import logging
import re
from contextvars import ContextVar

_request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

# Mask emails in log messages: ada@example.com → a***@example.com.
# Stops casual log-aggregator leaks of PII (audit log still has full email).
_EMAIL_RE = re.compile(r"([a-zA-Z0-9])[a-zA-Z0-9._%+-]+(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})")


def _redact(text: str) -> str:
    return _EMAIL_RE.sub(r"\1***\2", text)


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id_ctx.get()
        # Redact emails in formatted message + args.
        if isinstance(record.msg, str):
            record.msg = _redact(record.msg)
        if record.args:
            try:
                record.args = tuple(
                    _redact(a) if isinstance(a, str) else a for a in record.args
                )
            except Exception:
                pass
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

