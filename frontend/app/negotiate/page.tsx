"use client";

import { FormEvent, useState } from "react";

import { DraftPicker } from "../../components/common/draft-picker";
import { AppShell } from "../../components/shell/app-shell";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { NegotiateResponse } from "../../lib/contracts";
import { useToast } from "../../lib/toast";

export default function NegotiatePage() {
  const { client } = useAuth();
  const { push } = useToast();
  const [draftId, setDraftId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<NegotiateResponse | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draftId.trim()) return;
    setBusy(true);
    try {
      const r = await client.negotiate(draftId.trim());
      setResult(r);
      push(`${r.suggestions.length} suggestion(s)`, "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Negotiate failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <section className="card">
        <h2>Negotiation suggestions</h2>
        <p className="muted">Counter-language + fallback per flagged clause.</p>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <DraftPicker value={draftId} onChange={setDraftId} />
          <button type="submit" disabled={busy || !draftId.trim()}>
            {busy ? "Generating…" : "Generate"}
          </button>
        </form>
      </section>

      {result && (
        <section className="card">
          <h3>Suggestions</h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>{result.disclaimer}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {result.suggestions.map((s) => (
              <article key={s.finding_id} className="card" style={{ padding: "0.7rem" }}>
                <header style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{s.clause_name}</strong>
                  <span className={`pill-${s.risk_level}`}>{s.risk_level}</span>
                </header>
                <p>
                  <strong>Counter:</strong> {s.counter_language}
                </p>
                {s.fallback_position && (
                  <p className="muted">
                    <strong>Fallback:</strong> {s.fallback_position}
                  </p>
                )}
                <p className="muted" style={{ fontSize: "0.85rem" }}>{s.rationale}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
