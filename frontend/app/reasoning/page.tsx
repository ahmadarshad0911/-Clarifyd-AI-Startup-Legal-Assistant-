"use client";

/**
 * /reasoning — Broadsheet · v6
 *
 * Editorial "Engine deliberation" plate. Draft picker + evaluate runs the
 * reasoning engine; ranked findings render as ledger rows. Q&A panel
 * (founder advisor) attaches below. Preserves client.reasoningEvaluate +
 * reasoningGuidance contracts.
 */

import { FormEvent, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, Check, Warning, Quotes, Lightning, Chat, Brain,
} from "@phosphor-icons/react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type {
  ReasoningEvaluateResponse,
  ReasoningGuidanceResponse,
} from "../../lib/contracts";
import { listRecent, type RecentDraft } from "../../lib/recent";
import { useToast } from "../../lib/toast";
import { useIsMobile } from "../../lib/use-is-mobile";

const EOQ = [0.23, 1, 0.32, 1] as const;
const SEV_COLOR: Record<string, string> = {
  low:      "var(--bsd-sev-low)",
  medium:   "var(--bsd-sev-medium)",
  high:     "var(--bsd-sev-high)",
  critical: "var(--bsd-sev-critical)",
};

export default function ReasoningPage() {
  const { client } = useAuth();
  const { push } = useToast();
  const reduce = useReducedMotion() ?? false;
  const isMobile = useIsMobile();

  const [recent, setRecent] = useState<RecentDraft[]>([]);
  const [draftId, setDraftId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReasoningEvaluateResponse | null>(null);

  const [question, setQuestion] = useState("");
  const [findingId, setFindingId] = useState("");
  const [guidance, setGuidance] = useState<ReasoningGuidanceResponse | null>(null);
  const [askBusy, setAskBusy] = useState(false);

  useEffect(() => { setRecent(listRecent()); }, []);

  async function onEvaluate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draftId.trim()) return;
    setBusy(true);
    try {
      const r = await client.reasoningEvaluate(draftId.trim());
      setResult(r);
      push(`Evaluated ${r.findings.length} finding(s)`, "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Evaluate failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onAsk(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draftId.trim() || !question.trim()) return;
    setAskBusy(true);
    try {
      const r = await client.reasoningGuidance(draftId.trim(), question.trim(), findingId.trim() || undefined);
      setGuidance(r);
      if (r.refused) push(`Refused: ${r.refusal_reason}`, "info");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Guidance failed.", "error");
    } finally {
      setAskBusy(false);
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
            <span className="bsd-kicker" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Brain weight="duotone" size={14} aria-hidden />
              Engine deliberation · Volume I
            </span>
            <h1 style={{ margin: "10px 0 0", fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.03em", lineHeight: 1.02 }}>
              Reason it <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>back through.</span>
            </h1>
            <p style={{ margin: "12px 0 0", color: "var(--bsd-body)", fontSize: 15, lineHeight: 1.6, maxWidth: 620 }}>
              Re-run the analyzer over an existing draft. Findings come back ranked by risk, with founder-language explainers and suggested safer clauses per item.
            </p>
          </div>
          <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>
            ◆ {result?.findings.length ?? 0} findings
          </span>
        </motion.div>
      </section>

      {/* Section A: Evaluate */}
      <section style={{ marginTop: 40 }}>
        <div className="cf-mono" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
            <span>Article I · Evaluate a draft</span>
          <span>{recent.length} on file</span>
        </div>

        <form
          onSubmit={onEvaluate}
          style={{
            display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) auto", gap: 18, alignItems: "end",
            padding: "24px 0",
            borderBottom: "1px solid var(--bsd-hairline)",
          }}
        >
          <DraftSelector
            label="Draft"
            value={draftId}
            onChange={setDraftId}
            recent={recent}
          />
          <button
            type="submit"
            disabled={busy || !draftId.trim()}
            className="bsd-btn cursor-pointer"
            style={{ alignSelf: "end" }}
          >
            <Lightning weight="duotone" size={12} />
            {busy ? "Reading…" : "Evaluate"}
            <ArrowRight weight="bold" size={11} />
          </button>
        </form>

        {result ? <Findings result={result} reduce={reduce} /> : null}
      </section>

      {/* Section B: Q&A */}
      <section style={{ marginTop: 56 }}>
        <div className="cf-mono" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
          <span>Article II · Founder advisor</span>
          <span>Q&amp;A · non-jurisdictional</span>
        </div>
        <p style={{ margin: "16px 0 0", fontSize: 14, color: "var(--bsd-body)", lineHeight: 1.6, maxWidth: 620 }}>
          Ask a question about the same draft. Jurisdiction-specific legal opinions are refused with a "consult licensed counsel" pointer.
        </p>

        <form
          onSubmit={onAsk}
          style={{
            display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)", gap: isMobile ? "16px" : "20px 36px",
            padding: "24px 0",
            borderBottom: "1px solid var(--bsd-hairline)",
          }}
          className="grid-cols-1 md:grid-cols-2"
        >
          <DraftSelector label="Draft" value={draftId} onChange={setDraftId} recent={recent} />
          <SimpleField label="Finding id (optional)" value={findingId} onChange={setFindingId} placeholder="f_abc123…" />
          <div style={{ gridColumn: isMobile ? "auto" : "1 / -1" }}>
            <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
              Question
            </div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What does this clause mean for me in plain English?"
              rows={3}
              className="bsd-input"
              style={{ fontSize: 16, resize: "vertical" }}
            />
          </div>
          <button
            type="submit"
            disabled={askBusy || !draftId.trim() || !question.trim()}
            className="bsd-btn cursor-pointer"
            style={{ gridColumn: isMobile ? "auto" : "1 / -1", alignSelf: "start", justifySelf: "start" }}
          >
            <Chat weight="duotone" size={12} />
            {askBusy ? "Asking…" : "Ask the advisor"}
            <ArrowRight weight="bold" size={11} />
          </button>
        </form>

        {guidance ? (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EOQ }}
            style={{
              marginTop: 24,
              border: "2px solid var(--bsd-ink)",
              padding: 26,
              background: guidance.refused ? "var(--bsd-paper-deep)" : "var(--bsd-paper)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Quotes weight="duotone" size={20} color="var(--bsd-red)" aria-hidden />
              <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                {guidance.refused ? "Refused" : "Advisor response"}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 16, color: "var(--bsd-ink)", lineHeight: 1.6 }}>{guidance.answer}</p>
            {guidance.refused ? (
              <p className="cf-mono" style={{ margin: "12px 0 0", color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                Reason: {guidance.refusal_reason}
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </section>
    </AppShell>
  );
}

function Findings({ result, reduce }: { result: ReasoningEvaluateResponse; reduce: boolean }) {
  const risky = result.findings.filter((f) => f.risk_level !== "low");
  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 24, color: "var(--bsd-ink)", fontWeight: 700, letterSpacing: "-0.02em" }}>
          {risky.length} risky clause{risky.length === 1 ? "" : "s"} surfaced.
        </h2>
        <span
          className="cf-mono"
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "5px 11px",
            border: `1.5px solid ${SEV_COLOR[result.overall_risk_level] ?? "var(--bsd-ink)"}`,
            color: SEV_COLOR[result.overall_risk_level] ?? "var(--bsd-ink)",
            fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800,
          }}
        >
          Overall · {result.overall_risk_level} · {result.overall_risk_score}/100
        </span>
      </div>
      <p className="cf-mono" style={{ margin: 0, color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
        Engine · {result.model}
      </p>

      {risky.length === 0 ? (
        <div style={{ marginTop: 22, border: "2px dashed var(--bsd-rule)", padding: 40, textAlign: "center", color: "var(--bsd-muted)" }}>
          No risky clauses surfaced. Walks like a clean draft.
        </div>
      ) : (
        <ol style={{ margin: "24px 0 0", padding: 0, listStyle: "none", borderTop: "2px solid var(--bsd-ink)", borderBottom: "2px solid var(--bsd-ink)" }}>
          {risky.map((f, i) => (
            <motion.li
              key={f.finding_id}
              initial={{ opacity: 0, y: reduce ? 0 : 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.3, ease: EOQ, delay: i * 0.03 }}
              style={{ borderBottom: i < risky.length - 1 ? "1px dotted var(--bsd-hairline)" : "none", padding: "24px 4px" }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 18, alignItems: "baseline" }}>
                <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.015em" }}>
                  {f.clause_name}
                </h3>
                <span
                  className="cf-mono"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 8px",
                    border: `1px solid ${SEV_COLOR[f.risk_level] ?? "var(--bsd-ink)"}`,
                    color: SEV_COLOR[f.risk_level] ?? "var(--bsd-ink)",
                    fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800,
                  }}
                >
                  {f.risk_level} · {f.risk_score}/100 · {Math.round(f.confidence * 100)}%
                </span>
              </div>

              <div style={{ paddingLeft: 62, marginTop: 10 }}>
                <p className="cf-mono" style={{ margin: 0, color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                  Categories: {f.categories.join(" · ") || "—"}
                  {f.injection_suspected ? (<span style={{ color: "var(--bsd-red)", marginLeft: 10 }}><Warning weight="bold" size={10} style={{ verticalAlign: "middle" }} /> Injection suspected</span>) : null}
                </p>
                <blockquote style={{ margin: "14px 0 0", padding: "10px 16px", borderLeft: "2px solid var(--bsd-red)", fontStyle: "italic", color: "var(--bsd-ink)", fontSize: 14.5, lineHeight: 1.55, background: "var(--bsd-paper-deep)" }}>
                  {f.excerpt}
                </blockquote>
                <p style={{ margin: "14px 0 0", fontSize: 14.5, color: "var(--bsd-body)", lineHeight: 1.6 }}>
                  {f.founder_guidance.plain_english}
                </p>
                <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--bsd-muted)", lineHeight: 1.55 }}>
                  <span className="cf-mono" style={{ color: "var(--bsd-red)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, fontSize: 10.5, marginRight: 6 }}>Why</span>
                  {f.founder_guidance.why_it_matters}
                </p>
                {f.founder_guidance.suggested_language ? (
                  <div style={{ marginTop: 14, padding: "12px 16px", border: "1.5px solid var(--bsd-ink)", background: "var(--bsd-paper)" }}>
                    <div className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 800, marginBottom: 6 }}>
                      Suggested safer clause
                    </div>
                    <p style={{ margin: 0, fontSize: 14, color: "var(--bsd-ink)", lineHeight: 1.6, fontFamily: "Geist Mono, monospace" }}>
                      {f.founder_guidance.suggested_language}
                    </p>
                  </div>
                ) : null}
                {f.founder_guidance.negotiation_points.length > 0 ? (
                  <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                    {f.founder_guidance.negotiation_points.map((p, j) => (
                      <li key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "var(--bsd-body)", lineHeight: 1.55 }}>
                        <Check weight="bold" size={12} color="var(--bsd-red)" style={{ marginTop: 4, flexShrink: 0 }} aria-hidden />
                        {p}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </motion.li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DraftSelector({
  label, value, onChange, recent,
}: { label: string; value: string; onChange: (v: string) => void; recent: RecentDraft[] }) {
  return (
    <div>
      <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
        {label}
      </div>
      {recent.length ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bsd-input"
          style={{ fontSize: 16, appearance: "none", cursor: "pointer", paddingRight: 28 }}
        >
          <option value="">Select a draft…</option>
          {recent.map((r) => (
            <option key={r.draft_id} value={r.draft_id}>{r.file_name}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="draft_id (no recent drafts on file)"
          className="bsd-input"
          style={{ fontSize: 16, fontFamily: "Geist Mono, monospace" }}
        />
      )}
    </div>
  );
}

function SimpleField({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
        {label}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bsd-input"
        style={{ fontSize: 16, fontFamily: "Geist Mono, monospace" }}
      />
    </div>
  );
}
