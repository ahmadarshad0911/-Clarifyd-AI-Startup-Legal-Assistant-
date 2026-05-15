"use client";

import { FormEvent, useState } from "react";

import { DraftPicker } from "../../components/common/draft-picker";
import { AppShell } from "../../components/shell/app-shell";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { ComplianceCheckResponse } from "../../lib/contracts";
import { useToast } from "../../lib/toast";

const JURISDICTIONS = ["US", "UK", "EU", "APAC", "GLOBAL"] as const;

export default function CompliancePage() {
  const { client } = useAuth();
  const { push } = useToast();
  const [draftId, setDraftId] = useState("");
  const [jurisdiction, setJurisdiction] = useState<string>("GLOBAL");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ComplianceCheckResponse | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draftId.trim()) return;
    setBusy(true);
    try {
      const r = await client.complianceCheck(draftId.trim(), jurisdiction);
      setResult(r);
      push(
        r.compliant ? "No compliance flags." : `${r.flags.length} flag(s) found.`,
        r.compliant ? "success" : "info"
      );
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Check failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <section className="card">
        <h2>Compliance check</h2>
        <p className="muted">
          Run jurisdiction-aware regulation rules (GDPR, CCPA, HIPAA, FCPA) against an
          analyzed draft. Not legal advice.
        </p>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <DraftPicker value={draftId} onChange={setDraftId} />
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span className="muted">Jurisdiction</span>
            <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy || !draftId.trim()}>
            {busy ? "Checking…" : "Run check"}
          </button>
        </form>
      </section>

      {result && (
        <section className="card">
          <header style={{ display: "flex", justifyContent: "space-between" }}>
            <h3>Result · {result.jurisdiction}</h3>
            <span className={result.compliant ? "pill-low" : "pill-high"}>
              {result.compliant ? "compliant" : "flagged"}
            </span>
          </header>
          <p className="muted" style={{ fontSize: "0.85rem" }}>{result.disclaimer}</p>
          {result.flags.length === 0 ? (
            <p className="muted">No issues.</p>
          ) : (
            <ul>
              {result.flags.map((f, i) => (
                <li key={`${f.finding_id}-${i}`}>
                  <strong>{f.rule}</strong> · <code>{f.clause_name}</code> ·{" "}
                  <span className={`pill-${f.severity}`}>{f.severity}</span> — {f.rationale}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </AppShell>
  );
}
