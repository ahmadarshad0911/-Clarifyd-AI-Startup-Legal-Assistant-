"use client";

/**
 * /negotiation — Broadsheet · v6
 *
 * "Across the table" negotiation lab. Master doc + counter-party doc drop
 * zones, pipeline ledger, tactical feed of loopholes with pickable counter-
 * offers, collaboration-vault finalize plate. Preserves analyzeContract +
 * copilotGuidance API contract.
 */

import {
  ChangeEvent, DragEvent, useRef, useState, type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, Check, FileText, FilePlus, Quotes, Handshake, Download,
  ShieldCheck, Warning, type Icon,
} from "@phosphor-icons/react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { OrbitalLoader } from "../../components/common/orbital-loader";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import { useIsMobile } from "../../lib/use-is-mobile";
import type { AnalyzeContractResponse, ReportSuggestion } from "../../lib/contracts";
import { profileContextLine } from "../../lib/founder-profile";

const EOQ = [0.23, 1, 0.32, 1] as const;
const SEV_COLOR: Record<string, string> = {
  low:      "var(--bsd-sev-low)",
  medium:   "var(--bsd-sev-medium)",
  high:     "var(--bsd-sev-high)",
  critical: "var(--bsd-sev-critical)",
};

export default function NegotiationLabPage() {
  const { client } = useAuth();
  const { push } = useToast();
  const reduce = useReducedMotion() ?? false;
  const isMobile = useIsMobile();

  const [masterName, setMasterName] = useState<string | null>(null);
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
      push("Counter-party doc analyzed", "success", `${n} loophole${n === 1 ? "" : "s"} flagged.`);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Analysis failed.", "error");
      setCounterName(null);
    } finally {
      setAnalyzing(false);
    }
  }

  function togglePick(i: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  async function finalize() {
    if (!analysis || finalizing) return;
    const chosen: ReportSuggestion[] = suggestions.filter((_, i) => picked.has(i));
    if (!chosen.length) { push("Pick at least one suggested clause first.", "info"); return; }
    setFinalizing(true);
    try {
      const clauseBlock = chosen
        .map((s, i) => `${i + 1}. CLAUSE: ${s.clause_name}\n   REPLACES: "${s.original_excerpt}"\n   AGREED LANGUAGE: ${s.suggested_clause}\n   RATIONALE: ${s.rationale}`)
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
      const res = await client.copilotGuidance("Ultimate Collaboration Agreement", prompt, [], "custom");
      setFinalDoc(res.reply);
      push("Collaboration agreement drafted", "success", "Both-party signature blocks included.");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Finalization failed.", "error");
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

  const pipeline: { label: string; done: boolean }[] = [
    { label: "Uploaded",  done: !!counterName },
    { label: "Extracted", done: !!analysis },
    { label: "Tagged",    done: !!analysis },
    { label: "Reasoned",  done: !!report },
  ];
  const activeIdx = pipeline.findIndex((s) => !s.done);

  return (
    <AppShell>
      {(analyzing || finalizing) ? (
        <OrbitalLoader
          fullscreen
          statusLines={finalizing
            ? ["Merging agreed clauses…", "Drafting final agreement…", "Adding signature blocks…"]
            : ["Extracting counter-party clauses…", "Clarifyd AI reasoning…", "Mapping loopholes…"]}
        />
      ) : null}

      {/* Plate */}
      <section style={{ paddingBottom: 22, borderBottom: "1px solid var(--bsd-hairline)" }}>
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EOQ }}
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32, flexWrap: "wrap" }}
        >
          <div>
            <span className="bsd-kicker" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Handshake weight="duotone" size={14} aria-hidden />
              Negotiation lab · Volume I
            </span>
            <h1 style={{ margin: "10px 0 0", fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.03em", lineHeight: 1.02 }}>
              Across the <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>table.</span>
            </h1>
            <p style={{ margin: "12px 0 0", color: "var(--bsd-body)", fontSize: 15, lineHeight: 1.6, maxWidth: 620 }}>
              Upload your master agreement and the counter-party&rsquo;s. We diff the clauses, flag every loophole, and draft the agreed final with signature blocks for both sides.
            </p>
          </div>
          <div style={{ display: "flex", gap: 0, border: "2px solid var(--bsd-ink)" }}>
            <Stat label="Risk score" value={riskScore} tint={analysis ? "var(--bsd-sev-high)" : "var(--bsd-muted)"} />
            <Stat label="Loopholes"  value={String(loopholeCount).padStart(2, "0")} tint={loopholeCount ? "var(--bsd-red)" : "var(--bsd-muted)"} border />
          </div>
        </motion.div>
      </section>

      {/* Docking zones */}
      <section style={{ marginTop: 40 }}>
        <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
          Article I · Docking
        </div>
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)", gap: isMobile ? 16 : 28 }}>
          <DropZone
            order="01"
            label="Master Agreement"
            hint="Drop your current draft to set the baseline."
            Icon={FileText}
            fileName={masterName}
            onPick={(f) => { setMasterName(f.name); }}
          />
          <DropZone
            order="02"
            label="Counter-Party Response"
            hint="Upload the other side&rsquo;s markup. We diff and flag it."
            Icon={FilePlus}
            fileName={counterName}
            onPick={analyzeCounterParty}
            disabled={analyzing}
            active
          />
        </div>
      </section>

      {/* Pipeline */}
      <section style={{ marginTop: 56 }}>
        <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
          Article II · Pipeline
        </div>
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : `repeat(${pipeline.length}, minmax(0, 1fr))`,
            borderTop: "2px solid var(--bsd-ink)",
            borderBottom: "2px solid var(--bsd-ink)",
          }}
        >
          {pipeline.map((step, i, arr) => {
            const isActive = i === activeIdx;
            const done = step.done;
            const tint = done ? "var(--bsd-sev-low)" : isActive ? "var(--bsd-red)" : "var(--bsd-muted)";
            return (
              <div
                key={step.label}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: isMobile ? "16px 14px" : "20px 22px",
                  borderRight: !isMobile && i < arr.length - 1 ? "1px solid var(--bsd-hairline)" : "none",
                  borderBottom: isMobile && i < arr.length - 1 ? "1px solid var(--bsd-hairline)" : "none",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 30, height: 30, borderRadius: "50%",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    background: done ? "var(--bsd-sev-low)" : isActive ? "var(--bsd-red)" : "transparent",
                    color: done || isActive ? "var(--bsd-paper)" : "var(--bsd-muted)",
                    border: done || isActive ? "none" : "1.5px solid var(--bsd-rule)",
                    fontFamily: "Geist Mono, monospace", fontWeight: 800, fontSize: 11,
                    boxShadow: isActive ? `0 0 0 5px var(--bsd-red-ring)` : "none",
                    transition: "background 240ms ease, box-shadow 240ms ease",
                  }}
                >
                  {done ? <Check weight="bold" size={13} /> : String(i + 1).padStart(2, "0")}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="cf-mono" style={{ color: tint, fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800 }}>
                    {step.label}
                  </div>
                  <div className="cf-mono" style={{ marginTop: 2, color: "var(--bsd-muted)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                    {done ? "Done" : isActive ? "In progress" : "Pending"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tactical feed */}
      {analysis ? (
        <section style={{ marginTop: 56, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 8fr) minmax(0, 4fr)", gap: isMobile ? 28 : 56, alignItems: "start" }}>
          <div>
            <div className="cf-mono" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
              <span>Article III · Tactical feed</span>
              <span>{loopholeCount} loophole{loopholeCount === 1 ? "" : "s"}</span>
            </div>

            {loopholeCount === 0 ? (
              <div style={{ marginTop: 22, border: "2px dashed var(--bsd-rule)", padding: 40, textAlign: "center", color: "var(--bsd-muted)" }}>
                Clarifyd AI found no critical loopholes in the counter-party document.
              </div>
            ) : (
              <ol style={{ margin: "0", padding: 0, listStyle: "none" }}>
                {loopholes.map((lp, i) => {
                  const sg = suggestions[i];
                  const isPicked = picked.has(i);
                  const tint = SEV_COLOR[lp.severity] ?? "var(--bsd-ink)";
                  return (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ duration: 0.3, ease: EOQ, delay: i * 0.03 }}
                      style={{
                        borderBottom: i < loopholes.length - 1 ? "1px dotted var(--bsd-hairline)" : "2px solid var(--bsd-ink)",
                        padding: "26px 4px",
                        background: isPicked ? "var(--bsd-paper-deep)" : "transparent",
                        transition: "background 220ms ease",
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "32px 1fr" : "44px 1fr auto", gap: isMobile ? "8px 12px" : 18, alignItems: "baseline" }}>
                        <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: isMobile ? 16 : 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <h3 style={{ margin: 0, fontSize: isMobile ? 16 : 19, fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.015em" }}>
                          {lp.clause_name}
                        </h3>
                        <span
                          className="cf-mono"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "4px 9px",
                            border: `1px solid ${tint}`,
                            color: tint,
                            fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800,
                            gridColumn: isMobile ? "2 / -1" : "auto",
                            justifySelf: isMobile ? "start" : "auto",
                            width: "max-content",
                          }}
                        >
                          <Warning weight="duotone" size={10} /> {lp.severity}
                        </span>
                      </div>

                      <div style={{ paddingLeft: isMobile ? 0 : 62, marginTop: 14 }}>
                        <blockquote style={{ margin: 0, padding: "10px 16px", borderLeft: `2px solid ${tint}`, fontStyle: "italic", color: "var(--bsd-ink)", fontSize: 14.5, lineHeight: 1.55, background: "var(--bsd-paper-deep)" }}>
                          &ldquo;{lp.excerpt}&rdquo;
                        </blockquote>
                        <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--bsd-body)", lineHeight: 1.6 }}>
                          <span className="cf-mono" style={{ color: "var(--bsd-red)", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800, fontSize: 10, marginRight: 8 }}>Issue</span>
                          {lp.issue}
                        </p>
                        <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--bsd-body)", lineHeight: 1.6 }}>
                          <span className="cf-mono" style={{ color: "var(--bsd-red)", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800, fontSize: 10, marginRight: 8 }}>Impact</span>
                          {lp.impact}
                        </p>

                        {sg ? (
                          <div style={{ marginTop: 16, padding: "16px 18px", border: "1.5px solid var(--bsd-ink)", background: "var(--bsd-paper)" }}>
                            <div className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800, marginBottom: 8 }}>
                              Counter-offer
                            </div>
                            <p style={{ margin: 0, fontSize: 14, color: "var(--bsd-ink)", lineHeight: 1.6, fontFamily: "Geist Mono, monospace" }}>
                              {sg.suggested_clause}
                            </p>
                            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--bsd-muted)", lineHeight: 1.5 }}>
                              <span className="cf-mono" style={{ color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, fontSize: 9.5, marginRight: 6 }}>Why</span>
                              {sg.rationale}
                            </p>
                            <button
                              type="button"
                              onClick={() => togglePick(i)}
                              className="cursor-pointer cf-mono"
                              style={{
                                marginTop: 14,
                                display: "inline-flex", alignItems: "center", gap: 7,
                                padding: "9px 16px",
                                background: isPicked ? "var(--bsd-sev-low)" : "var(--bsd-ink)",
                                color: "var(--bsd-paper)",
                                border: `1.5px solid ${isPicked ? "var(--bsd-sev-low)" : "var(--bsd-ink)"}`,
                                fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800,
                                transition: "background 220ms ease, border-color 220ms ease",
                              }}
                            >
                              {isPicked ? <><Check weight="bold" size={11} /> Selected</> : <>Apply this clause <ArrowRight weight="bold" size={11} /></>}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </motion.li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Right rail: summary */}
          <aside style={{ position: "sticky", top: 120, alignSelf: "start" }}>
            <div style={{ border: "2px solid var(--bsd-ink)", background: "var(--bsd-paper)" }}>
              <div style={{ padding: "14px 18px", background: "var(--bsd-ink)", color: "var(--bsd-paper)" }}>
                <div className="cf-mono" style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                  Negotiation summary
                </div>
                <div style={{ marginTop: 4, fontSize: 17, fontWeight: 700, letterSpacing: "-0.015em" }}>
                  {counterName ?? "Untitled negotiation"}
                </div>
              </div>
              <div style={{ padding: "18px" }}>
                <SummaryRow label="Verdict"           value={analysis.summary.highest_risk} bold capitalize />
                <SummaryRow label="Loopholes flagged" value={String(loopholeCount)} />
                <SummaryRow label="Clauses selected"  value={String(picked.size)} tint="var(--bsd-sev-low)" />
                <SummaryRow label="Overall score"     value={`${riskScore} / 10`} />
              </div>
              {report?.executive_summary ? (
                <div style={{ padding: "16px 18px", borderTop: "1px dashed var(--bsd-rule)", background: "var(--bsd-paper-deep)" }}>
                  <div className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800, marginBottom: 8 }}>
                    Executive summary
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--bsd-body)", lineHeight: 1.55 }}>
                    {report.executive_summary}
                  </p>
                </div>
              ) : null}
            </div>
          </aside>
        </section>
      ) : null}

      {/* Finalize plate */}
      {analysis ? (
        <section style={{ marginTop: 56, background: "var(--bsd-ink)", color: "var(--bsd-paper)" }}>
          <div style={{ padding: "44px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 540 }}>
              <div className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 800 }}>
                The collaboration vault
              </div>
              <h2 style={{ margin: "10px 0 0", fontSize: 34, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.05 }}>
                {picked.size} clause{picked.size === 1 ? "" : "s"} agreed.<br />
                <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>Merge them into the final.</span>
              </h2>
              <p style={{ margin: "12px 0 0", fontSize: 14, color: "#cfc8b8", lineHeight: 1.6 }}>
                We assemble a board-ready agreement with signature blocks for both parties. Review every clause with counsel before signature.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 220 }}>
              <button
                type="button"
                onClick={finalize}
                disabled={finalizing || picked.size === 0}
                className="cursor-pointer cf-mono"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "14px 22px",
                  background: "var(--bsd-red)", color: "var(--bsd-paper)",
                  border: "1.5px solid var(--bsd-red)",
                  fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 800,
                  transition: "background 200ms ease, transform 100ms ease",
                  opacity: picked.size === 0 || finalizing ? 0.5 : 1,
                  cursor: picked.size === 0 || finalizing ? "not-allowed" : "pointer",
                }}
              >
                <Handshake weight="duotone" size={13} />
                {finalizing ? "Drafting…" : "Generate final agreement"}
                <ArrowRight weight="bold" size={11} />
              </button>
              {finalDoc ? (
                <button
                  type="button"
                  onClick={downloadFinal}
                  className="cursor-pointer cf-mono"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "12px 20px",
                    background: "transparent", color: "var(--bsd-paper)",
                    border: "1.5px solid var(--bsd-paper)",
                    fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800,
                  }}
                >
                  <Download weight="bold" size={11} /> Download .txt
                </button>
              ) : null}
            </div>
          </div>
          <div className="cf-mono" style={{ padding: "10px 40px", borderTop: "1px solid rgba(244, 237, 225, 0.18)", fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "#9b9181", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck weight="duotone" size={11} color="var(--bsd-red)" />
            Private to your account · Founder-ready DOCX export
          </div>
        </section>
      ) : null}

      {/* Final document */}
      {finalDoc ? (
        <motion.section
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EOQ }}
          style={{ marginTop: 56, border: "2px solid var(--bsd-ink)", background: "var(--bsd-paper-deep)" }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1.5px solid var(--bsd-ink)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                Galley proof
              </span>
              <span style={{ fontSize: 16, color: "var(--bsd-ink)", fontWeight: 600 }}>
                Ultimate Collaboration Agreement
              </span>
            </div>
            <button type="button" onClick={downloadFinal} className="bsd-btn bsd-btn--sm cursor-pointer">
              <Download weight="bold" size={11} /> Download
            </button>
          </div>
          <pre style={{ margin: 0, padding: "22px 24px", background: "var(--bsd-paper)", fontFamily: "Geist Mono, monospace", fontSize: 13.5, color: "var(--bsd-ink)", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 600, overflowY: "auto" }}>
            {finalDoc}
          </pre>
        </motion.section>
      ) : null}
    </AppShell>
  );
}

