"use client";

/** Findings — Clarifyd v3 (amber + Geist + ClauseCard + HealthGauge).
 *  All business logic preserved verbatim — UI rewritten only. */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Plus,
  Trash,
  Sparkle,
  Download,
  FileText,
  Stack,
  Files,
  Scales,
} from "@phosphor-icons/react";

import { DarkAppShell } from "../../components/shell/dark-app-shell";
import { ClauseCard, ClauseData } from "../../components/clause-card";
import { HealthGauge } from "../../components/health-gauge";
import { NoticeModal, type NoticeContent } from "../../components/notice-modal";
import { RiskPill, Severity } from "../../components/risk-pill";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import {
  listAnalyses,
  pushAnalysis,
  removeAnalysis,
  type StoredAnalysis,
} from "../../lib/analyses";
import { profileContextLine } from "../../lib/founder-profile";
import type { ReportLoophole, ReportSuggestion } from "../../lib/contracts";

function verdictToScore(verdict: string, n: number): number {
  // Heuristic: critical → 22, high → 48, medium → 65, low → 85, clean → 96.
  const v = (verdict ?? "").toLowerCase();
  let base = 70;
  if (v === "critical") base = 22;
  else if (v === "high") base = 48;
  else if (v === "medium") base = 65;
  else if (v === "low") base = 85;
  // Drag down if many findings.
  return Math.max(10, Math.min(98, base - Math.min(15, n * 2)));
}

