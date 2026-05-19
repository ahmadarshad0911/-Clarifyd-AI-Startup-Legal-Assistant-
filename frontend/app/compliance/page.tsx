"use client";

/**
 * /compliance — Broadsheet · v6
 *
 * "Regulatory desk" plate. Jurisdiction chips + draft picker → flag ledger
 * with severity tags and rationale. Preserves client.complianceCheck.
 */

import { FormEvent, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ShieldCheck, Warning, Scales } from "@phosphor-icons/react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { ComplianceCheckResponse } from "../../lib/contracts";
import { listRecent, type RecentDraft } from "../../lib/recent";
import { useToast } from "../../lib/toast";

const EOQ = [0.23, 1, 0.32, 1] as const;
const JURISDICTIONS = ["US", "UK", "EU", "APAC", "GLOBAL"] as const;
const JUR_DESC: Record<string, string> = {
  US: "California, federal, state-level",
  UK: "DPA 2018, FCA",
  EU: "GDPR, MiCA, DSA",
  APAC: "Singapore, India, AU",
  GLOBAL: "All baselines unioned",
};
const SEV_COLOR: Record<string, string> = {
  low:      "var(--bsd-sev-low)",
  medium:   "var(--bsd-sev-medium)",
  high:     "var(--bsd-sev-high)",
  critical: "var(--bsd-sev-critical)",
};

