from __future__ import annotations

import asyncio
import time


class AsyncRateLimiter:
    """Token-bucket limiter shared across concurrent provider calls.

    Paces requests to a fixed requests-per-minute budget so bursts from
    gather()-ed clause assessments don't trip the provider's 429 limit.
    One instance is shared by every provider drawing on the same account.
    """

    def __init__(self, requests_per_minute: int) -> None:
        self._capacity = float(max(1, requests_per_minute))
        self._tokens = self._capacity
        self._refill_per_sec = self._capacity / 60.0
        self._updated = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        while True:
            async with self._lock:
                now = time.monotonic()
                self._tokens = min(
                    self._capacity,
                    self._tokens + (now - self._updated) * self._refill_per_sec,
                )
                self._updated = now
                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return
                wait = (1.0 - self._tokens) / self._refill_per_sec
            await asyncio.sleep(wait)
