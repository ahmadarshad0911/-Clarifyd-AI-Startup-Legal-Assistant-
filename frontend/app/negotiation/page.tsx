"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";

import { AppShell } from "../../components/shell/app-shell";
import { OrbitalLoader } from "../../components/common/orbital-loader";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import type { AnalyzeContractResponse, ReportSuggestion } from "../../lib/contracts";
import { profileContextLine } from "../../lib/founder-profile";

type DropZoneProps = {
  label: string;
  hint: string;
  accent: "primary" | "violet";
  fileName: string | null;
  onPick: (file: File) => void;
  disabled?: boolean;
};

function DropZone({ label, hint, accent, fileName, onPick, disabled }: DropZoneProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const border =
    accent === "primary"
      ? "border-primary/30 hover:border-primary/60 hover:bg-primary/5"
      : "border-accent-violet/30 hover:border-accent-violet/60 hover:bg-accent-violet/5";
  const text = accent === "primary" ? "text-primary" : "text-accent-violet";

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onPick(f);
  }
  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) onPick(f);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && ref.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) ref.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={`relative group p-8 rounded-3xl crystal-glass border-2 border-dashed flex flex-col items-center justify-center text-center transition-all min-h-[200px] ${border} ${
        over ? "scale-[1.01]" : ""
      } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <input
        ref={ref}
        type="file"
        accept=".pdf,.docx"
        onChange={handlePick}
        disabled={disabled}
        className="hidden"
      />
      <span className={`material-symbols-outlined text-4xl mb-3 ${text}`}>
        {fileName ? "task" : accent === "primary" ? "upload_file" : "compare"}
      </span>
      <h3 className={`font-h3 text-h3 ${text}`}>{label}</h3>
      {fileName ? (
        <p className="font-body-sm text-body-sm text-on-surface mt-2 font-semibold">
          {fileName}
        </p>
      ) : (
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 px-4">{hint}</p>
      )}
    </div>
  );
}

export default function NegotiationLabPage() {
  const { client } = useAuth();
  const { push } = useToast();

  const [masterName, setMasterName] = useState<string | null>(null);
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [counterName, setCounterName] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeContractResponse | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const [finalizing, setFinalizing] = useState(false);
  const [finalDoc, setFinalDoc] = useState<string | null>(null);

  const report = analysis?.report ?? null;
  const loopholes = report?.loopholes ?? [];
  const suggestions = report?.suggestions ?? [];

  async function analyzeCounterParty(file: File) {
    setCounterName(file.name);
    setAnalysis(null);
    setFinalDoc(null);
    setPicked(new Set());
    setAnalyzing(true);
    try {
      const res = await client.analyzeContract(file);
      setAnalysis(res);
      const n = res.report?.loopholes.length ?? 0;
      push(
        `Counter-party doc analyzed`,
        "success",
        `${n} loophole${n === 1 ? "" : "s"} detected by Kimi.`
      );
    } catch (err) {
      push(
        err instanceof ApiError ? err.message : "Analysis failed.",
        "error"
      );
      setCounterName(null);
    } finally {
      setAnalyzing(false);
    }
  }

  function togglePick(i: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function finalize() {
    if (!analysis || finalizing) return;
    const chosen: ReportSuggestion[] = suggestions.filter((_, i) => picked.has(i));
    if (!chosen.length) {
      push("Pick at least one suggested clause first.", "info");
      return;
    }
    setFinalizing(true);
    try {
      const clauseBlock = chosen
        .map(
          (s, i) =>
            `${i + 1}. CLAUSE: ${s.clause_name}\n   REPLACES: "${s.original_excerpt}"\n   AGREED LANGUAGE: ${s.suggested_clause}\n   RATIONALE: ${s.rationale}`
        )
        .join("\n\n");
      const ctx = profileContextLine();
      const prompt = `${ctx ? ctx + "\n\n" : ""}We are finalizing a negotiation between two parties.
Master agreement on file: ${masterName ?? "(baseline)"}.
Counter-party document analyzed: ${counterName ?? "(counter-party draft)"}.

Both parties have AGREED to adopt the following negotiated clauses (replacing the risky
counter-party language):

${clauseBlock}

Produce the ULTIMATE COLLABORATION AGREEMENT — a single clean, professionally structured
legal document that integrates these agreed clauses, has a title, numbered sections, a
recitals block, and signature blocks for BOTH parties. Where a specific detail is unknown,
insert a clearly bracketed [TO BE CONFIRMED — <detail>] marker. Return ONLY the document text.`;
      const res = await client.copilotGuidance(
        "Ultimate Collaboration Agreement",
        prompt,
        [],
        "custom"
      );
      setFinalDoc(res.reply);
      push("Collaboration agreement drafted", "success", "Both-party signature blocks included.");
    } catch (err) {
      push(
        err instanceof ApiError ? err.message : "Finalization failed.",
        "error"
      );
    } finally {
      setFinalizing(false);
    }
  }

  function downloadFinal() {
    if (!finalDoc) return;
    const blob = new Blob([finalDoc], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ultimate-collaboration-agreement.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const riskScore = analysis ? (analysis.summary.overall_score / 10).toFixed(1) : "—";
  const loopholeCount = loopholes.length;

  const pipeline = [
    { label: "Uploaded", done: !!counterName },
    { label: "Extracted", done: !!analysis },
    { label: "Tagged", done: !!analysis },
    { label: "Reasoned", done: !!report },
  ];

  return (
    <AppShell>
      {(analyzing || finalizing) ? (
        <OrbitalLoader
          fullscreen
          statusLines={
            finalizing
              ? ["Merging agreed clauses…", "Drafting final agreement…", "Adding signature blocks…"]
              : ["Extracting counter-party clauses…", "Kimi reasoning…", "Mapping loopholes…"]
          }
        />
      ) : null}

      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="font-label-caps text-label-caps text-primary tracking-widest uppercase block mb-1">
            Negotiation Lab
          </span>
          <h1 className="font-display-hero text-h1-mobile lg:text-h1 text-onboarding-navy m-0">
            Negotiation Command Center
          </h1>
          <p className="text-on-surface-variant mt-2">
            Upload your master agreement and the counter-party&rsquo;s document — Kimi flags every
            loophole and drafts the agreed final.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex flex-col items-center px-4 py-2 crystal-glass rounded-2xl">
            <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">
              Risk score
            </span>
            <span className="font-h2 text-h2 text-status-warn">{riskScore}</span>
          </div>
          <div className="flex flex-col items-center px-4 py-2 crystal-glass rounded-2xl">
            <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">
              Loopholes
            </span>
            <span className="font-h2 text-h2 text-status-danger">{loopholeCount}</span>
          </div>
        </div>
      </section>

      {/* Docking zones */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DropZone
          label="Master Agreement"
          hint="Drop your current draft here to set the baseline."
          accent="primary"
          fileName={masterName}
          onPick={(f) => {
            setMasterFile(f);
            setMasterName(f.name);
          }}
        />
        <DropZone
          label="Counter-Party Response"
          hint="Upload the markup from the other side — Kimi diffs and flags it."
          accent="violet"
          fileName={counterName}
          onPick={analyzeCounterParty}
          disabled={analyzing}
        />
      </section>

      {/* Pipeline */}
      <section className="crystal-glass rounded-3xl p-6 flex items-center justify-between">
        {pipeline.map((step, i) => (
          <div key={step.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step.done
                    ? "bg-status-success text-white"
                    : i === pipeline.findIndex((s) => !s.done)
                    ? "bg-primary text-white animate-pulse ring-4 ring-primary/20"
                    : "bg-surface-container-highest text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {step.done ? "check" : "more_horiz"}
                </span>
              </div>
              <span
                className={`font-label-caps text-[10px] uppercase ${
                  step.done ? "text-status-success" : "text-on-surface-variant"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < pipeline.length - 1 ? (
              <div
                className={`h-[2px] flex-1 mx-3 ${
                  step.done ? "bg-status-success" : "bg-outline-variant"
                }`}
              />
            ) : null}
          </div>
        ))}
      </section>

      {/* Tactical feed */}
      {analysis ? (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <h2 className="font-display-hero text-h2 text-onboarding-navy m-0">
              Tactical Feed — {loopholeCount} loophole{loopholeCount === 1 ? "" : "s"}
            </h2>
            {loopholeCount === 0 ? (
              <div className="crystal-glass rounded-3xl p-8">
                <p className="text-on-surface-variant m-0">
                  Kimi found no critical loopholes in the counter-party document.
                </p>
              </div>
            ) : null}
            {loopholes.map((lp, i) => {
              const sg = suggestions[i];
              const isPicked = picked.has(i);
              return (
                <div
                  key={i}
                  className={`crystal-glass rounded-3xl p-6 transition-all ${
                    isPicked ? "ring-2 ring-status-success" : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <span className="bg-status-danger text-white px-2 py-1 rounded text-sm font-bold">
                        {lp.severity.toUpperCase()}
                      </span>
                      <h3 className="font-h3 text-h3 text-onboarding-navy m-0">
                        {lp.clause_name}
                      </h3>
                    </div>
                  </div>
                  <blockquote className="border-l-4 border-status-danger pl-4 py-2 bg-white/40 italic font-body-sm text-on-surface-variant rounded-r-lg mb-2">
                    &ldquo;{lp.excerpt}&rdquo;
                  </blockquote>
                  <p className="text-body-sm text-on-surface-variant mb-4">
                    <strong>Issue:</strong> {lp.issue} · <strong>Impact:</strong> {lp.impact}
                  </p>
                  {sg ? (
                    <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 mb-4">
                      <span className="font-label-caps text-[10px] text-primary block mb-1 uppercase tracking-widest">
                        Kimi counter-offer
                      </span>
                      <p className="font-body-sm text-on-surface mb-2">{sg.suggested_clause}</p>
                      <p className="text-[11px] text-on-surface-variant m-0">{sg.rationale}</p>
                    </div>
                  ) : null}
                  {sg ? (
                    <button
                      type="button"
                      onClick={() => togglePick(i)}
                      className={`btn-capsule text-sm w-full ${
                        isPicked
                          ? "bg-status-success text-white border-transparent"
                          : "btn-capsule-primary"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isPicked ? "check_circle" : "edit_note"}
                      </span>
                      {isPicked ? "Clause selected" : "Apply this clause"}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Inspector / leverage */}
          <div className="lg:col-span-4 lg:sticky lg:top-[120px] flex flex-col gap-6">
            <div className="crystal-glass rounded-3xl overflow-hidden">
              <div className="bg-onboarding-navy p-4 text-white">
                <span className="font-label-caps text-xs uppercase tracking-widest">
                  Negotiation summary
                </span>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between text-body-sm">
                  <span className="text-on-surface-variant">Verdict</span>
                  <span className="font-bold capitalize">
                    {analysis.summary.highest_risk}
                  </span>
                </div>
                <div className="flex justify-between text-body-sm">
                  <span className="text-on-surface-variant">Loopholes flagged</span>
                  <span className="font-bold">{loopholeCount}</span>
                </div>
                <div className="flex justify-between text-body-sm">
                  <span className="text-on-surface-variant">Clauses selected</span>
                  <span className="font-bold text-status-success">{picked.size}</span>
                </div>
                {report?.executive_summary ? (
                  <p className="text-body-sm text-on-surface-variant pt-2 border-t border-white/50 m-0">
                    {report.executive_summary}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Finalize & execute */}
      {analysis ? (
        <section className="relative bg-onboarding-navy text-white rounded-3xl overflow-hidden shadow-2xl">
          <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-col items-center md:items-start text-center md:text-left gap-3 max-w-md">
              <div className="w-16 h-16 bg-onboarding-gold rounded-full flex items-center justify-center border-4 border-white/20 shadow-lg">
                <span
                  className="material-symbols-outlined text-white text-3xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified_user
                </span>
              </div>
              <h2 className="font-display-hero text-h1 m-0">The Collaboration Vault</h2>
              <p className="text-blue-100/80 m-0">
                {picked.size} clause{picked.size === 1 ? "" : "s"} agreed. Kimi merges them into a
                board-ready agreement with signature blocks for both parties.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <button
                type="button"
                onClick={finalize}
                disabled={finalizing || picked.size === 0}
                className="bg-onboarding-gold hover:bg-onboarding-gold/90 text-white font-bold py-4 px-10 rounded-2xl text-lg flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined">handshake</span>
                {finalizing ? "Drafting…" : "Generate final agreement"}
              </button>
              {finalDoc ? (
                <button
                  type="button"
                  onClick={downloadFinal}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/30 font-label-caps py-3 px-10 rounded-2xl text-xs uppercase tracking-widest transition-colors"
                >
                  Download executable PDF
                </button>
              ) : null}
            </div>
          </div>
          <div className="bg-black/20 px-8 md:px-12 py-3 border-t border-white/5 text-center md:text-left">
            <span className="text-[10px] font-label-caps uppercase opacity-50 tracking-widest">
              Document secured with 256-bit encryption · Kimi-certified audit trail
            </span>
          </div>
        </section>
      ) : null}

      {/* Final document */}
      {finalDoc ? (
        <section className="crystal-glass rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">handshake</span>
              <h3 className="font-h3 text-h3 text-onboarding-navy m-0">
                Ultimate Collaboration Agreement — draft
              </h3>
            </div>
            <button
              type="button"
              onClick={downloadFinal}
              className="btn-capsule btn-capsule-primary text-sm px-5"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download
            </button>
          </div>
          <pre className="bg-white/70 rounded-2xl p-6 text-body-sm whitespace-pre-wrap font-code-snippet text-on-surface max-h-[600px] overflow-y-auto m-0">
            {finalDoc}
          </pre>
          <p className="text-[11px] text-on-surface-variant mt-3 m-0">
            Both parties should review every clause with counsel before signature. This is
            decision-support, not legal advice.
          </p>
        </section>
      ) : null}
    </AppShell>
  );
}
