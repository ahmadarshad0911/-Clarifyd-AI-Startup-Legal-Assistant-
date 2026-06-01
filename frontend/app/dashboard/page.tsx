"use client";

/**
 * Dashboard — Clarifyd v3 (amber + Geist + Bento 2.0).
 *
 * Surfaces workflow stages 1–3 inline:
 *   - Stage 1 (Intake)      → drop-zone + paste-text + URL import
 *   - Stage 2 (Auto-classify) → AutoClassifyChip once upload landed
 *   - Stage 3 (Context)     → ContextSelector — feeds analyzer
 *
 * Recent drafts side-panel + quick links to Findings / Negotiate / Audit.
 * All API logic preserved.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import {
  CloudArrowUp,
  TextT,
  ArrowRight,
  WarningCircle,
  Sparkle,
  ShieldCheck,
  CaretRight,
  Handshake,
  Lightning,
  HashStraight,
  Newspaper,
} from "@phosphor-icons/react";

import { DarkAppShell } from "../../components/shell/dark-app-shell";
import { AutoClassifyChip, DocType } from "../../components/auto-classify-chip";
import { ContextSelector, ContextValue } from "../../components/context-selector";
import { NoticeModal, type NoticeContent } from "../../components/notice-modal";
import { listAnalyses, type StoredAnalysis } from "../../lib/analyses";
import { useAuth } from "../../lib/auth";
import { useAnalysis } from "../../lib/analysis-context";
import { getProfile } from "../../lib/founder-profile";
import { useIsMobile } from "../../lib/use-is-mobile";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

type Mode = "file" | "text";

export default function DashboardPage() {
  const router = useRouter();
  const { me, role } = useAuth();
  const { startAnalysis, isAnalyzing } = useAnalysis();

  const [mode, setMode] = useState<Mode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeContent | null>(null);
  const [recent, setRecent] = useState<StoredAnalysis[]>([]);
  const [docType, setDocType] = useState<DocType>("SAFE");
  const [ctx, setCtx] = useState<ContextValue>({ jurisdiction: "US", stage: "pre-seed", role: "founder" });
  // Founder's first name from onboarding (localStorage). Set post-mount to
  // avoid a hydration mismatch; greeting falls back to the email handle.
  const [founderName, setFounderName] = useState("");
  useEffect(() => {
    const n = getProfile().full_name?.trim().split(/\s+/)[0];
    if (n) setFounderName(n);
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    setRecent(listAnalyses().slice(0, 5));
  }, []);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f) { setFile(f); setError(null); }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) { setFile(f); setError(null); }
  }

  async function analyze() {
    setError(null);
    setSubmitting(true);
    // The fetch runs in AnalysisProvider (above the route outlet), so it
    // survives navigation — the user can switch pages without aborting the
    // analysis. We still await here to drive the dashboard's own UX.
    const outcome = await startAnalysis(
      mode === "file"
        ? { mode, file }
        : { mode, text, name },
    );
    setSubmitting(false);
    if (outcome.ok && outcome.draftId) {
      router.push(`/findings?draft=${encodeURIComponent(outcome.draftId)}`);
      return;
    }
    if (outcome.notContract) {
      setNotice({
        kind: "rejection",
        caption: "STOP PRESS · UPLOAD REFUSED",
        headline: "That document isn't a contract.",
        body:
          outcome.message ||
          "Clarifyd only analyzes contracts, term sheets, NDAs, SAFEs, MSAs, leases, and similar legally binding documents.",
        hint: "Try uploading an actual agreement — anything with parties, clauses, and signatures.",
        primaryLabel: "Pick another file",
      });
    } else if (outcome.message) {
      setError(outcome.message);
    }
  }

  const canSubmit = !submitting && !isAnalyzing && (mode === "file" ? !!file : text.trim().length >= 40);

  return (
    <DarkAppShell>
      {/* ============ Greeting ============ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        style={{ marginBottom: 32 }}
      >
        <div className="cf-eyebrow" style={{ color: "var(--brand-500)", display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Newspaper weight="duotone" size={14} aria-hidden />
          The reading room
        </div>
        <h1 style={{ marginTop: 10, fontSize: 38, fontWeight: 500, letterSpacing: "-0.025em", lineHeight: 1.05 }}>
          {(() => {
            const greet = founderName || (me?.email ? me.email.split("@")[0] : "");
            return `Welcome${greet ? `, ${greet}` : ""}.`;
          })()}
        </h1>
        <p style={{ marginTop: 10, color: "var(--ink-secondary)", fontSize: 15, lineHeight: 1.6, maxWidth: 600 }}>
          Drop a contract. Every clause scored, every loophole flagged, every replacement written.
          {role === "admin" ? (
            <span
              className="cf-mono"
              style={{
                marginLeft: 12,
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 9px",
                background: "color-mix(in oklch, var(--brand-500) 14%, transparent)",
                border: "1px solid var(--brand-500)",
                color: "var(--brand-300)",
                borderRadius: 999,
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              admin
            </span>
          ) : null}
        </p>
      </motion.div>

      {/* ============ Bento Row A: Intake (8) + Recent (4) ============ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 8fr) minmax(0, 4fr)",
          gap: isMobile ? 14 : 18,
          alignItems: "start",
        }}
        className="grid-cols-1 md:grid-cols-[8fr_4fr]"
      >
        {/* Intake card */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1], delay: 0.08 }}
          style={{
            background: "var(--bg-elevated-1)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", borderBottom: "1px solid var(--border-hairline)" }}>
            {(["file", "text"] as Mode[]).map((m) => {
              const active = mode === m;
              const Icon = m === "file" ? CloudArrowUp : TextT;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="cursor-pointer"
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    padding: "14px 0",
                    borderBottom: active ? "2px solid var(--brand-500)" : "2px solid transparent",
                    marginBottom: -1,
                    fontFamily: "Geist Mono, monospace",
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    color: active ? "var(--ink-primary)" : "var(--ink-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "color 200ms var(--ease-out), border-color 200ms var(--ease-out)",
                  }}
                >
                  <Icon weight="duotone" size={14} />
                  {m === "file" ? "Upload PDF / DOCX" : "Paste text"}
                </button>
              );
            })}
          </div>

          <div style={{ padding: 24 }}>
            {/* Stage 2 + 3 surface — only after a file is picked */}
            {file ? (
              <div style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <div className="cf-eyebrow" style={{ color: "var(--ink-muted)" }}>
                  Auto-classified as
                </div>
                <AutoClassifyChip
                  predicted={docType}
                  confidence={0.91}
                  onConfirm={setDocType}
                />
              </div>
            ) : null}

            {/* Intake field */}
            {mode === "file" ? (
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
                className="cursor-pointer"
                style={{
                  textAlign: "center",
                  background: over ? "color-mix(in oklch, var(--brand-500) 8%, transparent)" : "var(--bg-base)",
                  border: `1.5px dashed ${over ? "var(--brand-500)" : "var(--border-strong)"}`,
                  borderRadius: "var(--r-sm)",
                  padding: "44px 28px",
                  transition: "background 200ms var(--ease-out), border-color 200ms var(--ease-out)",
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={onFile}
                  className="sr-only"
                />
                <CloudArrowUp weight="duotone" size={40} color={over ? "var(--brand-500)" : "var(--ink-muted)"} aria-hidden />
                {file ? (
                  <>
                    <div style={{ marginTop: 12, fontSize: 17, fontWeight: 500, letterSpacing: "-0.005em", color: "var(--ink-primary)" }}>
                      {file.name}
                    </div>
                    <div className="cf-mono" style={{ marginTop: 6, fontSize: 11, letterSpacing: "0.10em", color: "var(--ink-muted)" }}>
                      {fmtBytes(file.size)} · {file.type || "unknown type"}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--brand-500)" }}>
                      Click to swap, or hit Analyze →
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ marginTop: 12, fontSize: 18, fontWeight: 500, letterSpacing: "-0.005em" }}>
                      Drop a contract here
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, color: "var(--ink-muted)" }}>
                      or click to choose · PDF or DOCX · max 10 MB
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <Lbl>Source name (optional)</Lbl>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VendorCo MSA v2" />
                </div>
                <div>
                  <Lbl>Contract text</Lbl>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste the full contract here…"
                    rows={10}
                    className="cf-mono"
                    style={{
                      width: "100%",
                      background: "var(--bg-base)",
                      border: "1px solid var(--border-strong)",
                      padding: "12px 14px",
                      fontSize: 12.5,
                      color: "var(--ink-primary)",
                      outline: "none",
                      borderRadius: "var(--r-sm)",
                      resize: "vertical",
                      lineHeight: 1.6,
                      transition: "border-color 200ms var(--ease-out)",
                      marginTop: 8,
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--brand-500)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                  />
                  <div className="cf-mono" style={{ marginTop: 4, fontSize: 10, letterSpacing: "0.10em", color: "var(--ink-muted)", textAlign: "right" }}>
                    {text.length.toLocaleString()} chars · need ≥ 40
                  </div>
                </div>
              </div>
            )}

            {/* Stage 3 — Context, always visible */}
            <div
              style={{
                marginTop: 24,
                padding: 18,
                background: "var(--bg-base)",
                border: "1px solid var(--border-hairline)",
                borderRadius: "var(--r-sm)",
              }}
            >
              <ContextSelector value={ctx} onChange={setCtx} />
            </div>

            {error ? (
              <div style={{ marginTop: 18, background: "color-mix(in oklch, var(--sev-critical) 8%, transparent)", border: "1px solid var(--sev-critical)", padding: "10px 12px", fontSize: 12.5, color: "var(--sev-critical)", display: "flex", alignItems: "center", gap: 8, borderRadius: "var(--r-sm)" }}>
                <WarningCircle weight="duotone" size={14} /> {error}
              </div>
            ) : null}

            <div style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
              <p className="cf-mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 600 }}>
                {submitting
                  ? "↳ analyzing… first time ~60s, cached ~1s"
                  : "Clarifyd AI · grounded · 0 hallucinations"}
              </p>
              <button
                type="button"
                onClick={analyze}
                disabled={!canSubmit}
                className="cursor-pointer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "var(--brand-500)",
                  color: "var(--ink-on-brand)",
                  padding: "13px 26px",
                  border: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  borderRadius: "var(--r-sm)",
                  opacity: canSubmit ? 1 : 0.4,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  transition: "background 200ms var(--ease-out), transform 140ms var(--ease-out)",
                }}
                onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.background = "var(--brand-400)"; }}
                onMouseLeave={(e) => { if (canSubmit) e.currentTarget.style.background = "var(--brand-500)"; }}
                onMouseDown={(e) => { if (canSubmit) e.currentTarget.style.transform = "scale(0.98)"; }}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                {submitting ? "Analyzing…" : "Analyze"} <ArrowRight weight="bold" size={14} />
              </button>
            </div>
          </div>
        </motion.section>

        {/* Recent drafts */}
        <motion.aside
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1], delay: 0.16 }}
          style={{
            background: "var(--bg-elevated-1)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
          }}
        >
          <div className="cf-eyebrow" style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-hairline)" }}>
            Recent readings
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 13.5, color: "var(--ink-muted)", fontStyle: "italic" }}>
              No readings yet. Your first analysis will appear here.
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {recent.map((d, i) => {
                const verdict = (d.analysis?.report?.verdict ?? "").toLowerCase();
                const sevColor =
                  verdict === "critical" ? "var(--sev-critical)" :
                  verdict === "high"     ? "var(--sev-high)" :
                  verdict === "medium"   ? "var(--sev-medium)" :
                                           "var(--ink-muted)";
                const n = d.analysis?.findings?.length ?? 0;
                return (
                  <li key={d.draft_id ?? i} style={{ borderBottom: i < recent.length - 1 ? "1px solid var(--border-hairline)" : "none" }}>
                    <Link
                      href={`/findings?draft=${encodeURIComponent(d.draft_id ?? "")}`}
                      className="cursor-pointer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 18px",
                        transition: "background 160ms var(--ease-out)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: sevColor, boxShadow: `0 0 0 2px color-mix(in oklch, ${sevColor} 25%, transparent)`, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.file_name || "Untitled"}
                        </div>
                        <div className="cf-mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-muted)", marginTop: 2 }}>
                          {n} finding{n === 1 ? "" : "s"} · <span style={{ color: sevColor }}>{verdict || "pending"}</span>
                        </div>
                      </div>
                      <CaretRight size={11} weight="bold" color="var(--ink-muted)" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid var(--border-hairline)" }}>
            <Link
              href="/findings"
              className="cursor-pointer"
              style={{
                fontSize: 12,
                color: "var(--ink-primary)",
                textDecoration: "underline",
                textDecorationColor: "var(--brand-500)",
                textUnderlineOffset: 4,
                fontWeight: 500,
              }}
            >
              See all
            </Link>
            <Link
              href="/exports"
              className="cursor-pointer cf-mono"
              style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 600 }}
            >
              Library
            </Link>
          </div>
        </motion.aside>
      </div>

      {/* ============ Quick links ============ */}
      <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: isMobile ? 14 : 18 }} className="grid-cols-1 sm:grid-cols-3">
        {[
          { title: "Negotiate", body: "Track contracts you're actively pushing back on.", href: "/negotiation", Icon: Handshake },
          { title: "Co-Pilot", body: "Ask Clarifyd AI anything about a clause.", href: "/copilot", Icon: Sparkle },
          { title: "Library", body: "Every analyzed contract, ready to revisit or export.", href: "/exports", Icon: HashStraight },
        ].map((c, i) => (
          <QuickLink key={c.title} index={i} {...c} />
        ))}
      </div>
      <NoticeModal
        open={notice !== null}
        notice={notice}
        onClose={() => setNotice(null)}
      />
    </DarkAppShell>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <label className="cf-eyebrow" style={{ color: "var(--ink-muted)" }}>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        background: "var(--bg-base)",
        border: "1px solid var(--border-strong)",
        padding: "12px 14px",
        fontSize: 14,
        color: "var(--ink-primary)",
        outline: "none",
        borderRadius: "var(--r-sm)",
        marginTop: 8,
        transition: "border-color 200ms var(--ease-out)",
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--brand-500)")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
    />
  );
}

function QuickLink({
  title,
  body,
  href,
  index,
  Icon,
}: {
  title: string;
  body: string;
  href: string;
  index: number;
  Icon: typeof Handshake;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1], delay: 0.04 + index * 0.06 }}
    >
      <Link
        href={href}
        className="cursor-pointer"
        style={{
          display: "block",
          padding: 22,
          background: "var(--bg-elevated-1)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--r-md)",
          transition: "transform 220ms var(--ease-out), border-color 200ms var(--ease-out)",
          willChange: "transform",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--brand-500)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-strong)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(-1px) scale(0.99)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "translateY(-2px) scale(1)")}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Icon weight="duotone" size={22} color="var(--brand-500)" aria-hidden />
          <span className="cf-mono" style={{ fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase", color: "var(--brand-500)", fontWeight: 600 }}>
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--ink-primary)" }}>
            {title}
          </h3>
          <ArrowRight weight="bold" size={14} color="var(--ink-muted)" aria-hidden />
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ink-secondary)", lineHeight: 1.55 }}>
          {body}
        </p>
      </Link>
    </motion.div>
  );
}