function Stat({ label, value, tint, border }: { label: string; value: string; tint: string; border?: boolean }) {
  return (
    <div
      style={{
        padding: "14px 22px",
        borderLeft: border ? "1px solid var(--bsd-ink)" : "none",
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
        minWidth: 120,
      }}
    >
      <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </span>
      <span className="cf-mono" style={{ fontSize: 26, color: tint, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
        {value}
      </span>
    </div>
  );
}

function SummaryRow({ label, value, bold, capitalize, tint }: { label: string; value: string; bold?: boolean; capitalize?: boolean; tint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dotted var(--bsd-hairline)" }}>
      <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </span>
      <span style={{ color: tint ?? "var(--bsd-ink)", fontSize: 14, fontWeight: bold ? 800 : 600, textTransform: capitalize ? "capitalize" : "none" }}>
        {value}
      </span>
    </div>
  );
}

type DropZoneProps = {
  order: string;
  label: string;
  hint: ReactNode;
  Icon: Icon;
  fileName: string | null;
  onPick: (file: File) => void;
  disabled?: boolean;
  active?: boolean;
};

function DropZone({ order, label, hint, Icon, fileName, onPick, disabled, active }: DropZoneProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onPick(f);
  }
  function handlePick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) onPick(f);
  }

  const filled = !!fileName;
  const bg = filled ? "var(--bsd-paper-deep)" : over ? "var(--bsd-paper-deep)" : "var(--bsd-paper)";
  const border = filled ? "2px solid var(--bsd-ink)" : over ? "2px solid var(--bsd-red)" : "2px dashed var(--bsd-rule)";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && ref.current?.click()}
      onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) ref.current?.click(); }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      style={{
        position: "relative",
        padding: 28,
        minHeight: 220,
        background: bg,
        border,
        display: "flex", flexDirection: "column", gap: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 220ms ease, border-color 220ms ease, transform 100ms ease",
        transform: over ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <input ref={ref} type="file" accept=".pdf,.docx" onChange={handlePick} disabled={disabled} className="hidden" />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span className="cf-mono" style={{ color: active ? "var(--bsd-red)" : "var(--bsd-muted)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
          Doc {order}
        </span>
        <Icon weight="duotone" size={22} color={filled ? "var(--bsd-red)" : "var(--bsd-muted)"} aria-hidden />
      </div>
      <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.015em" }}>
        {label}
      </h3>
      {filled ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto", paddingTop: 16, borderTop: "1px dashed var(--bsd-rule)" }}>
          <Check weight="bold" size={13} color="var(--bsd-red)" aria-hidden />
          <span className="cf-mono" style={{ fontSize: 12, color: "var(--bsd-ink)", letterSpacing: "0.10em", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fileName}
          </span>
          <span className="cf-mono" style={{ marginLeft: "auto", fontSize: 9.5, color: "var(--bsd-muted)", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
            Replace ✎
          </span>
        </div>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 14, color: "var(--bsd-body)", lineHeight: 1.55 }}>{hint}</p>
          <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px dashed var(--bsd-rule)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="cf-mono" style={{ fontSize: 10, color: "var(--bsd-muted)", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
              .pdf · .docx · ≤ 10 MB
            </span>
            <span className="cf-mono" style={{ fontSize: 10, color: over ? "var(--bsd-red)" : "var(--bsd-ink)", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}>
              Drop or click <ArrowRight weight="bold" size={11} />
            </span>
          </div>
        </>
      )}
    </div>
  );
}
