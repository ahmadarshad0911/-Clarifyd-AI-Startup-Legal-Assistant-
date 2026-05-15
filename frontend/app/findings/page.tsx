"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "../../components/shell/app-shell";
import { OrbitalLoader } from "../../components/common/orbital-loader";
import { ScrollReveal } from "../../components/common/scroll-reveal";
import { VerdictCard } from "../../components/findings/verdict-card";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import { listAnalyses, type StoredAnalysis } from "../../lib/analyses";
import { profileContextLine } from "../../lib/founder-profile";
import type { ReportLoophole, ReportSuggestion, RiskLevel } from "../../lib/contracts";

const RISK_DOT: Record<string, string> = {
  low: "#475569",
  medium: "#2563eb",
  high: "#ea580c",
  critical: "#dc2626",
};

const RISK_META: Record<
  RiskLevel,
  { glyph: string; ringColor: string; border: string; aura: string; chip: string }
> = {
  critical: {
    glyph: "⬣",
    ringColor: "#dc2626",
    border: "border-l-status-danger",
    aura: "aura-critical",
    chip: "bg-status-danger/10 text-status-danger",
  },
  high: {
    glyph: "▲",
    ringColor: "#ea580c",
    border: "border-l-status-warn",
    aura: "aura-warn",
    chip: "bg-status-warn/10 text-status-warn",
  },
  medium: {
    glyph: "◆",
    ringColor: "#2563eb",
    border: "border-l-status-info",
    aura: "aura-info",
    chip: "bg-status-info/10 text-status-info",
  },
  low: {
    glyph: "▪",
    ringColor: "#475569",
    border: "border-l-slate-400",
    aura: "",
    chip: "bg-slate-200 text-slate-700",
  },
};

