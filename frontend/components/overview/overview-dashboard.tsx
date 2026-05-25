"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { AnalyzeContractResponse, ClauseFinding } from "../../lib/contracts";
import { listRecent, type RecentDraft } from "../../lib/recent";

type Props = {
  analysis: AnalyzeContractResponse | null;
  fileName: string | null;
};

const ACTIONS = [
  { href: "/", label: "Upload", helper: "Start a new analysis", icon: "U" },
  { href: "/reviews", label: "Review", helper: "Queue and decisions", icon: "R" },
  { href: "/exports", label: "Export", helper: "Generate report", icon: "E" },
];

const RISK_ORDER: Array<ClauseFinding["risk_level"]> = [
  "critical",
  "high",
  "medium",
  "low",
];

function timeAgo(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} d ago`;
}

function toStatus(findingsCount: number): string {
  return findingsCount > 0 ? "Analyzed" : "Processing";
}

export function OverviewDashboard({ analysis, fileName }: Props) {
  const [recent, setRecent] = useState<RecentDraft[]>([]);

  useEffect(() => {
    setRecent(listRecent());
  }, []);

  const riskCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    (analysis?.findings ?? []).forEach((finding) => {
      if (finding.risk_level in counts) {
        counts[finding.risk_level as keyof typeof counts] += 1;
      }
    });
    return counts;
  }, [analysis]);

  const totalFindings = Object.values(riskCounts).reduce((sum, value) => sum + value, 0);
  const currentDraftName = fileName ?? recent[0]?.file_name ?? "No draft yet";
  const currentStatus = analysis ? "Analyzing" : recent[0] ? toStatus(recent[0].findings_count) : "Awaiting upload";

  return (
    <section className="overview-grid">
      <div className="card overview-hero">
        <div className="overview-hero-head">
          <div>
            <div className="eyebrow">Current draft</div>
            <h1>{currentDraftName}</h1>
            <p className="muted">{currentStatus}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const node = document.getElementById("upload-card");
              node?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Continue analysis
          </button>
        </div>
        <div className="kpi-row">
          <div className="kpi-card">
            <div className="kpi-label">Risk items</div>
            <div className="kpi-value">{analysis?.summary.findings_count ?? totalFindings}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Pending reviews</div>
            <div className="kpi-value">{analysis ? Math.max(0, analysis.summary.findings_count - 3) : 0}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Exports</div>
            <div className="kpi-value">{recent.length}</div>
          </div>
        </div>
      </div>

      <div className="card overview-recent">
        <header className="section-head">
          <h2>Recent drafts</h2>
          <span className="muted">stored locally · last 8</span>
        </header>
        {!recent.length ? (
          <p className="muted">No drafts yet. Upload a contract to begin.</p>
        ) : (
          <ul className="recent-list">
            {recent.map((draft) => (
              <li key={draft.draft_id}>
                <span className="draft-id">{draft.draft_id.slice(0, 12)}…</span>
                <div className="recent-meta">
                  <strong>{draft.file_name}</strong>
                  <span className="muted">{timeAgo(draft.uploaded_at)}</span>
                </div>
                <span className={`pill pill-${draft.highest_risk}`}>{toStatus(draft.findings_count)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card overview-insights">
        <header className="section-head">
          <h2>Risk distribution</h2>
          <span className="muted">{totalFindings} total</span>
        </header>
        <div className="mini-chart">
          {RISK_ORDER.map((level) => {
            const value = riskCounts[level];
            return (
              <div key={level} className="mini-row">
                <span className={`pill pill-${level}`}>{level}</span>
                <div className="mini-bar">
                  <span style={{ width: totalFindings ? `${(value / totalFindings) * 100}%` : "6%" }} />
                </div>
                <span className="mini-value">{value}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card overview-actions">
        <header className="section-head">
          <h2>Quick actions</h2>
          <span className="muted">Jump to a workflow</span>
        </header>
        <div className="action-grid">
          {ACTIONS.map((action) => (
            <Link key={action.label} href={action.href} className="action-card">
              <div className="action-icon" aria-hidden>
                {action.icon}
              </div>
              <div>
                <strong>{action.label}</strong>
                <p className="muted">{action.helper}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
