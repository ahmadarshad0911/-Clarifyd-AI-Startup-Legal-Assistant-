"use client";

/**
 * Dashboard — dark editorial.
 *
 * Self-contained upload + recent-drafts list. Doesn't depend on the
 * aurora-themed UploadCard / RecentDrafts components (those still serve
 * other routes until reskinned in a later phase).
 *
 * Flow:
 *   - User drops a PDF/DOCX or pastes text
 *   - POST /analyze/contract or /analyze/text
 *   - On success: push to analyses store, redirect to /findings?draft=…
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

import { DarkAppShell } from "../../components/shell/dark-app-shell";
import { ApiError } from "../../lib/api";
import { pushAnalysis, listAnalyses, type StoredAnalysis } from "../../lib/analyses";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

type Mode = "file" | "text";

export default function DashboardPage() {
  const router = useRouter();
  const { client, me, role } = useAuth();
  const { push } = useToast();
  const [mode, setMode] = useState<Mode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<StoredAnalysis[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(listAnalyses().slice(0, 5));
  }, []);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f) {
      setFile(f);
      setError(null);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) {
      setFile(f);
      setError(null);
    }
  }

  async function analyze() {
    setError(null);
    setSubmitting(true);
    try {
      let res;
      let source: string;
      if (mode === "file") {
        if (!file) throw new Error("Pick a file first.");
        res = await client.analyzeContract(file);
        source = file.name;
      } else {
        if (text.trim().length < 40)
          throw new Error("Paste at least 40 characters of contract text.");
        const srcName = name.trim() || "Pasted contract";
        res = await client.analyzeText(text, srcName);
        source = srcName;
      }
      pushAnalysis(res, source);
      push("Analysis ready", "success", `${res.findings.length} finding(s).`);
      router.push(`/findings?draft=${encodeURIComponent(res.draft_id)}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.message} [${err.status}]`
          : err instanceof Error
            ? err.message
            : "Analysis failed.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !submitting && (mode === "file" ? !!file : text.trim().length >= 40);

  return (
    <DarkAppShell>
      {/* Greeting */}
      <div className="mb-8">
        <div
          className="text-[10px] uppercase tracking-[0.18em] text-violet-400"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          ↳ workspace
        </div>
        <h1 className="mt-2 text-3xl text-white font-semibold tracking-tight">
          {`Welcome${me?.email ? `, ${me.email.split("@")[0]}` : ""}.`}
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Drop a contract. We score every clause and write replacement language.
          {role === "admin" ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 text-[10px] text-violet-300 font-semibold uppercase tracking-wider">
              admin
            </span>
          ) : null}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* ============ Upload card ============ */}
        <section className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden">
          {/* Mode toggle */}
          <div className="flex border-b border-white/5">
            {(["file", "text"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors duration-200 cursor-pointer ${
                  mode === m
                    ? "text-white bg-white/[0.04] border-b-2 border-indigo-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {m === "file" ? "Upload PDF / DOCX" : "Paste text"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {mode === "file" ? (
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
                className={`group relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 ${
                  over
                    ? "border-indigo-400 bg-indigo-950/30"
                    : "border-white/10 hover:border-white/30 hover:bg-white/[0.02]"
                } px-6 py-12 text-center`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={onFile}
                  className="sr-only"
                />
                <div className="text-4xl text-slate-600 group-hover:text-indigo-400 transition-colors duration-200 mb-3">
                  ⤴
                </div>
                {file ? (
                  <>
                    <div className="text-sm text-slate-100 font-semibold truncate">
                      {file.name}
                    </div>
                    <div
                      className="mt-1 text-xs text-slate-500"
                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {fmtBytes(file.size)} · {file.type || "unknown type"}
                    </div>
                    <div className="mt-3 text-xs text-indigo-300">
                      Click to swap, or hit Analyze →
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-slate-300 font-medium">
                      Drop a contract here
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      or click to choose · PDF or DOCX · max 10 MB
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label
                    className="text-[10px] uppercase tracking-[0.14em] text-slate-500"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    Source name (optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. VendorCo MSA v2"
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                  />
                </div>
                <div>
                  <label
                    className="text-[10px] uppercase tracking-[0.14em] text-slate-500"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    Contract text
                  </label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste the full contract here…"
                    rows={10}
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all resize-y"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  />
                  <div
                    className="mt-1 text-[11px] text-slate-500 text-right"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {text.length.toLocaleString()} chars · need ≥ 40
                  </div>
                </div>
              </div>
            )}

            {error ? (
              <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
                ⚠ {error}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-between gap-4">
              <p
                className="text-[11px] text-slate-500"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {submitting
                  ? "↳ analyzing… first time ~60s, cached ~1s"
                  : "Kimi K2 · citation-grounded · zero hallucinations"}
              </p>
              <button
                type="button"
                onClick={analyze}
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
              >
                {submitting ? "Analyzing…" : "Analyze →"}
              </button>
            </div>
          </div>
        </section>

        {/* ============ Recent drafts ============ */}
        <aside className="rounded-xl border border-white/10 bg-slate-900/40">
          <div
            className="px-5 py-3 border-b border-white/5 text-[10px] uppercase tracking-[0.14em] text-slate-500"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            recent drafts
          </div>
          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">
              No drafts yet. Your first analysis will appear here.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {recent.map((d, i) => {
                const verdict = (d.analysis?.report?.verdict ?? "").toLowerCase();
                const color =
                  verdict === "critical"
                    ? "text-rose-400"
                    : verdict === "high"
                      ? "text-amber-300"
                      : verdict === "medium"
                        ? "text-sky-300"
                        : "text-slate-400";
                const dotColor =
                  verdict === "critical"
                    ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                    : verdict === "high"
                      ? "bg-amber-400 shadow-[0_0_8px_#fbbf24]"
                      : verdict === "medium"
                        ? "bg-sky-400 shadow-[0_0_8px_#38bdf8]"
                        : "bg-slate-600";
                const n = d.analysis?.findings?.length ?? 0;
                return (
                  <li key={d.draft_id ?? i}>
                    <Link
                      href={`/findings?draft=${encodeURIComponent(d.draft_id ?? "")}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-200 truncate">
                          {d.file_name || "Untitled"}
                        </div>
                        <div
                          className="text-[10px] uppercase tracking-[0.14em] text-slate-500"
                          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                          {n} finding{n === 1 ? "" : "s"} ·{" "}
                          <span className={color}>
                            {verdict || "pending"}
                          </span>
                        </div>
                      </div>
                      <span className="text-slate-600 text-sm">→</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
            <Link
              href="/findings"
              className="text-xs text-indigo-300 hover:text-indigo-200 font-semibold cursor-pointer transition-colors duration-200"
            >
              See all →
            </Link>
            <Link
              href="/exports"
              className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer transition-colors duration-200"
            >
              Audit log
            </Link>
          </div>
        </aside>
      </div>

      {/* ============ Quick links ============ */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            title: "Negotiate",
            body: "Track contracts you're actively pushing back on.",
            href: "/negotiation",
          },
          {
            title: "Co-Pilot",
            body: "Ask Kimi K2 anything about a clause.",
            href: "/copilot",
          },
          {
            title: "Audit",
            body: "Hash-chained log of every analysis + export.",
            href: "/exports",
          },
        ].map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className="group rounded-xl border border-white/10 bg-slate-900/30 hover:bg-slate-900/60 px-5 py-4 transition-colors duration-200 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-white font-semibold">{c.title}</div>
              <span className="text-slate-600 group-hover:text-slate-300 transition-colors duration-200">
                →
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">{c.body}</p>
          </Link>
        ))}
      </div>
    </DarkAppShell>
  );
}
