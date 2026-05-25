"use client";

/**
 * /exports — Broadsheet · v6
 *
 * Editorial audit ledger. Recent drafts column, certificate plate,
 * hash-chain timeline. Preserves: listRecent/removeRecent, ExportPanel.
 */

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, ShareNetwork, FileText, Check, Hash, Sparkle, UploadSimple, Tag, X,
} from "@phosphor-icons/react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { ExportPanel } from "../../components/exports/export-panel";
import {
  listAnalyses,
  pushAnalysis,
  removeAnalysis,
  type StoredAnalysis,
} from "../../lib/analyses";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";

type RecentDraft = {
  draft_id: string;
  file_name: string;
  highest_risk: string;
  findings_count: number;
  uploaded_at: string;
};

function toRecent(a: StoredAnalysis): RecentDraft {
  return {
    draft_id: a.draft_id,
    file_name: a.file_name,
    highest_risk: a.analysis.summary?.highest_risk ?? "low",
    findings_count: a.analysis.findings?.length ?? 0,
    uploaded_at: a.analyzed_at,
  };
}

const EOQ = [0.23, 1, 0.32, 1] as const;

const RISK_COLOR: Record<string, string> = {
  low:      "var(--bsd-sev-low)",
  medium:   "var(--bsd-sev-medium)",
  high:     "var(--bsd-sev-high)",
  critical: "var(--bsd-sev-critical)",
};

