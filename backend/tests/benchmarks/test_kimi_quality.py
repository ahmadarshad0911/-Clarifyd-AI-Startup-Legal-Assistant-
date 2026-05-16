"""Live ML-style benchmark for the Kimi reasoning chain.

Skipped from the default test run (marker `benchmark`). Run explicitly:

    pytest tests/benchmarks/test_kimi_quality.py -m benchmark -v

Configurable via env vars:

    BENCH_BACKEND_URL  default http://localhost:8000
    BENCH_EMAIL        admin email (required)
    BENCH_PASSWORD     admin password (required)

The harness POSTs each ground-truth clause from `cases.yaml` to
`/analyze/text`, scores the response on detection / severity / excerpt /
suggestion / latency, and asserts the aggregate composite against the
threshold table at the bottom of the YAML.
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from statistics import mean, median

import httpx
import pytest
import yaml

CASES_FILE = Path(__file__).parent / "cases.yaml"

SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def _severity_distance(gt: str, pred: str) -> int:
    if not pred:
        return 99
    return abs(SEVERITY_RANK.get(gt.lower(), -1) - SEVERITY_RANK.get(pred.lower(), -1))


def _excerpt_overlap(ground: str, excerpt: str) -> float:
    if not excerpt:
        return 0.0
    g = {w.lower().strip(".,;:()") for w in ground.split() if len(w) > 3}
    e = {w.lower().strip(".,;:()") for w in excerpt.split() if len(w) > 3}
    return (len(g & e) / len(g)) if g else 0.0


def _keyword_hit(suggestion: str, keywords: list[str]) -> bool:
    if not suggestion:
        return False
    s = suggestion.lower()
    return any(k.lower() in s for k in keywords)


@pytest.mark.benchmark
def test_kimi_quality_benchmark() -> None:
    backend = os.environ.get("BENCH_BACKEND_URL", "http://localhost:8000")
    email = os.environ.get("BENCH_EMAIL")
    password = os.environ.get("BENCH_PASSWORD")
    if not email or not password:
        pytest.skip("BENCH_EMAIL / BENCH_PASSWORD not set — benchmark requires live admin creds")

    spec = yaml.safe_load(CASES_FILE.read_text(encoding="utf-8"))
    cases = spec["cases"]
    thresholds = spec["thresholds"]

    with httpx.Client(timeout=180.0) as http:
        r = http.post(f"{backend}/auth/login", json={"email": email, "password": password})
        assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:200]}"
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}

        rows = []
        latencies = []
        for c in cases:
            t0 = time.time()
            r = http.post(
                f"{backend}/analyze/text",
                json={"text": c["text"], "source_name": f"bench-{c['id']}.txt"},
                headers=h,
            )
            dt_ms = int((time.time() - t0) * 1000)
            latencies.append(dt_ms)
            j = r.json() if r.status_code == 200 else {}
            report = j.get("report") or {}
            loopholes = report.get("loopholes") or []
            suggestions = report.get("suggestions") or []
            lp = loopholes[0] if loopholes else {}
            sg = suggestions[0] if suggestions else {}
            rows.append(
                {
                    "id": c["id"],
                    "domain": c["domain"],
                    "detected": bool(loopholes),
                    "gt_sev": c["expected_severity"],
                    "pred_sev": (lp.get("severity") or "").lower(),
                    "sev_distance": _severity_distance(
                        c["expected_severity"], lp.get("severity") or ""
                    ),
                    "overlap": _excerpt_overlap(c["text"], lp.get("excerpt") or ""),
                    "kw_hit": _keyword_hit(sg.get("suggested_clause") or "", c["keywords"]),
                    "latency_ms": dt_ms,
                }
            )

    n = len(rows)
    detection_recall = sum(1 for r in rows if r["detected"]) / n
    sev_within_one = sum(1 for r in rows if r["sev_distance"] <= 1) / n
    sev_exact = sum(1 for r in rows if r["sev_distance"] == 0) / n
    overlap_avg = mean(r["overlap"] for r in rows if r["detected"])
    kw_hit = sum(1 for r in rows if r["kw_hit"]) / n
    valid_lat = [l for l in latencies if l > 0]
    p50 = median(valid_lat) if valid_lat else 0
    p95 = sorted(valid_lat)[int(len(valid_lat) * 0.95) - 1] if len(valid_lat) >= 2 else (valid_lat[0] if valid_lat else 0)

    composite = (
        detection_recall * 0.25
        + sev_within_one * 0.20
        + min(overlap_avg, 1.0) * 0.20
        + kw_hit * 0.20
        + (1 - min(p50 / 30000, 1.0)) * 0.15
    )

    print("\nKimi quality benchmark — per case")
    print(f"{'ID':<4} {'DOM':<10} {'GT':<8} {'PRED':<10} {'D':<2} {'OVR':<5} {'KW':<3} {'MS':<6}")
    for r in rows:
        print(
            f"{r['id']:<4} {r['domain']:<10} {r['gt_sev']:<8} {r['pred_sev']:<10} "
            f"{r['sev_distance']:<2} {r['overlap']:.2f}  {'Y' if r['kw_hit'] else 'N':<3} {r['latency_ms']:<6}"
        )
    print()
    print(f"detection_recall       = {detection_recall:.2f}   (threshold {thresholds['detection_recall']})")
    print(f"severity_exact         = {sev_exact:.2f}")
    print(f"severity_within_one    = {sev_within_one:.2f}   (threshold {thresholds['severity_within_one']})")
    print(f"excerpt_overlap_avg    = {overlap_avg:.2f}   (threshold {thresholds['excerpt_overlap_avg']})")
    print(f"suggestion_keyword_hit = {kw_hit:.2f}   (threshold {thresholds['suggestion_keyword_hit']})")
    print(f"latency p50 / p95      = {int(p50)} / {int(p95)} ms   (p50 threshold {thresholds['latency_p50_ms']})")
    print(f"composite              = {composite:.3f}   (threshold {thresholds['composite']})")

    # Soft asserts so all failures surface together rather than first-one-wins.
    failures: list[str] = []
    if detection_recall < thresholds["detection_recall"]:
        failures.append(f"detection_recall {detection_recall:.2f} < {thresholds['detection_recall']}")
    if sev_within_one < thresholds["severity_within_one"]:
        failures.append(f"severity_within_one {sev_within_one:.2f} < {thresholds['severity_within_one']}")
    if overlap_avg < thresholds["excerpt_overlap_avg"]:
        failures.append(f"excerpt_overlap_avg {overlap_avg:.2f} < {thresholds['excerpt_overlap_avg']}")
    if kw_hit < thresholds["suggestion_keyword_hit"]:
        failures.append(f"suggestion_keyword_hit {kw_hit:.2f} < {thresholds['suggestion_keyword_hit']}")
    if p50 > thresholds["latency_p50_ms"]:
        failures.append(f"latency_p50_ms {int(p50)} > {thresholds['latency_p50_ms']}")
    if composite < thresholds["composite"]:
        failures.append(f"composite {composite:.3f} < {thresholds['composite']}")
    assert not failures, " · ".join(failures)