export default function FindingsPage() {
  const { client } = useAuth();
  const { push } = useToast();
  const params = useSearchParams();
  const [docs, setDocs] = useState<StoredAnalysis[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // per-doc applied selection: key = draft_id, value = Set<loophole index>
  const [picked, setPicked] = useState<Record<string, Set<number>>>({});
  const [exporting, setExporting] = useState(false);
  const [exportedDoc, setExportedDoc] = useState<string | null>(null);

  useEffect(() => {
    const all = listAnalyses();
    setDocs(all);
    const wanted = params.get("draft");
    setActiveId(
      (wanted && all.some((d) => d.draft_id === wanted) ? wanted : null) ??
        all[0]?.draft_id ??
        null
    );
    setLoaded(true);
  }, [params]);

  const active = useMemo(
    () => docs.find((d) => d.draft_id === activeId) ?? null,
    [docs, activeId]
  );

  const loopholes: ReportLoophole[] = active?.analysis.report?.loopholes ?? [];
  const suggestions: ReportSuggestion[] = active?.analysis.report?.suggestions ?? [];
  const activePicked = (active && picked[active.draft_id]) || new Set<number>();

  function togglePick(i: number) {
    if (!active) return;
    setPicked((prev) => {
      const set = new Set(prev[active.draft_id] ?? []);
      if (set.has(i)) set.delete(i);
      else set.add(i);
      return { ...prev, [active.draft_id]: set };
    });
    setExportedDoc(null);
  }

  function applyAll() {
    if (!active) return;
    setPicked((prev) => ({
      ...prev,
      [active.draft_id]: new Set(suggestions.map((_, i) => i)),
    }));
  }

  function clearPicks() {
    if (!active) return;
    setPicked((prev) => ({ ...prev, [active.draft_id]: new Set() }));
  }

  function applySuggestionsToText(): {
    revised: string;
    missed: string[];
  } | null {
    if (!active) return null;
    const original = active.analysis.extracted_text ?? "";
    if (!original) return null;
    let revised = original;
    const missed: string[] = [];
    suggestions.forEach((s, i) => {
      if (!activePicked.has(i)) return;
      const target = (s.original_excerpt || "").trim();
      const replacement = (s.suggested_clause || "").trim();
      if (!target || !replacement) {
        missed.push(s.clause_name);
        return;
      }
      // 1) try verbatim swap
      if (revised.includes(target)) {
        revised = revised.replace(target, replacement);
        return;
      }
      // 2) fall back to whitespace-tolerant match
      const flexible = new RegExp(
        target
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\s+/g, "\\s+"),
        "i"
      );
      if (flexible.test(revised)) {
        revised = revised.replace(flexible, replacement);
        return;
      }
      // 3) fall back to the loophole excerpt
      const loophole = loopholes[i];
      const loopTarget = (loophole?.excerpt || "").trim();
      if (loopTarget && revised.includes(loopTarget)) {
        revised = revised.replace(loopTarget, replacement);
        return;
      }
      missed.push(s.clause_name);
    });
    return { revised, missed };
  }

  async function exportDocument() {
    if (!active) return;
    const chosen = suggestions.filter((_, i) => activePicked.has(i));
    if (!chosen.length) {
      push("Pick at least one suggested clause to apply.", "info");
      return;
    }
    setExporting(true);
    try {
      // Path A — extracted_text present: splice locally so the rest of the
      // document is byte-identical and only the picked clauses change.
      if (active.analysis.extracted_text) {
        const result = applySuggestionsToText();
        if (result) {
          setExportedDoc(result.revised);
          if (result.missed.length) {
            push(
              `Applied ${chosen.length - result.missed.length}/${chosen.length} — some clauses not found verbatim.`,
              "info",
              `Unmatched: ${result.missed.join(", ")}`
            );
          } else {
            push(
              "Document revised",
              "success",
              `${chosen.length} clause${chosen.length === 1 ? "" : "s"} swapped — rest unchanged.`
            );
          }
          return;
        }
      }
      // Path B — fallback (older analysis without extracted_text). Ask Kimi to
      // rebuild the document, preserving sections it isn't replacing.
      const ctx = profileContextLine();
      const block = chosen
        .map(
          (s, i) =>
            `${i + 1}. CLAUSE: ${s.clause_name}\n   REPLACE: "${s.original_excerpt}"\n   WITH: ${s.suggested_clause}\n   RATIONALE: ${s.rationale}`
        )
        .join("\n\n");
      const prompt = `${ctx ? ctx + "\n\n" : ""}The user reviewed "${active.file_name}" and chose to apply the safer
clauses below. Produce the COMPLETE revised document.

STRICT RULES:
- Replace ONLY the clauses listed below; reproduce every other clause exactly as written.
- Do not paraphrase, summarize, or reorder unaffected sections.
- Preserve original headings, numbering, and signature blocks.
- Where a specific detail is unknown, insert [TO BE CONFIRMED — <field>].

CLAUSES TO SWAP:

${block}

Return ONLY the full revised document text. No commentary.`;
      const res = await client.copilotGuidance(
        active.file_name || "Revised contract",
        prompt,
        [],
        "custom"
      );
      setExportedDoc(res.reply);
      push(
        "Revised document drafted",
        "success",
        "Counsel review still recommended. Re-upload to get verbatim-splice mode."
      );
    } catch (err) {
      push(
        err instanceof ApiError ? err.message : "Export failed.",
        "error"
      );
    } finally {
      setExporting(false);
    }
  }

  function baseName(): string {
    if (!active) return "revised";
    return active.file_name.replace(/\.[^.]+$/, "") || "revised";
  }

  function downloadTxt() {
    if (!exportedDoc || !active) return;
    const blob = new Blob([exportedDoc], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName()}-revised.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPdf() {
    if (!exportedDoc || !active) return;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) {
      push("Popup blocked — allow popups to export PDF.", "error");
      return;
    }
    const title = `${baseName()}-revised`;
    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    w.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  html, body { background: #fff; color: #0f172a; }
  body {
    font-family: "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    max-width: 720px;
    margin: 0 auto;
    padding: 24px;
  }
  h1 {
    font-family: "Fraunces", Georgia, serif;
    font-size: 22pt;
    margin: 0 0 6px;
    color: #1E3A8A;
  }
  .meta { color: #64748b; font-size: 9pt; margin-bottom: 28px; }
  pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: inherit;
    font-size: 11pt;
    color: #0f172a;
  }
  .footer {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #cbd5e1;
    color: #64748b;
    font-size: 8.5pt;
  }
</style></head>
<body>
  <h1>${escapeHtml(active.file_name)} — Revised</h1>
  <div class="meta">Generated by Clarifyd · ${new Date().toLocaleString()} · ${activePicked.size} clause${
        activePicked.size === 1 ? "" : "s"
      } applied · Rest of document unchanged.</div>
  <pre>${escapeHtml(exportedDoc)}</pre>
  <div class="footer">NOT LEGAL ADVICE: Clarifyd is an AI tool. Review every clause with qualified counsel before signing.</div>
</body></html>`);
    w.document.close();
    // Give the new window a tick to render fonts before printing.
    w.onload = () => {
      w.focus();
      w.print();
    };
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

  if (!loaded) return <AppShell><div /></AppShell>;

  if (!docs.length) {
    return (
      <AppShell>
        <section className="crystal-glass rounded-3xl p-10 text-center flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary/30 text-[56px]">
            description
          </span>
          <h2 className="font-display-hero text-h1-mobile lg:text-h1 text-onboarding-navy m-0">
            No analysis yet
          </h2>
          <p className="text-on-surface-variant max-w-md">
            Upload a contract on the dashboard — Kimi will analyze every clause and the findings
            will appear here.
          </p>
          <Link href="/dashboard" className="btn-capsule btn-capsule-primary mt-2">
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Upload a contract
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {exporting ? (
        <OrbitalLoader
          fullscreen
          statusLines={[
            "Merging agreed clauses…",
            "Drafting revised document…",
            "Locking signature blocks…",
          ]}
        />
      ) : null}

      {/* Document selector */}
      <section className="crystal-glass rounded-3xl p-5 md:p-6">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">folder_open</span>
            <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
              Analyzed documents · {docs.length}
            </span>
          </div>
          <Link
            href="/dashboard"
            className="btn-capsule glass-semi-clear text-primary text-sm px-5"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Analyze another
          </Link>
        </div>
        <div className="flex flex-wrap gap-3">
          {docs.map((d) => {
            const selected = d.draft_id === activeId;
            const risk = d.analysis.summary.highest_risk;
            return (
              <button
                key={d.draft_id}
                type="button"
                onClick={() => setActiveId(d.draft_id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                  selected
                    ? "bg-gradient-to-r from-primary to-accent-violet text-white border-transparent shadow-md"
                    : "bg-white/50 border-white/60 text-on-surface hover:bg-white/70"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: selected ? "#fff" : RISK_DOT[risk] ?? "#475569" }}
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-body-sm truncate max-w-[200px]">
                    {d.file_name}
                  </span>
                  <span
                    className={`block text-[11px] ${
                      selected ? "text-white/80" : "text-on-surface-variant"
                    }`}
                  >
                    {d.analysis.summary.findings_count} findings · {risk} · {relTime(d.analyzed_at)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {active ? (
        <>
          <VerdictCard analysis={active.analysis} fileName={active.file_name} />

          {/* Risky clauses + loopholes + suggestions — liquid-glass redesign */}
          <section className="flex flex-col gap-6">
            {/* Header card */}
            <div className="crystal-glass rounded-3xl p-6 md:p-8 relative overflow-hidden">
              <div
                className="absolute -top-24 -left-20 w-64 h-64 rounded-full pointer-events-none"
                style={{
                  background: "rgba(53, 37, 205, 0.12)",
                  filter: "blur(70px)",
                }}
                aria-hidden
              />
              <div
                className="absolute -bottom-24 -right-16 w-56 h-56 rounded-full pointer-events-none"
                style={{
                  background: "rgba(124, 58, 237, 0.12)",
                  filter: "blur(70px)",
                }}
                aria-hidden
              />
              <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
                <div className="min-w-0">
                  <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary block mb-2">
                    Risky clauses &amp; loopholes
                  </span>
                  <div className="flex items-baseline gap-3">
                    <span className="font-display-hero text-[64px] md:text-[80px] leading-none text-onboarding-navy">
                      {String(loopholes.length).padStart(2, "0")}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-display-hero text-h2 text-onboarding-navy m-0">
                        flagged
                      </span>
                      <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mt-1">
                        Kimi reasoning · {active.file_name}
                      </span>
                    </div>
                  </div>
                  {active.analysis.report?.executive_summary ? (
                    <p className="text-body-sm text-on-surface-variant max-w-2xl mt-4 m-0 leading-relaxed">
                      {active.analysis.report.executive_summary}
                    </p>
                  ) : null}
                </div>

                {/* Apply-all toolbar */}
                <div className="flex flex-col items-end gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-baseline gap-1">
                      <span
                        key={`picked-${activePicked.size}`}
                        className="count-pop font-display-hero text-3xl text-status-success leading-none transition-colors"
                      >
                        {activePicked.size}
                      </span>
                      <span className="font-label-caps text-label-caps text-on-surface-variant whitespace-nowrap">
                        / {suggestions.length} applied
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={applyAll}
                      disabled={!suggestions.length}
                      className="btn-capsule glass-semi-clear text-primary text-sm px-4"
                    >
                      <span className="material-symbols-outlined text-[16px]">done_all</span>
                      Apply all
                    </button>
                    <button
                      type="button"
                      onClick={clearPicks}
                      disabled={!activePicked.size}
                      className="btn-capsule glass-semi-clear text-on-surface-variant text-sm px-4"
                    >
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {loopholes.length === 0 ? (
              <div className="crystal-glass rounded-3xl p-10 text-center">
                <p className="text-on-surface-variant m-0">
                  Kimi found no critical loopholes in this document.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-6 m-0 p-0 list-none">
                {loopholes.map((lp, i) => {
                  const sev = (lp.severity as RiskLevel) ?? "low";
                  const meta = RISK_META[sev];
                  const sg = suggestions[i];
                  const isPicked = activePicked.has(i);
                  return (
                    <ScrollReveal key={i} delay={Math.min(i, 4) * 80}>
                      <li
                        className={`risky-card ${isPicked ? "is-applied" : ""} ${meta.aura} p-5 md:p-7`}
                      >
                        {/* Top row: glyph + title + severity + applied badge */}
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                          <div className="flex items-start gap-4 min-w-0">
                            <div
                              className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold"
                              style={{
                                color: meta.ringColor,
                                background: `${meta.ringColor}1a`,
                                boxShadow: `inset 0 0 0 1px ${meta.ringColor}33`,
                              }}
                            >
                              {meta.glyph}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-display-hero text-h3 md:text-2xl text-onboarding-navy m-0 leading-tight">
                                {lp.clause_name}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${meta.chip}`}
                                >
                                  {sev}
                                </span>
                                <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">
                                  loophole {String(i + 1).padStart(2, "0")}
                                </span>
                              </div>
                            </div>
                          </div>
                          {isPicked ? (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-success/15 text-status-success text-[10px] font-bold uppercase tracking-wider border border-status-success/30">
                              <span
                                className="material-symbols-outlined text-[14px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                check_circle
                              </span>
                              Will be applied
                            </span>
                          ) : null}
                        </div>

                        {/* Two-pane comparison with arrow lane (md+) */}
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-5 md:gap-7 items-stretch">
                          <div className="min-w-0">
                            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant block mb-2">
                              Risky clause
                            </span>
                            <blockquote className="rounded-2xl p-4 italic font-display-hero text-on-surface-variant bg-status-danger/5 border-l-2 border-status-danger/40 m-0 leading-relaxed">
                              &ldquo;{lp.excerpt}&rdquo;
                            </blockquote>
                            <p className="text-body-sm text-on-surface-variant mt-3 m-0">
                              <strong className="text-onboarding-navy">Issue: </strong>
                              {lp.issue}
                            </p>
                            <p className="text-body-sm text-on-surface-variant mt-1 m-0">
                              <strong className="text-onboarding-navy">Impact: </strong>
                              {lp.impact}
                            </p>
                          </div>

                          {/* Arrow lane — vertical separator on md+, hidden on mobile */}
                          <div className="hidden md:flex flex-col items-center justify-center px-1">
                            <div className="flex-1 w-px bg-on-surface-variant/15" />
                            <span className="morph-arrow my-3">
                              <span className="material-symbols-outlined text-[18px]">east</span>
                            </span>
                            <div className="flex-1 w-px bg-on-surface-variant/15" />
                          </div>

                          <div className="min-w-0">
                            <span className="font-label-caps text-label-caps uppercase text-status-success block mb-2">
                              Suggested clause
                            </span>
                            {sg ? (
                              <>
                                <p className="rounded-2xl p-4 bg-status-success/5 border-l-2 border-status-success/40 text-body-sm text-on-surface m-0 leading-relaxed">
                                  {sg.suggested_clause}
                                </p>
                                <p className="text-[12px] text-on-surface-variant mt-3 m-0">
                                  <strong className="text-status-success">Why: </strong>
                                  {sg.rationale}
                                </p>
                              </>
                            ) : (
                              <p className="text-body-sm text-on-surface-variant m-0">
                                No suggestion produced.
                              </p>
                            )}
                          </div>
                        </div>

                        {sg ? (
                          <div className="mt-6 flex justify-end">
                            <button
                              type="button"
                              onClick={() => togglePick(i)}
                              className={`btn-capsule text-sm px-7 ${
                                isPicked
                                  ? "bg-status-success text-white border-transparent shadow-lg shadow-status-success/30"
                                  : "btn-capsule-primary"
                              }`}
                              style={{
                                transition:
                                  "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease",
                              }}
                            >
                              <span
                                className="material-symbols-outlined text-[18px]"
                                style={isPicked ? { fontVariationSettings: "'FILL' 1" } : undefined}
                              >
                                {isPicked ? "check_circle" : "edit_note"}
                              </span>
                              {isPicked ? "Applied" : "Apply to document"}
                            </button>
                          </div>
                        ) : null}
                      </li>
                    </ScrollReveal>
                  );
                })}
              </ul>
            )}

            {/* Export action — gold-shimmer navy card */}
            {loopholes.length ? (
              <div className="shimmer-gold-border rounded-3xl bg-onboarding-navy text-white p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
                <div
                  className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
                  style={{
                    background: "rgba(180, 83, 9, 0.25)",
                    filter: "blur(80px)",
                  }}
                  aria-hidden
                />
                <div className="relative z-10">
                  <span className="font-label-caps text-label-caps uppercase tracking-widest text-onboarding-gold/90 block">
                    Export revised document
                  </span>
                  <p className="text-body-sm opacity-90 m-0 mt-1 max-w-md">
                    {activePicked.size
                      ? `${activePicked.size} agreed clause${activePicked.size === 1 ? "" : "s"} ready to merge into a new draft — Kimi rebuilds the document with the safer language.`
                      : "Pick one or more suggested clauses above first."}
                  </p>
                </div>
                <div className="relative z-10 flex flex-wrap gap-3 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={exportDocument}
                    disabled={exporting || activePicked.size === 0}
                    className="bg-onboarding-gold hover:bg-onboarding-gold/90 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-onboarding-gold/30"
                  >
                    <span className="material-symbols-outlined text-[20px]">auto_fix</span>
                    {exporting ? "Drafting…" : "Generate revised draft"}
                  </button>
                  {exportedDoc ? (
                    <>
                      <button
                        type="button"
                        onClick={downloadPdf}
                        className="bg-white text-onboarding-navy font-bold py-3 px-6 rounded-2xl flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          picture_as_pdf
                        </span>
                        Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={downloadTxt}
                        className="bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[20px]">description</span>
                        Download .txt
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {exportedDoc ? (
              <ScrollReveal>
                <div className="crystal-glass rounded-3xl p-5 md:p-6">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                    <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
                      Revised document preview · only chosen clauses changed
                    </span>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={downloadPdf}
                        className="btn-capsule btn-capsule-primary text-sm px-5"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          picture_as_pdf
                        </span>
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={downloadTxt}
                        className="btn-capsule glass-semi-clear text-primary text-sm px-5"
                      >
                        <span className="material-symbols-outlined text-[18px]">description</span>
                        .txt
                      </button>
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap font-code-snippet text-body-sm text-on-surface max-h-[500px] overflow-y-auto m-0 bg-white/60 rounded-2xl p-5">
                    {exportedDoc}
                  </pre>
                </div>
              </ScrollReveal>
            ) : null}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
