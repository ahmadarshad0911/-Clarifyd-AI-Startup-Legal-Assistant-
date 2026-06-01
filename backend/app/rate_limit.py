from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Callable

from fastapi import Request

from app.errors import AppError, ErrorCode


class SlidingWindowLimiter:
    """In-process sliding-window limiter keyed by (route, ip).

    Not suitable for multi-process deployment; sufficient for SLC scope.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)

    def hit(self, key: tuple[str, str], *, limit_per_min: int, now: float | None = None) -> bool:
        if limit_per_min <= 0:
            return True
        ts = now if now is not None else time.monotonic()
        cutoff = ts - 60.0
        with self._lock:
            bucket = self._hits[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= limit_per_min:
                return False
            bucket.append(ts)
            return True


_limiter = SlidingWindowLimiter()


def rate_limit(route: str, *, limit_attr: str) -> Callable[[Request], None]:
    """Returns a FastAPI dependency that enforces a per-route per-IP limit.

    `limit_attr` names the Settings field with the per-minute cap.
    """
    from app.config import Settings, get_settings  # local import for cycle safety

    def _client_ip(request: Request) -> str:
        # Behind Cloudflare/DigitalOcean, request.client.host is the proxy IP —
        # identical for every visitor, so a per-IP limit becomes effectively
        # global. Prefer the real client IP the edge forwards.
        cf = request.headers.get("cf-connecting-ip")
        if cf:
            return cf.strip()
        xff = request.headers.get("x-forwarded-for")
        if xff:
            # Leftmost entry is the original client.
            return xff.split(",")[0].strip()
        if request.client and request.client.host:
            return request.client.host
        return "unknown"

    async def _dep(request: Request) -> None:
        settings: Settings = get_settings()
        limit = int(getattr(settings, limit_attr, 0))
        ip = _client_ip(request)
        if not _limiter.hit((route, ip), limit_per_min=limit):
            raise AppError(
                code=ErrorCode.policy_violation,
                message="Rate limit exceeded.",
                status_code=429,
            )

    return _dep


def reset_limiter_for_tests() -> None:
    """Clear in-process buckets — used by tests only."""
    with _limiter._lock:  # noqa: SLF001
        _limiter._hits.clear()  # noqa: SLF001