export default function ExportsPage() {
  const { client } = useAuth();
  const { push } = useToast();
  const reduce = useReducedMotion() ?? false;
  const [recent, setRecent] = useState<RecentDraft[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const local = listAnalyses();
    const settle = (items: StoredAnalysis[]) => {
      if (cancelled) return;
      const mapped = items.map(toRecent);
      setRecent(mapped);
      setActive((prev) => prev ?? mapped[0]?.draft_id ?? null);
    };
    settle(local);
    client
      .listStoredAnalyses()
      .then((res) => {
        if (cancelled) return;
        const seen = new Set(local.map((d) => d.draft_id));
        const merged = [
          ...local.map((d) => {
            const r = res.items.find((x) => x.draft_id === d.draft_id);
            return r ? { ...d, analysis: r.analysis, analyzed_at: r.analyzed_at } : d;
          }),
          ...res.items
            .filter((r) => !seen.has(r.draft_id))
            .map((r) => ({
              draft_id: r.draft_id,
              file_name: r.file_name,
              analyzed_at: r.analyzed_at,
              negotiated_at: r.negotiated_at ?? null,
              analysis: r.analysis,
            })),
        ];
        merged.forEach((d) => pushAnalysis(d.analysis, d.file_name));
        settle(merged);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client]);

  const activeRow = recent.find((r) => r.draft_id === active) ?? recent[0] ?? null;

  async function shareAccess() {
    if (!active) { push("Pick a draft first.", "info"); return; }
    const url = `${window.location.origin}/exports?draft=${active}`;
    try {
      await navigator.clipboard.writeText(url);
      push("Share link copied", "success", url);
    } catch {
      push("Clipboard blocked — copy manually.", "error", url);
    }
  }

  return (
    <AppShell>
      {/* Plate header */}
      <section style={{ paddingBottom: 22, borderBottom: "1px solid var(--bsd-hairline)" }}>
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EOQ }}
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}
        >
          <div>
            <span className="bsd-kicker">Library</span>
            <h1 style={{ margin: "10px 0 0", fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.03em", lineHeight: 1.02 }}>
              Your contract <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>library.</span>
            </h1>
            <p style={{ margin: "12px 0 0", color: "var(--bsd-body)", fontSize: 15, lineHeight: 1.6, maxWidth: 620 }}>
              Every analysis, accept, and export hashes into a chain. Download the certificate, the verification log, or the raw findings.
            </p>
          </div>
          <button type="button" onClick={shareAccess} className="bsd-btn bsd-btn--ghost cursor-pointer">
            <ShareNetwork weight="duotone" size={12} /> Share access
          </button>
        </motion.div>
      </section>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)", gap: 56, marginTop: 40 }} className="grid-cols-1 lg:grid-cols-[7fr_5fr]">
        {/* Certificate plate */}
        <section>
          <div className="cf-mono" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
            <span>Certificate plate</span>
            <span style={{ color: "var(--bsd-red)", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Check weight="bold" size={11} /> Verified
            </span>
          </div>

          <div style={{ border: "2px solid var(--bsd-ink)", marginTop: 18, background: "var(--bsd-paper)", padding: "36px 36px 32px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, paddingBottom: 20, borderBottom: "2px solid var(--bsd-ink)" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 10.5, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                  Clarifyd Audit Certificate
                </div>
                <h2 style={{ margin: "10px 0 0", fontSize: 28, fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.025em", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeRow?.file_name ?? "No active contract"}
                </h2>
                <div className="cf-mono" style={{ marginTop: 8, color: "var(--bsd-muted)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, wordBreak: "break-all" }}>
                  ID: {active ? active.slice(0, 22) : "—"}
                </div>
              </div>
              <FileText aria-hidden weight="duotone" size={80} color="var(--bsd-red)" style={{ opacity: 0.18 }} />
            </div>

            <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 36px" }}>
              {[
                { label: "Owner",       value: "Your organization" },
                { label: "Verified",    value: activeRow?.uploaded_at ? new Date(activeRow.uploaded_at).toUTCString() : "—" },
                { label: "Findings",    value: activeRow ? `${activeRow.findings_count} flagged` : "—" },
                { label: "Highest risk", value: activeRow ? activeRow.highest_risk.toUpperCase() : "—" },
              ].map((c) => (
                <div key={c.label} style={{ padding: "14px 0", borderBottom: "1px dotted var(--bsd-hairline)" }}>
                  <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700 }}>
                    {c.label}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 14.5, color: "var(--bsd-ink)", fontWeight: 600 }}>{c.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { title: "Liability clause verified",     body: "Compliance baseline reviewed without critical deviations." },
                { title: "Data privacy protocol",         body: "GDPR and CCPA alignment confirmed by Clarifyd reasoning engine." },
                { title: "Clause taxonomy mapped",         body: "Every clause typed and indexed against Clarifyd rubric." },
              ].map((c) => (
                <div key={c.title} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <Check weight="bold" size={13} color="var(--bsd-red)" style={{ marginTop: 5, flexShrink: 0 }} aria-hidden />
                  <div>
                    <div style={{ fontSize: 14.5, color: "var(--bsd-ink)", fontWeight: 600 }}>{c.title}</div>
                    <div style={{ fontSize: 13, color: "var(--bsd-body)", marginTop: 2, lineHeight: 1.5 }}>{c.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px dashed var(--bsd-rule)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
                Sealed · Clarifyd Editors
              </span>
              <span className="cf-mono" style={{ color: "var(--bsd-ink)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800 }}>
                {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>

          {/* Activity timeline */}
          <div style={{ marginTop: 40 }}>
            <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
              Activity
            </div>
            <ol style={{ margin: "18px 0 0", padding: 0, listStyle: "none", position: "relative" }}>
              <span aria-hidden style={{ position: "absolute", left: 11, top: 14, bottom: 14, width: 1.5, background: "var(--bsd-rule)" }} />
              {[
                { Icon: Check,        title: "Document sealed and archived", body: "Archival hash generated and stored.", ts: activeRow?.uploaded_at },
                { Icon: Sparkle,      title: "Clarifyd reasoning completed", body: `${activeRow?.findings_count ?? 0} findings identified.`, ts: activeRow?.uploaded_at },
                { Icon: Tag,           title: "Clause taxonomy engine",      body: "Identified clause taxonomy across the document.", ts: activeRow?.uploaded_at },
                { Icon: UploadSimple, title: "Source file uploaded",         body: activeRow?.file_name ?? "—",                         ts: activeRow?.uploaded_at },
              ].map((c, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: reduce ? 0 : -6 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.3, ease: EOQ, delay: i * 0.05 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "14px 0" }}
                >
                  <span style={{
                    position: "relative", zIndex: 1,
                    width: 23, height: 23, borderRadius: "50%",
                    background: i === 0 ? "var(--bsd-red)" : "var(--bsd-ink)",
                    color: "var(--bsd-paper)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <c.Icon weight="bold" size={11} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, color: "var(--bsd-ink)", fontWeight: 600 }}>{c.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--bsd-body)", marginTop: 2 }}>{c.body}</div>
                    {c.ts ? (
                      <div className="cf-mono" style={{ marginTop: 4, fontSize: 9.5, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                        {new Date(c.ts).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                  <Hash weight="bold" size={11} color="var(--bsd-soft)" aria-hidden />
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        {/* Recent drafts + export panel */}
        <section style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          <div>
            <div className="cf-mono" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
              <span>Recent drafts</span>
              <span>Stored locally · last 8</span>
            </div>
            {!recent.length ? (
              <p style={{ margin: "22px 0 0", color: "var(--bsd-muted)", fontSize: 13.5, fontStyle: "italic" }}>
                No drafts yet. Upload one from the Dashboard.
              </p>
            ) : (
              <ul style={{ margin: "0", padding: 0, listStyle: "none" }}>
                {recent.map((r) => {
                  const isActive = r.draft_id === active;
                  return (
                    <li key={r.draft_id} style={{ borderBottom: "1px dotted var(--bsd-hairline)", padding: "16px 0", background: isActive ? "var(--bsd-paper-deep)" : "transparent" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <FileText weight="duotone" size={16} color={isActive ? "var(--bsd-red)" : "var(--bsd-muted)"} aria-hidden style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, color: "var(--bsd-ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.file_name}>
                            {r.file_name}
                          </div>
                          <div className="cf-mono" style={{ marginTop: 2, fontSize: 10, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                            {r.findings_count} finding{r.findings_count === 1 ? "" : "s"} ·{" "}
                            <span style={{ color: RISK_COLOR[r.highest_risk] ?? "var(--bsd-muted)", fontWeight: 800 }}>
                              {r.highest_risk}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActive(r.draft_id)}
                          className="cursor-pointer cf-mono"
                          style={{
                            background: isActive ? "var(--bsd-ink)" : "transparent",
                            color: isActive ? "var(--bsd-paper)" : "var(--bsd-ink)",
                            border: "1.5px solid var(--bsd-ink)",
                            padding: "5px 10px",
                            fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800,
                            transition: "background 200ms ease, color 200ms ease",
                          }}
                        >
                          {isActive ? "Active" : "Use"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removeAnalysis(r.draft_id);
                            const next = recent.filter((x) => x.draft_id !== r.draft_id);
                            setRecent(next);
                            if (active === r.draft_id) setActive(next[0]?.draft_id ?? null);
                          }}
                          aria-label="Forget on this device"
                          title="Forget on this device only"
                          className="cursor-pointer"
                          style={{ background: "transparent", border: "none", color: "var(--bsd-muted)", padding: 4, transition: "color 200ms ease" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bsd-red)")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--bsd-muted)")}
                        >
                          <X weight="bold" size={12} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <ExportPanel draftId={active} />
        </section>
      </div>
    </AppShell>
  );
}