export default function CompliancePage() {
  const { client } = useAuth();
  const { push } = useToast();
  const reduce = useReducedMotion() ?? false;

  const [recent, setRecent] = useState<RecentDraft[]>([]);
  const [draftId, setDraftId] = useState("");
  const [jurisdiction, setJurisdiction] = useState<string>("GLOBAL");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ComplianceCheckResponse | null>(null);

  useEffect(() => { setRecent(listRecent()); }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draftId.trim()) return;
    setBusy(true);
    try {
      const r = await client.complianceCheck(draftId.trim(), jurisdiction);
      setResult(r);
      push(
        r.compliant ? "No compliance flags." : `${r.flags.length} flag${r.flags.length === 1 ? "" : "s"} found.`,
        r.compliant ? "success" : "info",
      );
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Check failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      {/* Plate */}
      <section style={{ paddingBottom: 22, borderBottom: "1px solid var(--bsd-hairline)" }}>
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EOQ }}
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}
        >
          <div>
            <span className="bsd-kicker">§ Regulatory desk · Volume I</span>
            <h1 style={{ margin: "10px 0 0", fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.03em", lineHeight: 1.02 }}>
              Read it against the <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>statute.</span>
            </h1>
            <p style={{ margin: "12px 0 0", color: "var(--bsd-body)", fontSize: 15, lineHeight: 1.6, maxWidth: 620 }}>
              GDPR, CCPA, HIPAA, FCPA. Pick a jurisdiction, point at a draft, and we list every clause that fails the baseline with the rule it failed against.
            </p>
          </div>
          <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>
            ◆ {result ? `${result.flags.length} flag${result.flags.length === 1 ? "" : "s"}` : "ready"}
          </span>
        </motion.div>
      </section>

      <form onSubmit={onSubmit} style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Jurisdiction picker */}
        <div>
          <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
            Article I · Jurisdiction
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 0, borderTop: "2px solid var(--bsd-ink)", borderBottom: "2px solid var(--bsd-ink)" }}>
            {JURISDICTIONS.map((j, i) => {
              const active = jurisdiction === j;
              return (
                <button
                  key={j}
                  type="button"
                  onClick={() => setJurisdiction(j)}
                  className="cursor-pointer"
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
                    padding: "20px 22px",
                    background: active ? "var(--bsd-ink)" : "transparent",
                    color: active ? "var(--bsd-paper)" : "var(--bsd-ink)",
                    border: "none",
                    borderRight: i < JURISDICTIONS.length - 1 ? `1px solid ${active ? "var(--bsd-ink)" : "var(--bsd-hairline)"}` : "none",
                    transition: "background 200ms ease, color 200ms ease",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bsd-paper-deep)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <span className="cf-mono" style={{ fontSize: 11, color: active ? "var(--bsd-red)" : "var(--bsd-muted)", letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                    {j}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: active ? "var(--bsd-paper)" : "var(--bsd-body)", lineHeight: 1.45 }}>
                    {JUR_DESC[j]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Draft + submit */}
        <div>
          <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
            Article II · Draft under review
          </div>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 18, alignItems: "end" }}>
            <div>
              <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
                Draft
              </div>
              {recent.length ? (
                <select
                  value={draftId}
                  onChange={(e) => setDraftId(e.target.value)}
                  className="bsd-input"
                  style={{ fontSize: 16, appearance: "none", cursor: "pointer" }}
                >
                  <option value="">Select a draft…</option>
                  {recent.map((r) => (
                    <option key={r.draft_id} value={r.draft_id}>{r.file_name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={draftId}
                  onChange={(e) => setDraftId(e.target.value)}
                  placeholder="draft_id (no recent drafts on file)"
                  className="bsd-input"
                  style={{ fontSize: 16, fontFamily: "Geist Mono, monospace" }}
                />
              )}
            </div>
            <button
              type="submit"
              disabled={busy || !draftId.trim()}
              className="bsd-btn cursor-pointer"
            >
              <ShieldCheck weight="duotone" size={12} />
              {busy ? "Checking…" : "Run check"}
              <ArrowRight weight="bold" size={11} />
            </button>
          </div>
        </div>
      </form>

      {/* Result */}
      {result ? (
        <motion.section
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EOQ }}
          style={{ marginTop: 56 }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", paddingBottom: 14, borderBottom: "2px solid var(--bsd-ink)" }}>
            <div>
              <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                § Verdict · {result.jurisdiction}
              </span>
              <h2 style={{ margin: "8px 0 0", fontSize: 32, fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.025em", lineHeight: 1.05 }}>
                {result.compliant
                  ? <>The draft holds. <span style={{ color: "var(--bsd-sev-low)", fontStyle: "italic", fontWeight: 600 }}>Compliant.</span></>
                  : <>The draft <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>fails {result.flags.length}</span> rule{result.flags.length === 1 ? "" : "s"}.</>}
              </h2>
            </div>
            <span
              className="cf-mono"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "8px 14px",
                border: `2px solid ${result.compliant ? "var(--bsd-sev-low)" : "var(--bsd-red)"}`,
                color: result.compliant ? "var(--bsd-sev-low)" : "var(--bsd-red)",
                fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800,
              }}
            >
              {result.compliant ? <ShieldCheck weight="duotone" size={13} /> : <Warning weight="duotone" size={13} />}
              {result.compliant ? "Compliant" : "Flagged"}
            </span>
          </div>

          {result.flags.length === 0 ? (
            <div style={{ marginTop: 22, border: "2px dashed var(--bsd-rule)", padding: 48, textAlign: "center", color: "var(--bsd-muted)" }}>
              No flagged clauses. Move along.
            </div>
          ) : (
            <ol style={{ margin: "0", padding: 0, listStyle: "none" }}>
              {result.flags.map((f, i) => (
                <motion.li
                  key={`${f.finding_id}-${i}`}
                  initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.3, ease: EOQ, delay: i * 0.03 }}
                  style={{ borderBottom: i < result.flags.length - 1 ? "1px dotted var(--bsd-hairline)" : "2px solid var(--bsd-ink)", padding: "22px 4px" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 18, alignItems: "baseline" }}>
                    <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 18, color: "var(--bsd-ink)", fontWeight: 700, letterSpacing: "-0.01em" }}>{f.rule}</span>
                        <span className="cf-mono" style={{ fontSize: 11.5, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                          on <span style={{ color: "var(--bsd-ink)", fontWeight: 800 }}>{f.clause_name}</span>
                        </span>
                      </div>
                      <p style={{ margin: "10px 0 0", fontSize: 14.5, color: "var(--bsd-body)", lineHeight: 1.6 }}>{f.rationale}</p>
                    </div>
                    <span
                      className="cf-mono"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 9px",
                        border: `1px solid ${SEV_COLOR[f.severity] ?? "var(--bsd-ink)"}`,
                        color: SEV_COLOR[f.severity] ?? "var(--bsd-ink)",
                        fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800,
                      }}
                    >
                      <Scales weight="duotone" size={10} /> {f.severity}
                    </span>
                  </div>
                </motion.li>
              ))}
            </ol>
          )}

          {result.disclaimer ? (
            <p className="cf-mono" style={{ margin: "20px 0 0", fontSize: 10, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, fontStyle: "italic" }}>
              {result.disclaimer}
            </p>
          ) : null}
        </motion.section>
      ) : null}
    </AppShell>
  );
}
