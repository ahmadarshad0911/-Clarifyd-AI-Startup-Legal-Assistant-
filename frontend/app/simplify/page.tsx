"use client";

import { FormEvent, useState } from "react";

import { DraftPicker } from "../../components/common/draft-picker";
import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { SimplifyResponse } from "../../lib/contracts";
import { useToast } from "../../lib/toast";

export default function SimplifyPage() {
  const { client } = useAuth();
  const { push } = useToast();
  const [draftId, setDraftId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SimplifyResponse | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draftId.trim()) return;
    setBusy(true);
    try {
      const r = await client.simplify(draftId.trim());
      setResult(r);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Simplify failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <section className="card">
        <h2>Simplify clauses</h2>
        <p className="muted">Strip legalese; surface key terms per clause.</p>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <DraftPicker value={draftId} onChange={setDraftId} />
          <button type="submit" disabled={busy || !draftId.trim()}>
            {busy ? "Simplifying…" : "Simplify"}
          </button>
        </form>
      </section>

      {result && (
        <section className="card">
          <h3>Plain-English clauses</h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>{result.disclaimer}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {result.clauses.map((c) => (
              <article key={c.finding_id} className="card" style={{ padding: "0.7rem" }}>
                <strong>{c.clause_name}</strong>
                <p>{c.plain_english}</p>
                {c.key_terms.length > 0 && (
                  <p className="muted" style={{ fontSize: "0.85rem" }}>
                    key terms: {c.key_terms.join(", ")}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
