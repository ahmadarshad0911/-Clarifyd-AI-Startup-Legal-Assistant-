"use client";

import { FormEvent, useState } from "react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { SearchResponse } from "../../lib/contracts";
import { useToast } from "../../lib/toast";

const RISKS = ["", "low", "medium", "high", "critical"] as const;

export default function SearchPage() {
  const { client } = useAuth();
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try {
      const r = await client.search(q.trim(), risk || undefined);
      setResult(r);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Search failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <section className="card">
        <h2>Search</h2>
        <p className="muted">Full-text search across clauses, names, and rationale.</p>
        <form onSubmit={onSubmit} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            type="search"
            placeholder="query (e.g. liability)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 240 }}
          />
          <select value={risk} onChange={(e) => setRisk(e.target.value)}>
            {RISKS.map((r) => (
              <option key={r || "any"} value={r}>
                {r || "any risk"}
              </option>
            ))}
          </select>
          <button type="submit" disabled={busy || !q.trim()}>
            {busy ? "Searching…" : "Search"}
          </button>
        </form>
      </section>

      {result && (
        <section className="card">
          <h3>{result.hits.length} hit(s) for &ldquo;{result.query}&rdquo;</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {result.hits.map((h, i) => (
              <li key={`${h.draft_id}-${h.finding_id}-${i}`} className="card" style={{ padding: "0.6rem", marginBottom: "0.5rem" }}>
                <header style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{h.clause_name}</strong>
                  <span className={`pill-${h.risk_level}`}>{h.risk_level}</span>
                </header>
                <p className="muted" style={{ fontSize: "0.8rem" }}>
                  draft {h.draft_id.slice(0, 8)}…
                </p>
                <p>{h.excerpt}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
