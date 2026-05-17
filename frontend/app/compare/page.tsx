"use client";

import { FormEvent, useState } from "react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { CompareResponse } from "../../lib/contracts";
import { useToast } from "../../lib/toast";

export default function ComparePage() {
  const { client } = useAuth();
  const { push } = useToast();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ids = raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length < 2) {
      push("Provide at least 2 draft ids.", "error");
      return;
    }
    setBusy(true);
    try {
      const r = await client.compare(ids);
      setResult(r);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Compare failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <section className="card">
        <h2>Compare drafts</h2>
        <p className="muted">
          Paste 2+ draft ids (comma or whitespace separated) to see clause variance.
        </p>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <textarea
            rows={3}
            placeholder="draft_id_a, draft_id_b, draft_id_c"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <button type="submit" disabled={busy}>
            {busy ? "Comparing…" : "Compare"}
          </button>
        </form>
      </section>

      {result && (
        <section className="card">
          <h3>Variances</h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            drafts: {result.draft_ids.map((d) => d.slice(0, 8)).join(" · ")}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Clause</th>
                <th style={{ textAlign: "left" }}>Present in</th>
                <th style={{ textAlign: "left" }}>Risk per draft</th>
              </tr>
            </thead>
            <tbody>
              {result.variances.map((v) => (
                <tr key={v.clause_name}>
                  <td>{v.clause_name}</td>
                  <td>{v.present_in.length}/{result.draft_ids.length}</td>
                  <td>
                    {Object.entries(v.risk_levels).map(([draft, lvl]) => (
                      <span key={draft} className={`pill-${lvl}`} style={{ marginRight: 4 }}>
                        {draft.slice(0, 6)}…:{lvl}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </AppShell>
  );
}
