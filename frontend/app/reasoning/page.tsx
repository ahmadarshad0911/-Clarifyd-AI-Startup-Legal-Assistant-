"use client";

import { FormEvent, useState } from "react";

import { DraftPicker } from "../../components/common/draft-picker";
import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type {
  ReasoningEvaluateResponse,
  ReasoningGuidanceResponse,
} from "../../lib/contracts";
import { useToast } from "../../lib/toast";

export default function ReasoningPage() {
  const { client } = useAuth();
  const { push } = useToast();
  const [draftId, setDraftId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReasoningEvaluateResponse | null>(null);

  const [question, setQuestion] = useState("");
  const [findingId, setFindingId] = useState("");
  const [guidance, setGuidance] = useState<ReasoningGuidanceResponse | null>(null);

  async function onEvaluate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draftId.trim()) return;
    setBusy(true);
    try {
      const r = await client.reasoningEvaluate(draftId.trim());
      setResult(r);
      push(`Evaluated ${r.findings.length} finding(s)`, "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Evaluate failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onAsk(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draftId.trim() || !question.trim()) return;
    setBusy(true);
    try {
      const r = await client.reasoningGuidance(
        draftId.trim(),
        question.trim(),
        findingId.trim() || undefined
      );
      setGuidance(r);
      if (r.refused) push(`Refused: ${r.refusal_reason}`, "info");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Guidance failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <section className="card">
        <h2>Reasoning evaluate</h2>
        <p className="muted">
          Run the reasoning model over an analyzed draft. Returns ranked findings + founder
          guidance per clause. Decision-support only — not legal advice.
        </p>
        <form onSubmit={onEvaluate} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <DraftPicker value={draftId} onChange={setDraftId} />
          <button type="submit" disabled={busy || !draftId.trim()}>
            {busy ? "Evaluating…" : "Evaluate"}
          </button>
        </form>
      </section>

      {result && (() => {
        const risky = result.findings.filter((f) => f.risk_level !== "low");
        return (
          <section className="card">
            <header style={{ display: "flex", justifyContent: "space-between" }}>
              <h3>Risky clauses ({risky.length})</h3>
              <span className={`pill-${result.overall_risk_level}`}>
                overall {result.overall_risk_level} · {result.overall_risk_score}/100
              </span>
            </header>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              model: {result.model} · {result.disclaimer}
            </p>
            {risky.length === 0 ? (
              <p className="muted">No risky clauses surfaced.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {risky.map((f) => (
                  <article key={f.finding_id} className="card" style={{ padding: "0.85rem" }}>
                    <header style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                      <strong>{f.clause_name}</strong>
                      <span className={`pill-${f.risk_level}`}>
                        {f.risk_level} · score {f.risk_score}/100 · conf {Math.round(f.confidence * 100)}%
                      </span>
                    </header>
                    <p className="muted" style={{ fontSize: "0.8rem" }}>
                      categories: {f.categories.join(", ")}
                      {f.injection_suspected && " · ⚠ injection-suspect"}
                    </p>
                    <blockquote>{f.excerpt}</blockquote>
                    <p>{f.founder_guidance.plain_english}</p>
                    <p className="muted">
                      <strong>Why it matters:</strong> {f.founder_guidance.why_it_matters}
                    </p>
                    {f.founder_guidance.suggested_language && (
                      <p className="safer">
                        <strong>Suggested safer clause:</strong>{" "}
                        {f.founder_guidance.suggested_language}
                      </p>
                    )}
                    {f.founder_guidance.negotiation_points.length > 0 && (
                      <ul>
                        {f.founder_guidance.negotiation_points.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      <section className="card">
        <h2>Founder advisor (Q&amp;A)</h2>
        <p className="muted">
          Ask a non-jurisdictional question. Jurisdiction-specific opinions are refused.
        </p>
        <form onSubmit={onAsk} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <DraftPicker value={draftId} onChange={setDraftId} />
          <input
            type="text"
            placeholder="finding_id (optional)"
            value={findingId}
            onChange={(e) => setFindingId(e.target.value)}
          />
          <textarea
            rows={3}
            placeholder="Your question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button type="submit" disabled={busy || !draftId.trim() || !question.trim()}>
            Ask
          </button>
        </form>
        {guidance && (
          <div className="card" style={{ marginTop: "0.75rem" }}>
            <p>{guidance.answer}</p>
            {guidance.refused && (
              <p className="muted">Refused: {guidance.refusal_reason}</p>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}