export default function FindingsPage() {
  return (
    <Suspense
      fallback={
        <DarkAppShell>
          <div style={{ color: "var(--ink-muted)" }}>Loading findings…</div>
        </DarkAppShell>
      }
    >
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { client } = useAuth();
  const { push } = useToast();
  const params = useSearchParams();

  const [docs, setDocs] = useState<StoredAnalysis[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState<Record<string, Set<number>>>({});
  const [exporting, setExporting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [notice, setNotice] = useState<NoticeContent | null>(null);
  const [exportedDoc, setExportedDoc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const local = listAnalyses();
    function settle(items: StoredAnalysis[]) {
      if (cancelled) return;
      const visible = items.filter((d) => !d.negotiated_at);
      setDocs(visible);
      const wanted = params.get("draft");
      setActiveId((wanted && visible.some((d) => d.draft_id === wanted) ? wanted : null) ?? visible[0]?.draft_id ?? null);
      setLoaded(true);
    }
    settle(local);
    client
      .listStoredAnalyses()
      .then((res) => {
        if (cancelled) return;
        const remoteById = new Map(res.items.map((r) => [r.draft_id, r]));
        const reconciled: StoredAnalysis[] = local.map((d) => {
          const r = remoteById.get(d.draft_id);
          if (!r) return d;
          // Always take analysis from remote — it may have a report the local
          // copy lacks (e.g. analysis completed after a proxy timeout).
          return {
            ...d,
            analysis: r.analysis,
            negotiated_at: r.negotiated_at ?? null,
            analyzed_at: r.analyzed_at ?? d.analyzed_at,
          };
        });
        const seen = new Set(local.map((d) => d.draft_id));
        const fresh: StoredAnalysis[] = res.items
          .filter((r) => !seen.has(r.draft_id))
          .map((r) => ({
            draft_id: r.draft_id,
            file_name: r.file_name,
            analyzed_at: r.analyzed_at,
            negotiated_at: r.negotiated_at ?? null,
            analysis: r.analysis,
          }));
        const merged = [...reconciled, ...fresh];
        // Persist fresh remote items to localStorage so next visit is instant.
        merged.forEach((d) => pushAnalysis(d.analysis, d.file_name));
        settle(merged);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [params, client]);

  const active = useMemo(() => docs.find((d) => d.draft_id === activeId) ?? null, [docs, activeId]);
  // Prefer the LLM-written report.loopholes — they ship with rewrites + a
  // founder-friendly summary. When the reporter was rate-limited or timed
  // out (common on Vercel cold starts), fall back to the per-clause
  // findings so the UI doesn't say "00 flagged" when we actually flagged
  // several clauses.
  const reportLoopholes: ReportLoophole[] = active?.analysis.report?.loopholes ?? [];
  const loopholes: ReportLoophole[] = useMemo(() => {
    if (reportLoopholes.length > 0) return reportLoopholes;
    const findings = active?.analysis.findings ?? [];
    return findings.map((f) => ({
      clause_name: f.clause_name,
      excerpt: f.excerpt,
      issue: f.explanation,
      severity: f.risk_level,
      impact: f.explanation,
    })) as ReportLoophole[];
  }, [reportLoopholes, active]);
  const reportSuggestions: ReportSuggestion[] = active?.analysis.report?.suggestions ?? [];
  const suggestions: ReportSuggestion[] = useMemo(() => {
    if (reportLoopholes.length > 0) return reportSuggestions;
    const findings = active?.analysis.findings ?? [];
    return findings.map((f) => ({
      clause_name: f.clause_name,
      original_excerpt: f.excerpt,
      suggested_clause: f.safer_language ?? f.explanation,
      rationale: f.explanation,
    })) as ReportSuggestion[];
  }, [reportLoopholes.length, reportSuggestions, active]);
  const activePicked = (active && picked[active.draft_id]) || new Set<number>();

  function deleteDoc(d: StoredAnalysis) {
    setNotice({
      kind: "warning",
      caption: "STOP PRESS · CONFIRM REMOVAL",
      headline: `Remove "${d.file_name}"?`,
      body: "This drops the analysis from your Findings tab and asks the server to soft-delete the draft. The action can't be undone from the UI.",
      primaryLabel: "Remove",
      secondaryLabel: "Cancel",
      onPrimary: async () => {
        removeAnalysis(d.draft_id);
        setDocs((prev) => {
          const next = prev.filter((x) => x.draft_id !== d.draft_id);
          if (activeId === d.draft_id) setActiveId(next[0]?.draft_id ?? null);
          return next;
        });
        try {
          await client.softDeleteDraft(d.draft_id);
          push("Removed", "success", d.file_name);
        } catch {
          push("Removed locally — server delete failed", "info");
        }
      },
    });
  }

  async function handleRegenerateReport() {
    if (!active || regenerating) return;
    setRegenerating(true);
    try {
      const res = await client.regenerateReport(active.draft_id);
      if (!res.report_generated) {
        push("AI report generation failed — check API key in backend.", "error");
        return;
      }
      // Fetch updated analysis from backend and patch local state + localStorage.
      const remote = await client.listStoredAnalyses();
      const updated = remote.items.find((r) => r.draft_id === active.draft_id);
      if (updated) {
        pushAnalysis(updated.analysis, updated.file_name);
        setDocs((prev) =>
          prev.map((d) =>
            d.draft_id === active.draft_id ? { ...d, analysis: updated.analysis } : d
          )
        );
        push("AI report generated.", "success");
      }
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Regenerate failed.", "error");
    } finally {
      setRegenerating(false);
    }
  }

  function togglePick(idx: number) {
    if (!active) return;
    setPicked((prev) => {
      const set = new Set(prev[active.draft_id] ?? []);
      if (set.has(idx)) set.delete(idx); else set.add(idx);
      return { ...prev, [active.draft_id]: set };
    });
    setExportedDoc(null);
  }
  function applyAll() {
    if (!active) return;
    setPicked((prev) => ({ ...prev, [active.draft_id]: new Set(suggestions.map((_, i) => i)) }));
  }
  function clearPicks() {
    if (!active) return;
    setPicked((prev) => ({ ...prev, [active.draft_id]: new Set() }));
  }

  function applyToText(): { revised: string; missed: string[] } | null {
    if (!active) return null;
    const original = active.analysis.extracted_text ?? "";
    if (!original) return null;
    let revised = original;
    const missed: string[] = [];
    suggestions.forEach((s, i) => {
      if (!activePicked.has(i)) return;
      const target = (s.original_excerpt || "").trim();
      const replacement = (s.suggested_clause || "").trim();
      if (!target || !replacement) { missed.push(s.clause_name); return; }
      if (revised.includes(target)) { revised = revised.replace(target, replacement); return; }
      const flex = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "i");
      if (flex.test(revised)) { revised = revised.replace(flex, replacement); return; }
      const lp = loopholes[i];
      const lt = (lp?.excerpt || "").trim();
      if (lt && revised.includes(lt)) { revised = revised.replace(lt, replacement); return; }
      missed.push(s.clause_name);
    });
    return { revised, missed };
  }

  async function exportDocument() {
    if (!active) return;
    const chosen = suggestions.filter((_, i) => activePicked.has(i));
    if (!chosen.length) { push("Pick at least one suggested clause first.", "info"); return; }
    setExporting(true);
    try {
      if (active.analysis.extracted_text) {
        const result = applyToText();
        if (result) {
          setExportedDoc(result.revised);
          if (result.missed.length) {
            push(`Applied ${chosen.length - result.missed.length}/${chosen.length}.`, "info", `Unmatched: ${result.missed.join(", ")}`);
          } else {
            push("Collaborator document ready", "success", `${chosen.length} clause${chosen.length === 1 ? "" : "s"} swapped.`);
          }
          return;
        }
      }
      const ctx = profileContextLine();
      const block = chosen.map((s, i) => `${i + 1}. CLAUSE: ${s.clause_name}\n   REPLACE: "${s.original_excerpt}"\n   WITH: ${s.suggested_clause}\n   RATIONALE: ${s.rationale}`).join("\n\n");
      const prompt = `${ctx ? ctx + "\n\n" : ""}The user reviewed "${active.file_name}" and accepted the safer clauses below. Produce the COMPLETE ultimate collaborator document.\n\nSTRICT RULES:\n- Replace ONLY the clauses listed below; reproduce every other clause exactly as written.\n- Do not paraphrase, summarize, or reorder unaffected sections.\n- Preserve original headings, numbering, and signature blocks.\n- Where a specific detail is unknown, insert [TO BE CONFIRMED — <field>].\n\nCLAUSES TO SWAP:\n\n${block}\n\nReturn ONLY the full revised document text. No commentary.`;
      const res = await client.copilotGuidance(active.file_name || "Collaborator document", prompt, [], "custom");
      setExportedDoc(res.reply);
      push("Ultimate collaborator document drafted", "success", "Counsel review still recommended.");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  }

  function baseName(): string {
    if (!active) return "collaborator";
    return active.file_name.replace(/\.[^.]+$/, "") || "collaborator";
  }
  function downloadTxt() {
    if (!exportedDoc || !active) return;
    const blob = new Blob([exportedDoc], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${baseName()}-collaborator.txt`; a.click();
    URL.revokeObjectURL(url);
  }
  function downloadPdf() {
    if (!exportedDoc || !active) return;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) { push("Popup blocked — allow popups to export PDF.", "error"); return; }
    const title = `${baseName()}-collaborator`;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:22mm 18mm}html,body{background:#fff;color:#1f1f1f}body{font-family:"Geist","Inter",system-ui,sans-serif;font-size:11pt;line-height:1.6;max-width:720px;margin:0 auto;padding:24px}h1{font-size:22pt;margin:0 0 6px;color:#1f1f1f;font-weight:500;letter-spacing:-0.01em}.meta{color:#6b6b6b;font-size:9pt;margin-bottom:28px;font-family:"Geist Mono",monospace;letter-spacing:0.08em}pre{white-space:pre-wrap;word-wrap:break-word;font-family:"Geist","Inter",sans-serif;font-size:11pt;color:#1f1f1f}.footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e5e5;color:#6b6b6b;font-size:8.5pt;font-family:"Geist Mono",monospace}</style></head><body><h1>${esc(active.file_name)} — Ultimate collaborator draft</h1><div class="meta">Generated via Clarifyd · ${new Date().toLocaleString()} · ${activePicked.size} clause${activePicked.size === 1 ? "" : "s"} applied</div><pre>${esc(exportedDoc)}</pre><div class="footer">NOT LEGAL ADVICE: Clarifyd is a decision-support tool. Review every clause with qualified counsel before signing.</div></body></html>`);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }

  function relTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  if (!loaded) {
    return (
      <DarkAppShell>
        <div style={{ color: "var(--ink-muted)" }}>Loading findings…</div>
      </DarkAppShell>
    );
  }

  if (!docs.length) {
    return (
      <DarkAppShell>
        <div
          style={{
            background: "var(--bg-elevated-1)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-md)",
            padding: 56,
            textAlign: "center",
          }}
        >
          <Stack weight="duotone" size={48} color="var(--ink-muted)" />
          <h2 style={{ marginTop: 16, fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}>
            No readings yet.
          </h2>
          <p style={{ marginTop: 8, fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.55, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
            Upload a contract on the dashboard. Risky clauses + suggested rewrites appear here.
          </p>
          <Link
            href="/dashboard"
            className="cursor-pointer"
            style={{
              marginTop: 22,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--brand-500)",
              color: "var(--ink-on-brand)",
              padding: "12px 22px",
              borderRadius: "var(--r-sm)",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Upload a contract <ArrowRight weight="bold" size={14} />
          </Link>
        </div>
      </DarkAppShell>
    );
  }

  const verdict = active?.analysis.report?.verdict ?? "";
  const score = active ? verdictToScore(verdict, loopholes.length) : 0;

  return (
    <DarkAppShell>
      {exporting ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "color-mix(in oklch, var(--bg-base) 85%, transparent)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div style={{ background: "var(--bg-elevated-1)", border: "1px solid var(--border-strong)", padding: 28, borderRadius: "var(--r-md)", maxWidth: 380, textAlign: "center" }}>
            <Sparkle weight="duotone" size={28} color="var(--brand-500)" />
            <div style={{ marginTop: 8, fontSize: 18, color: "var(--ink-primary)", fontWeight: 500, letterSpacing: "-0.005em" }}>
              Drafting collaborator document…
            </div>
            <p style={{ marginTop: 6, fontSize: 12, color: "var(--ink-muted)" }}>
              Merging accepted clauses · locking signature blocks
            </p>
          </div>
        </div>
      ) : null}

      {/* ============ Document selector ============ */}
      <section style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
          <div className="cf-eyebrow" style={{ color: "var(--brand-500)", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Files weight="duotone" size={14} aria-hidden />
            Analyzed documents · {docs.length}
          </div>
          <Link
            href="/dashboard"
            className="cursor-pointer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "var(--ink-primary)",
              textDecoration: "underline",
              textDecorationColor: "var(--brand-500)",
              textUnderlineOffset: 4,
              fontWeight: 500,
            }}
          >
            <Plus weight="bold" size={12} /> Analyze another
          </Link>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {docs.map((d) => {
            const sel = d.draft_id === activeId;
            const risk = String(d.analysis.summary.highest_risk).toLowerCase() as Severity;
            return (
              <div
                key={d.draft_id}
                onClick={() => setActiveId(d.draft_id)}
                className="cursor-pointer"
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 36px 10px 14px",
                  background: sel ? "color-mix(in oklch, var(--brand-500) 14%, transparent)" : "var(--bg-elevated-1)",
                  color: sel ? "var(--ink-primary)" : "var(--ink-secondary)",
                  border: `1px solid ${sel ? "var(--brand-500)" : "var(--border-strong)"}`,
                  borderRadius: "var(--r-sm)",
                  transition: "background 200ms var(--ease-out), border-color 200ms var(--ease-out)",
                }}
              >
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: `var(--sev-${risk})`, boxShadow: sel ? `0 0 0 3px color-mix(in oklch, var(--sev-${risk}) 25%, transparent)` : "none" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                    {d.file_name}
                  </div>
                  <div className="cf-mono" style={{ fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-muted)" }}>
                    {d.analysis.summary.findings_count} · {risk} · {relTime(d.analyzed_at)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteDoc(d); }}
                  aria-label={`Remove ${d.file_name}`}
                  className="cursor-pointer"
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "var(--ink-muted)",
                    padding: 4,
                    transition: "color 200ms var(--ease-out)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sev-critical)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-muted)")}
                >
                  <Trash weight="duotone" size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {active ? (
        <>
          {/* ============ Verdict card w/ HealthGauge ============ */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            style={{
              background: "var(--bg-elevated-1)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--r-md)",
              padding: 28,
              marginBottom: 24,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 28,
              alignItems: "center",
            }}
          >
            <div>
              <div className="cf-eyebrow" style={{ color: "var(--brand-500)", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Scales weight="duotone" size={14} aria-hidden />
                Risky clauses · {active.file_name}
              </div>
              <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 14 }}>
                <span
                  className="cf-mono tabular-nums"
                  style={{
                    fontSize: 64,
                    fontWeight: 500,
                    letterSpacing: "-0.04em",
                    color: "var(--ink-primary)",
                    lineHeight: 1,
                  }}
                >
                  {String(loopholes.length).padStart(2, "0")}
                </span>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>flagged</div>
                  <div className="cf-mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-muted)", marginTop: 2, fontWeight: 600 }}>
                    Clarifyd AI reasoning
                  </div>
                </div>
              </div>
              {active.analysis.report?.executive_summary ? (
                <p style={{ marginTop: 18, fontSize: 15, color: "var(--ink-secondary)", lineHeight: 1.6, maxWidth: 600 }}>
                  {active.analysis.report.executive_summary}
                </p>
              ) : null}
              <div style={{ marginTop: 22, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div className="cf-mono" style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 600 }}>
                  <span style={{ color: "var(--sev-low)", marginRight: 4 }}>{activePicked.size}</span>
                  / {suggestions.length} accepted
                </div>
                <button
                  type="button"
                  onClick={applyAll}
                  disabled={!suggestions.length}
                  className="cursor-pointer"
                  style={{
                    padding: "7px 14px",
                    background: "transparent",
                    border: "1px solid var(--border-strong)",
                    color: "var(--ink-primary)",
                    fontFamily: "Geist Mono, monospace",
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    borderRadius: "var(--r-sm)",
                    opacity: suggestions.length ? 1 : 0.4,
                    cursor: suggestions.length ? "pointer" : "not-allowed",
                    transition: "border-color 200ms var(--ease-out)",
                  }}
                  onMouseEnter={(e) => { if (suggestions.length) e.currentTarget.style.borderColor = "var(--brand-500)"; }}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                >
                  Accept all
                </button>
                <button
                  type="button"
                  onClick={clearPicks}
                  disabled={!activePicked.size}
                  className="cursor-pointer"
                  style={{
                    padding: "7px 14px",
                    background: "transparent",
                    border: "1px solid var(--border-strong)",
                    color: "var(--ink-muted)",
                    fontFamily: "Geist Mono, monospace",
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    borderRadius: "var(--r-sm)",
                    opacity: activePicked.size ? 1 : 0.4,
                    cursor: activePicked.size ? "pointer" : "not-allowed",
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
            <HealthGauge score={score} size={148} label="Health" />
          </motion.section>

          {/* ============ Clause list ============ */}
          {loopholes.length === 0 ? (
            <div
              style={{
                background: "var(--bg-elevated-1)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--r-md)",
                padding: 32,
                textAlign: "center",
                color: "var(--ink-muted)",
                fontStyle: "italic",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span>Clarifyd AI found no critical loopholes in this document.</span>
              {active && (
                <button
                  type="button"
                  onClick={handleRegenerateReport}
                  disabled={regenerating}
                  style={{
                    padding: "8px 18px",
                    background: "transparent",
                    border: "1px solid var(--border-strong)",
                    color: "var(--ink-primary)",
                    fontFamily: "Geist Mono, monospace",
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    borderRadius: "var(--r-sm)",
                    cursor: regenerating ? "not-allowed" : "pointer",
                    opacity: regenerating ? 0.5 : 1,
                  }}
                >
                  {regenerating ? "Generating…" : "Regenerate AI Report"}
                </button>
              )}
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              {loopholes.map((lp, i) => {
                const sev = (lp.severity ?? "low").toString().toLowerCase() as Severity;
                const sg = suggestions[i];
                const isPicked = activePicked.has(i);
                const data: ClauseData = {
                  id: `${i}`,
                  title: lp.clause_name,
                  severity: sev,
                  confidence: undefined,
                  original: lp.excerpt,
                  suggested: sg?.suggested_clause ?? "(No suggestion produced.)",
                  rationale: sg?.rationale,
                };
                return (
                  <li key={i}>
                    <ClauseCard
                      clause={data}
                      initialOpen={i < 2}
                      onAccept={() => togglePick(i)}
                      onReject={() => togglePick(i)}
                      accepted={isPicked}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          {/* ============ Collaborator doc bar ============ */}
          {loopholes.length ? (
            <section
              style={{
                marginTop: 24,
                background: "var(--bg-elevated-2)",
                border: "1px solid var(--brand-500)",
                borderRadius: "var(--r-md)",
                padding: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 18,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="cf-eyebrow" style={{ color: "var(--brand-300)" }}>
                  Ultimate collaborator document
                </div>
                <p style={{ marginTop: 8, fontSize: 14.5, color: "var(--ink-primary)", lineHeight: 1.55, maxWidth: 540 }}>
                  {activePicked.size
                    ? `${activePicked.size} accepted clause${activePicked.size === 1 ? "" : "s"} will be merged into the original draft — everything else stays as written.`
                    : "Accept one or more suggested clauses above first."}
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={exportDocument}
                  disabled={exporting || activePicked.size === 0}
                  className="cursor-pointer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--brand-500)",
                    color: "var(--ink-on-brand)",
                    padding: "12px 22px",
                    border: "none",
                    fontSize: 13.5,
                    fontWeight: 500,
                    borderRadius: "var(--r-sm)",
                    opacity: exporting || !activePicked.size ? 0.4 : 1,
                    cursor: exporting || !activePicked.size ? "not-allowed" : "pointer",
                    transition: "background 200ms var(--ease-out)",
                  }}
                >
                  <Sparkle weight="duotone" size={13} /> {exporting ? "Drafting…" : "Generate document"}
                </button>
                {exportedDoc ? (
                  <>
                    <DownloadBtn label="PDF" onClick={downloadPdf} icon={<Download weight="bold" size={12} />} />
                    <DownloadBtn label=".txt" onClick={downloadTxt} icon={<FileText weight="duotone" size={12} />} />
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* ============ Preview pane ============ */}
          {exportedDoc ? (
            <section
              style={{
                marginTop: 18,
                background: "var(--bg-elevated-1)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--r-md)",
                padding: 22,
              }}
            >
              <div className="cf-eyebrow" style={{ color: "var(--ink-muted)", marginBottom: 12 }}>
                Collaborator preview · only accepted clauses changed
              </div>
              <pre
                className="cf-mono"
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 12.5,
                  color: "var(--ink-primary)",
                  maxHeight: 500,
                  overflowY: "auto",
                  margin: 0,
                  background: "var(--bg-base)",
                  border: "1px solid var(--border-hairline)",
                  padding: 18,
                  lineHeight: 1.65,
                  borderRadius: "var(--r-sm)",
                }}
              >
                {exportedDoc}
              </pre>
            </section>
          ) : null}
        </>
      ) : null}
      <NoticeModal
        open={notice !== null}
        notice={notice}
        onClose={() => setNotice(null)}
      />
    </DarkAppShell>
  );
}

function DownloadBtn({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "transparent",
        color: "var(--ink-primary)",
        border: "1px solid var(--border-strong)",
        padding: "11px 16px",
        fontSize: 13,
        fontWeight: 500,
        borderRadius: "var(--r-sm)",
        transition: "border-color 200ms var(--ease-out)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--brand-500)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
    >
      {icon} {label}
    </button>
  );
}
