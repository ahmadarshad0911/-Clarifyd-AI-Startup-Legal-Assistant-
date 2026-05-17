"use client";

/**
 * Findings — dark editorial.
 *
 * ALL business logic preserved verbatim from the prior aurora version
 * (reconcile local+remote drafts, accept/clear picks, export collaborator
 * doc with verbatim splice, PDF / TXT download, delete, etc.).
 * Only the JSX + visual styling changed.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { DarkAppShell } from "../../components/shell/dark-app-shell";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import {
  listAnalyses,
  removeAnalysis,
  type StoredAnalysis,
} from "../../lib/analyses";
import { profileContextLine } from "../../lib/founder-profile";
import type { ReportLoophole, ReportSuggestion, RiskLevel } from "../../lib/contracts";

const SEV_CLASS: Record<
  string,
  { dot: string; text: string; bg: string; border: string; glyph: string }
> = {
  critical: {
    dot: "bg-rose-500 shadow-[0_0_10px_#f43f5e]",
    text: "text-rose-300",
    bg: "bg-rose-950/30",
    border: "border-rose-500/30",
    glyph: "⬣",
  },
  high: {
    dot: "bg-amber-400 shadow-[0_0_10px_#fbbf24]",
    text: "text-amber-300",
    bg: "bg-amber-950/30",
    border: "border-amber-500/30",
    glyph: "▲",
  },
  medium: {
    dot: "bg-sky-400 shadow-[0_0_10px_#38bdf8]",
    text: "text-sky-300",
    bg: "bg-sky-950/30",
    border: "border-sky-500/30",
    glyph: "◆",
  },
  low: {
    dot: "bg-slate-500",
    text: "text-slate-400",
    bg: "bg-slate-900/40",
    border: "border-slate-700/40",
    glyph: "▪",
  },
};

export default function FindingsPage() {
  return (
    <Suspense
      fallback={
        <DarkAppShell>
          <div className="text-slate-400 text-sm">Loading findings…</div>
        </DarkAppShell>
      }
    >
      <FindingsPageInner />
    </Suspense>
  );
}

function FindingsPageInner() {
  const { client } = useAuth();
  const { push } = useToast();
  const params = useSearchParams();
  const [docs, setDocs] = useState<StoredAnalysis[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState<Record<string, Set<number>>>({});
  const [exporting, setExporting] = useState(false);
  const [exportedDoc, setExportedDoc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const local = listAnalyses();

    function settle(items: StoredAnalysis[]) {
      if (cancelled) return;
      const visible = items.filter((d) => !d.negotiated_at);
      setDocs(visible);
      const wanted = params.get("draft");
      setActiveId(
        (wanted && visible.some((d) => d.draft_id === wanted) ? wanted : null) ??
          visible[0]?.draft_id ??
          null,
      );
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
          return {
            ...d,
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
        settle([...reconciled, ...fresh]);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [params, client]);

  const active = useMemo(
    () => docs.find((d) => d.draft_id === activeId) ?? null,
    [docs, activeId],
  );
  const loopholes: ReportLoophole[] = active?.analysis.report?.loopholes ?? [];
  const suggestions: ReportSuggestion[] =
    active?.analysis.report?.suggestions ?? [];
  const activePicked = (active && picked[active.draft_id]) || new Set<number>();

  async function deleteDoc(d: StoredAnalysis, e: React.MouseEvent) {
    e.stopPropagation();
    if (
      !window.confirm(
        `Remove "${d.file_name}" from Findings? This can't be undone.`,
      )
    )
      return;
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
  }

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

  function applySuggestionsToText(): { revised: string; missed: string[] } | null {
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
      if (revised.includes(target)) {
        revised = revised.replace(target, replacement);
        return;
      }
      const flexible = new RegExp(
        target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"),
        "i",
      );
      if (flexible.test(revised)) {
        revised = revised.replace(flexible, replacement);
        return;
      }
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
      if (active.analysis.extracted_text) {
        const result = applySuggestionsToText();
        if (result) {
          setExportedDoc(result.revised);
          if (result.missed.length) {
            push(
              `Applied ${chosen.length - result.missed.length}/${chosen.length} — some clauses not found verbatim.`,
              "info",
              `Unmatched: ${result.missed.join(", ")}`,
            );
          } else {
            push(
              "Collaborator document ready",
              "success",
              `${chosen.length} clause${chosen.length === 1 ? "" : "s"} swapped — rest unchanged.`,
            );
          }
          return;
        }
      }
      const ctx = profileContextLine();
      const block = chosen
        .map(
          (s, i) =>
            `${i + 1}. CLAUSE: ${s.clause_name}\n   REPLACE: "${s.original_excerpt}"\n   WITH: ${s.suggested_clause}\n   RATIONALE: ${s.rationale}`,
        )
        .join("\n\n");
      const prompt = `${ctx ? ctx + "\n\n" : ""}The user reviewed "${active.file_name}" and accepted the safer clauses below. Produce the COMPLETE ultimate collaborator document.\n\nSTRICT RULES:\n- Replace ONLY the clauses listed below; reproduce every other clause exactly as written.\n- Do not paraphrase, summarize, or reorder unaffected sections.\n- Preserve original headings, numbering, and signature blocks.\n- Where a specific detail is unknown, insert [TO BE CONFIRMED — <field>].\n\nCLAUSES TO SWAP:\n\n${block}\n\nReturn ONLY the full revised document text. No commentary.`;
      const res = await client.copilotGuidance(
        active.file_name || "Collaborator document",
        prompt,
        [],
        "custom",
      );
      setExportedDoc(res.reply);
      push(
        "Ultimate collaborator document drafted",
        "success",
        "Counsel review still recommended. Re-upload to get verbatim-splice mode.",
      );
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
    a.href = url;
    a.download = `${baseName()}-collaborator.txt`;
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
    const title = `${baseName()}-collaborator`;
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:22mm 18mm}html,body{background:#fff;color:#0f172a}body{font-family:"Inter","Plus Jakarta Sans",system-ui,sans-serif;font-size:11pt;line-height:1.6;max-width:720px;margin:0 auto;padding:24px}h1{font-size:22pt;margin:0 0 6px;color:#1e293b}.meta{color:#64748b;font-size:9pt;margin-bottom:28px}pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:11pt;color:#0f172a}.footer{margin-top:32px;padding-top:12px;border-top:1px solid #cbd5e1;color:#64748b;font-size:8.5pt}</style></head><body><h1>${esc(active.file_name)} — Ultimate collaborator draft</h1><div class="meta">Generated via Clarifyd · ${new Date().toLocaleString()} · ${activePicked.size} clause${activePicked.size === 1 ? "" : "s"} applied · Rest unchanged.</div><pre>${esc(exportedDoc)}</pre><div class="footer">NOT LEGAL ADVICE: Clarifyd is an AI tool. Review every clause with qualified counsel before signing.</div></body></html>`,
    );
    w.document.close();
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

  if (!loaded)
    return (
      <DarkAppShell>
        <div className="text-slate-400 text-sm">Loading findings…</div>
      </DarkAppShell>
    );

  if (!docs.length) {
    return (
      <DarkAppShell>
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-12 text-center">
          <div className="text-5xl text-slate-700 mb-4">⌧</div>
          <h2 className="text-2xl text-white font-semibold tracking-tight">
            No analysis yet
          </h2>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            Upload a contract on the dashboard. Risky clauses and suggested
            rewrites appear here.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200 cursor-pointer transition-colors duration-200"
          >
            Upload a contract →
          </Link>
        </div>
      </DarkAppShell>
    );
  }

  return (
    <DarkAppShell>
      {exporting ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
          <div className="rounded-xl border border-white/10 bg-slate-900/80 p-7 text-center max-w-sm">
            <div className="text-3xl mb-3 animate-pulse">⚙</div>
            <div className="text-white font-semibold tracking-tight">
              Drafting collaborator document…
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Merging accepted clauses · locking signature blocks
            </p>
          </div>
        </div>
      ) : null}

      {/* Document selector */}
      <section className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div
            className="text-[10px] uppercase tracking-[0.18em] text-violet-400"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            ↳ analyzed documents · {docs.length}
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-900 px-3.5 py-1.5 text-xs text-slate-200 cursor-pointer transition-colors duration-200"
          >
            <span>+</span> Analyze another
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {docs.map((d) => {
            const selected = d.draft_id === activeId;
            const risk = String(d.analysis.summary.highest_risk).toLowerCase();
            const sev = SEV_CLASS[risk] ?? SEV_CLASS.low;
            return (
              <div
                key={d.draft_id}
                onClick={() => setActiveId(d.draft_id)}
                className={`group relative flex items-center gap-3 px-4 py-2.5 pr-9 rounded-lg border cursor-pointer transition-all duration-200 ${
                  selected
                    ? "border-indigo-400/50 bg-indigo-500/10 text-white"
                    : "border-white/10 bg-slate-900/40 text-slate-300 hover:bg-slate-900/70"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${sev.dot}`} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate max-w-[200px]">
                    {d.file_name}
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-[0.14em] text-slate-500"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {d.analysis.summary.findings_count} · {risk} ·{" "}
                    {relTime(d.analyzed_at)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => deleteDoc(d, e)}
                  aria-label={`Remove ${d.file_name}`}
                  title="Remove from Findings"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded text-slate-500 hover:text-rose-300 hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200 flex items-center justify-center text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {active ? (
        <>
          {/* Verdict card */}
          <section className="mb-8 rounded-xl border border-white/10 bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-900/40 p-8 relative overflow-hidden">
            <div
              className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full opacity-30 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(139,92,246,0.6), transparent 70%)",
                filter: "blur(20px)",
              }}
              aria-hidden
            />
            <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
              <div className="min-w-0">
                <div
                  className="text-[10px] uppercase tracking-[0.18em] text-indigo-300"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  risky clauses · {active.file_name}
                </div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span
                    className="text-6xl md:text-7xl font-semibold text-white leading-none tabular-nums"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {String(loopholes.length).padStart(2, "0")}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xl text-white font-semibold tracking-tight">
                      flagged
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-[0.14em] text-slate-400"
                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      Kimi K2 reasoning
                    </span>
                  </div>
                </div>
                {active.analysis.report?.executive_summary ? (
                  <p className="mt-4 text-sm text-slate-300 max-w-2xl leading-relaxed">
                    {active.analysis.report.executive_summary}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="text-right">
                  <span
                    className="text-3xl text-emerald-400 font-semibold leading-none tabular-nums"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {activePicked.size}
                  </span>
                  <span className="ml-1 text-xs text-slate-400">
                    / {suggestions.length} accepted
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyAll}
                    disabled={!suggestions.length}
                    className="text-xs px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 disabled:opacity-40 cursor-pointer transition-colors duration-200"
                  >
                    Accept all
                  </button>
                  <button
                    type="button"
                    onClick={clearPicks}
                    disabled={!activePicked.size}
                    className="text-xs px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 disabled:opacity-40 cursor-pointer transition-colors duration-200"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </section>

          {loopholes.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-10 text-center text-slate-400 text-sm">
              Kimi found no critical loopholes in this document.
            </div>
          ) : (
            <ul className="space-y-5 m-0 p-0 list-none">
              {loopholes.map((lp, i) => {
                const sev = (lp.severity ?? "low").toString().toLowerCase();
                const meta = SEV_CLASS[sev] ?? SEV_CLASS.low;
                const sg = suggestions[i];
                const isPicked = activePicked.has(i);
                return (
                  <li
                    key={i}
                    className={`rounded-xl border bg-slate-900/40 p-6 transition-all duration-200 ${
                      isPicked
                        ? "border-emerald-500/40 bg-emerald-950/10"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`shrink-0 w-10 h-10 rounded-lg border ${meta.border} ${meta.bg} ${meta.text} flex items-center justify-center text-base font-bold`}
                        >
                          {meta.glyph}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base text-white font-semibold tracking-tight leading-tight">
                            {lp.clause_name}
                          </h3>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${meta.bg} ${meta.text} border ${meta.border}`}
                            >
                              {sev}
                            </span>
                            <span
                              className="text-[10px] uppercase tracking-[0.14em] text-slate-500"
                              style={{
                                fontFamily: "'IBM Plex Mono', monospace",
                              }}
                            >
                              loophole {String(i + 1).padStart(2, "0")}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isPicked ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                          ✓ in collaborator draft
                        </span>
                      ) : null}
                    </div>

                    {/* Body */}
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-5 md:gap-6 items-stretch">
                      <div className="min-w-0">
                        <div
                          className="text-[10px] uppercase tracking-[0.14em] text-slate-500 mb-2"
                          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                          risky clause
                        </div>
                        <blockquote className="rounded-lg border border-rose-500/20 bg-rose-950/20 px-3.5 py-3 text-sm text-slate-300 italic leading-relaxed m-0">
                          &ldquo;{lp.excerpt}&rdquo;
                        </blockquote>
                        <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                          <span className="text-slate-200 font-semibold">
                            Issue:
                          </span>{" "}
                          {lp.issue}
                        </p>
                        <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                          <span className="text-slate-200 font-semibold">
                            Impact:
                          </span>{" "}
                          {lp.impact}
                        </p>
                      </div>
                      <div className="hidden md:flex flex-col items-center justify-center px-1">
                        <div className="flex-1 w-px bg-white/5" />
                        <span className="my-3 text-violet-400 text-lg">→</span>
                        <div className="flex-1 w-px bg-white/5" />
                      </div>
                      <div className="min-w-0">
                        <div
                          className="text-[10px] uppercase tracking-[0.14em] text-emerald-400 mb-2"
                          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                          suggested clause
                        </div>
                        {sg ? (
                          <>
                            <p className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3.5 py-3 text-sm text-slate-200 leading-relaxed m-0">
                              {sg.suggested_clause}
                            </p>
                            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                              <span className="text-emerald-400 font-semibold">
                                Why:
                              </span>{" "}
                              {sg.rationale}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-500">
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
                          className={`text-xs px-4 py-2 rounded-lg font-semibold transition-all duration-200 cursor-pointer ${
                            isPicked
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                              : "bg-white text-slate-950 hover:bg-slate-200"
                          }`}
                        >
                          {isPicked ? "✓ Accepted" : "Add to collaborator doc"}
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {loopholes.length ? (
            <section className="mt-8 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 via-slate-900/60 to-slate-900/40 p-6 md:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
              <div
                className="absolute -top-12 -right-12 h-44 w-44 rounded-full opacity-40 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(245,158,11,0.5), transparent 70%)",
                  filter: "blur(20px)",
                }}
                aria-hidden
              />
              <div className="relative z-10 min-w-0">
                <div
                  className="text-[10px] uppercase tracking-[0.18em] text-amber-300"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  ultimate collaborator document
                </div>
                <p className="mt-2 text-sm text-slate-300 max-w-lg">
                  {activePicked.size
                    ? `${activePicked.size} accepted clause${activePicked.size === 1 ? "" : "s"} will be merged into the original draft — everything else stays as written.`
                    : "Accept one or more suggested clauses above first."}
                </p>
              </div>
              <div className="relative z-10 flex flex-wrap gap-2 w-full md:w-auto">
                <button
                  type="button"
                  onClick={exportDocument}
                  disabled={exporting || activePicked.size === 0}
                  className="rounded-lg bg-amber-400 text-slate-950 px-5 py-2.5 text-sm font-semibold hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
                >
                  {exporting ? "Drafting…" : "✨ Generate doc"}
                </button>
                {exportedDoc ? (
                  <>
                    <button
                      type="button"
                      onClick={downloadPdf}
                      className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 px-4 py-2.5 text-sm font-semibold cursor-pointer transition-colors duration-200"
                    >
                      ⬇ PDF
                    </button>
                    <button
                      type="button"
                      onClick={downloadTxt}
                      className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 px-4 py-2.5 text-sm font-semibold cursor-pointer transition-colors duration-200"
                    >
                      ⬇ .txt
                    </button>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {exportedDoc ? (
            <section className="mt-6 rounded-xl border border-white/10 bg-slate-900/50 p-6">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                <div
                  className="text-[10px] uppercase tracking-[0.14em] text-slate-400"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  collaborator document preview · only accepted clauses changed
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={downloadPdf}
                    className="text-xs px-3 py-1.5 rounded-md bg-white text-slate-950 font-semibold hover:bg-slate-200 cursor-pointer transition-colors duration-200"
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={downloadTxt}
                    className="text-xs px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 cursor-pointer transition-colors duration-200"
                  >
                    .txt
                  </button>
                </div>
              </div>
              <pre
                className="whitespace-pre-wrap text-sm text-slate-200 max-h-[500px] overflow-y-auto m-0 bg-slate-950/60 border border-white/5 rounded-lg p-4"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {exportedDoc}
              </pre>
            </section>
          ) : null}
        </>
      ) : null}
    </DarkAppShell>
  );
}
