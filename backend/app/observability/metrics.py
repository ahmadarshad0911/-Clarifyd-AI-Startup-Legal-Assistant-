"""Minimal Prometheus-style counters/histograms — no external deps.

Exposes /metrics-compatible text format. Reuses a single in-process registry.
"""
from __future__ import annotations

import threading
from collections import defaultdict
from typing import Iterable

_SENSITIVE_HEADERS = {"authorization", "x-api-key", "cookie", "set-cookie", "proxy-authorization"}


class _Counter:
    def __init__(self, name: str, help_text: str) -> None:
        self.name = name
        self.help = help_text
        self._lock = threading.Lock()
        self._values: dict[tuple[tuple[str, str], ...], float] = defaultdict(float)

    def inc(self, amount: float = 1.0, **labels: str) -> None:
        key = tuple(sorted(labels.items()))
        with self._lock:
            self._values[key] += amount

    def render(self) -> list[str]:
        lines = [f"# HELP {self.name} {self.help}", f"# TYPE {self.name} counter"]
        with self._lock:
            items = list(self._values.items())
        if not items:
            lines.append(f"{self.name} 0")
            return lines
        for key, val in items:
            if key:
                label_str = ",".join(f'{k}="{_escape(v)}"' for k, v in key)
                lines.append(f"{self.name}{{{label_str}}} {val}")
            else:
                lines.append(f"{self.name} {val}")
        return lines


class _Histogram:
    """Simple summary: count + sum, no buckets. Sufficient for SLC."""

    def __init__(self, name: str, help_text: str) -> None:
        self.name = name
        self.help = help_text
        self._lock = threading.Lock()
        self._count: dict[tuple[tuple[str, str], ...], int] = defaultdict(int)
        self._sum: dict[tuple[tuple[str, str], ...], float] = defaultdict(float)

    def observe(self, value: float, **labels: str) -> None:
        key = tuple(sorted(labels.items()))
        with self._lock:
            self._count[key] += 1
            self._sum[key] += value

    def render(self) -> list[str]:
        lines = [f"# HELP {self.name} {self.help}", f"# TYPE {self.name} summary"]
        with self._lock:
            keys = set(self._count.keys()) | set(self._sum.keys())
        if not keys:
            lines.append(f"{self.name}_count 0")
            lines.append(f"{self.name}_sum 0")
            return lines
        for key in sorted(keys):
            label_str = (
                "{" + ",".join(f'{k}="{_escape(v)}"' for k, v in key) + "}" if key else ""
            )
            lines.append(f"{self.name}_count{label_str} {self._count[key]}")
            lines.append(f"{self.name}_sum{label_str} {self._sum[key]}")
        return lines


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


class _Registry:
    def __init__(self) -> None:
        self.llm_calls = _Counter("clarifyd_llm_calls_total", "Total LLM provider calls.")
        self.llm_tokens = _Counter("clarifyd_llm_tokens_total", "LLM tokens consumed.")
        self.llm_cost_usd = _Counter("clarifyd_llm_cost_usd_total", "LLM cost in USD.")
        self.reasoning_calls = _Counter(
            "clarifyd_reasoning_calls_total", "Total reasoning API evaluations."
        )
        self.reasoning_tokens = _Counter(
            "clarifyd_reasoning_tokens_total", "Reasoning tokens consumed."
        )
        self.reasoning_cost_usd = _Counter(
            "clarifyd_reasoning_cost_usd_total", "Reasoning cost in USD."
        )
        self.reasoning_latency = _Histogram(
            "clarifyd_reasoning_latency_seconds", "Reasoning evaluate latency seconds."
        )
        self.clause_extraction = _Histogram(
            "clarifyd_clause_extraction_seconds", "Clause extraction latency seconds."
        )

    def all_metrics(self) -> Iterable[object]:
        return (
            self.llm_calls,
            self.llm_tokens,
            self.llm_cost_usd,
            self.reasoning_calls,
            self.reasoning_tokens,
            self.reasoning_cost_usd,
            self.reasoning_latency,
            self.clause_extraction,
        )


METRICS = _Registry()


def record_reasoning_call(*, provider: str, model: str, tokens: int = 0, cost_usd: float = 0.0) -> None:
    METRICS.reasoning_calls.inc(provider=provider, model=model)
    if tokens:
        METRICS.reasoning_tokens.inc(amount=float(tokens), provider=provider, model=model)
    if cost_usd:
        METRICS.reasoning_cost_usd.inc(amount=cost_usd, provider=provider, model=model)


def record_reasoning_latency(seconds: float, *, provider: str, model: str) -> None:
    METRICS.reasoning_latency.observe(seconds, provider=provider, model=model)


def mask_sensitive_headers(headers: dict[str, str]) -> dict[str, str]:
    return {
        k: ("***" if k.lower() in _SENSITIVE_HEADERS else v)
        for k, v in headers.items()
    }


def render_prometheus() -> str:
    lines: list[str] = []
    for metric in METRICS.all_metrics():
        lines.extend(metric.render())  # type: ignore[attr-defined]
    return "\n".join(lines) + "\n"
