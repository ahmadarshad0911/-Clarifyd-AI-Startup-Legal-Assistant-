"use client";

/**
 * /copilot — Broadsheet · v6
 *
 * Editorial draft-room. Template ledger left, chat panel right.
 * Preserves: useAuth.client.copilotGuidance, message thread, profile
 * context, custom builder, doc generation + copy + download.
 */

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, Handshake, FileText, BriefcaseMetal, Receipt, Sparkle, Chat,
  PaperPlaneRight, CheckCircle, X, Download, Copy, Hammer, Compass,
  type Icon,
} from "@phosphor-icons/react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { OrbitalLoader } from "../../components/common/orbital-loader";
import { NoticeModal, type NoticeContent } from "../../components/notice-modal";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import type { CopilotMessage, CopilotMode } from "../../lib/contracts";
import { STARTUP_TEMPLATES } from "../../lib/startup-templates";
import { profileContextLine } from "../../lib/founder-profile";
import { useIsMobile } from "../../lib/use-is-mobile";

type Tile = {
  id: string;
  name: string;
  Icon: Icon;
  blurb: string;
  footer: string;
  mode: CopilotMode;
};
type Active = { id: string; name: string; mode: CopilotMode };

const TILES: Tile[] = [
  { id: "Mutual NDA",            name: "Mutual NDA",            Icon: Handshake,      blurb: "Foundational NDA with strict IP protection for startup-investor talks.", footer: "12 deal terms · score 9.8", mode: "template" },
  { id: "SAFE Note",             name: "SAFE Note",             Icon: FileText,       blurb: "Pre-seed / seed standard agreement, with valuation cap logic.",         footer: "9 deal terms · score 8.4",  mode: "template" },
  { id: "Employment Offer",      name: "Employment Offer",      Icon: BriefcaseMetal, blurb: "Executive letter, invention assignment, equity vesting schedules.",     footer: "18 deal terms · score 9.1", mode: "template" },
  { id: "SaaS Master Agreement", name: "SaaS Master Agreement", Icon: Receipt,        blurb: "MSA covering uptime SLAs, data privacy, and termination rights.",       footer: "25 deal terms · score 7.9", mode: "template" },
  { id: "__custom__",            name: "Custom Template",       Icon: Sparkle,        blurb: "Describe any document. Co-Pilot designs the clauses with you, drafts it from scratch.", footer: "Built to order", mode: "custom" },
  { id: "__chat__",              name: "Startup Q&A",           Icon: Chat,           blurb: "Open chat for legal, fundraising, hiring, IP, or compliance questions.", footer: "Ask anything",              mode: "chat" },
];

const EOQ = [0.23, 1, 0.32, 1] as const;

export default function CopilotPage() {
  const { client } = useAuth();
  const { push } = useToast();
  const reduce = useReducedMotion() ?? false;
  const isMobile = useIsMobile();
  const [active, setActive] = useState<Active | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [doc, setDoc] = useState<string | null>(null);
  const [customDraft, setCustomDraft] = useState("");
  const [notice, setNotice] = useState<NoticeContent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  async function startSession(id: string, name: string, mode: CopilotMode, opener: string) {
    setActive({ id, name, mode });
    setMessages([]);
    setDoc(null);
    setBusy(true);
    try {
      const ctx = profileContextLine();
      const fullOpener = ctx ? `${ctx}\n\n${opener}` : opener;
      const res = await client.copilotGuidance(name, fullOpener, [], mode);
      setMessages([{ role: "assistant", content: res.reply }]);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Co-Pilot failed to start.", "error");
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  function pickTile(t: Tile) {
    if (t.mode === "template") {
      startSession(t.id, t.name, "template", `I want to build a ${t.name}. Walk me through the first deal term I need to provide.`);
    } else if (t.mode === "chat") {
      startSession("Startup Q&A", "Startup Q&A", "chat", "Hi — I'm a startup founder. Introduce yourself briefly and ask what I'd like guidance on.");
    }
  }

  function startCustom() {
    const name = customDraft.trim();
    if (!name) return;
    setCustomDraft("");
    startSession(name, name, "custom", `I want to create a custom document: "${name}". Confirm the purpose and parties, then guide me through the clauses it should contain.`);
  }

  async function send() {
    const text = input.trim();
    if (!text || !active || busy) return;
    const next: CopilotMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    scrollToBottom();
    try {
      const res = await client.copilotGuidance(active.name, text, next, active.mode);
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch (err) {
      if (err instanceof ApiError && err.code === "off_topic_question") {
        setNotice({
          kind: "rejection",
          caption: "STOP PRESS · OFF-TOPIC QUESTION",
          headline: "Clarifyd Co-Pilot only answers legal & startup questions.",
          body:
            err.message ||
            "I can help with contracts, term sheets, NDAs, fundraising, hiring, IP, equity, and compliance — not coding tasks, math problems, or general chat.",
          hint: "Try: 'What should I look for in a SAFE valuation cap?' or 'Explain the cliff in employee vesting.'",
          primaryLabel: "Got it",
        });
        setMessages(messages);  // drop the off-topic turn from history
      } else {
        push(err instanceof ApiError ? err.message : "Co-Pilot request failed.", "error");
        setMessages(next);
      }
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  async function generateDocument() {
    if (!active || generating || active.mode === "chat") return;
    setGenerating(true);
    try {
      let prompt: string;
      const tpl = STARTUP_TEMPLATES[active.id];
      if (active.mode === "template" && tpl) {
        prompt = `Using the deal terms discussed in our conversation so far, fill in every
{{PLACEHOLDER}} in the template below. If a term was not provided, insert a clearly bracketed
[TO BE CONFIRMED — <term name>] marker instead of guessing. Return ONLY the completed document
text, no commentary.

TEMPLATE (${tpl.name}):
${tpl.body}`;
      } else {
        prompt = `Draft the full "${active.name}" document using everything we discussed in this
conversation. Produce a clean, professionally structured legal document with numbered clauses,
a title, and signature blocks. Where a specific term was not provided, insert a clearly bracketed
[TO BE CONFIRMED — <term name>] marker. Return ONLY the document text, no commentary.`;
      }
      const res = await client.copilotGuidance(active.name, prompt, messages, active.mode);
      setDoc(res.reply);
      push("Document drafted", "success", "Review every clause with counsel before signing.");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Document generation failed.", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function copyDocument() {
    if (!doc) return;
    try {
      await navigator.clipboard.writeText(doc);
      push("Document copied", "success");
    } catch {
      push("Clipboard blocked — select and copy manually.", "error");
    }
  }

  function downloadDocument() {
    if (!doc || !active) return;
    const blob = new Blob([doc], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${active.name.replace(/\s+/g, "-").toLowerCase()}-draft.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusLabel = active
    ? active.mode === "chat" ? "Startup Q&A — ask anything"
      : active.mode === "custom" ? `Custom builder: ${active.name}`
      : `Builder: ${active.name}`
    : "Pick a column to begin";

  return (
    <AppShell>
      {generating ? (
        <OrbitalLoader fullscreen statusLines={["Drafting clauses…", "Filling deal terms…", "Cross-checking…"]} />
      ) : null}

      {/* Plate header */}
      <section style={{ paddingBottom: 22, borderBottom: "1px solid var(--bsd-hairline)" }}>
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EOQ }}
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}
        >
          <div>
            <span className="bsd-kicker" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Compass weight="duotone" size={14} aria-hidden />
              Legal Co-Pilot
            </span>
            <h1 style={{ margin: "10px 0 0", fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.03em", lineHeight: 1.02 }}>
              Draft with <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>precision.</span>
            </h1>
            <p style={{ margin: "12px 0 0", color: "var(--bsd-body)", fontSize: 15, lineHeight: 1.6, maxWidth: 620 }}>
              Pick a vetted template, design a custom document, or open Startup Q&amp;A. Clarifyd Assistant builds with you, clause by clause.
            </p>
          </div>
          <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>
            ◆ Audited 2026
          </span>
        </motion.div>
      </section>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 7fr) minmax(0, 5fr)", gap: isMobile ? 20 : 56, marginTop: 40 }} className="grid-cols-1 lg:grid-cols-[7fr_5fr]">
        {/* Template ledger */}
        <section>
          <div className="cf-mono" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
            <span>Templates &amp; modes</span>
            <span>06 entries</span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {TILES.map((t, i) => {
              const selected =
                (t.mode === "chat" && active?.mode === "chat") ||
                (t.mode === "template" && active?.id === t.id) ||
                (t.mode === "custom" && active?.mode === "custom");

              if (t.mode === "custom") {
                return (
                  <motion.li
                    key={t.id}
                    initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.3, ease: EOQ, delay: i * 0.04 }}
                    style={{ borderBottom: "1px solid var(--bsd-hairline)", padding: "20px 4px", background: selected ? "var(--bsd-paper-deep)" : "transparent" }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 18, alignItems: "center" }}>
                      <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 20, letterSpacing: "-0.02em", fontWeight: 800 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <t.Icon weight="duotone" size={18} color="var(--bsd-red)" aria-hidden />
                          <span style={{ fontSize: 18, fontWeight: 600, color: "var(--bsd-ink)", letterSpacing: "-0.01em" }}>{t.name}</span>
                        </div>
                        <p style={{ margin: "4px 0 12px", fontSize: 13.5, color: "var(--bsd-body)", lineHeight: 1.5 }}>{t.blurb}</p>
                        <div className="bsd-field" style={{ display: "flex", alignItems: "flex-end", gap: 10, maxWidth: 460 }}>
                          <input
                            type="text"
                            value={customDraft}
                            onChange={(e) => setCustomDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") startCustom(); }}
                            placeholder="Advisor Agreement, Co-Founder Vesting…"
                            className="bsd-input"
                            style={{ flex: 1, fontSize: 15 }}
                          />
                          <button
                            type="button"
                            onClick={startCustom}
                            disabled={!customDraft.trim()}
                            className="bsd-btn bsd-btn--sm cursor-pointer"
                          >
                            Start <ArrowRight weight="bold" size={11} />
                          </button>
                        </div>
                      </div>
                      <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, alignSelf: "start" }}>
                        {t.footer}
                      </span>
                    </div>
                  </motion.li>
                );
              }

              return (
                <motion.li
                  key={t.id}
                  initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.3, ease: EOQ, delay: i * 0.04 }}
                  style={{ borderBottom: "1px solid var(--bsd-hairline)" }}
                >
                  <button
                    type="button"
                    onClick={() => pickTile(t)}
                    className={`bsd-row cursor-pointer${selected ? " is-active" : ""}`}
                    style={{
                      width: "100%", textAlign: "left",
                      display: "grid", gridTemplateColumns: "44px 1fr auto 24px",
                      gap: 18, alignItems: "center",
                      padding: "22px 4px",
                      background: selected ? "var(--bsd-paper-deep)" : "transparent",
                      border: "none",
                    }}
                  >
                    <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 20, letterSpacing: "-0.02em", fontWeight: 800 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <t.Icon weight="duotone" size={18} color={selected ? "var(--bsd-red)" : "var(--bsd-muted)"} aria-hidden />
                        <span style={{ fontSize: 18, fontWeight: 600, color: "var(--bsd-ink)", letterSpacing: "-0.01em" }}>{t.name}</span>
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--bsd-body)", lineHeight: 1.5 }}>{t.blurb}</p>
                    </div>
                    <span className="cf-mono" style={{ color: selected ? "var(--bsd-red)" : "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {selected ? "Active" : t.footer}
                    </span>
                    {selected ? (
                      <CheckCircle weight="duotone" size={16} color="var(--bsd-red)" aria-hidden />
                    ) : (
                      <ArrowRight className="bsd-row__caret" weight="bold" size={14} color="var(--bsd-soft)" aria-hidden />
                    )}
                  </button>
                </motion.li>
              );
            })}
          </ul>
        </section>

        {/* Chat panel */}
        <section style={{ position: isMobile ? "static" : "sticky", top: isMobile ? undefined : 120, alignSelf: "start" }}>
          <div style={{ border: "2px solid var(--bsd-ink)", background: "var(--bsd-paper)", display: "flex", flexDirection: "column", height: 620 }}>
            <div style={{ borderBottom: "2px solid var(--bsd-ink)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--bsd-paper-deep)" }}>
              <div style={{ minWidth: 0 }}>
                <div className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                  Clarifyd Assistant
                </div>
                <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--bsd-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {statusLabel}
                </div>
              </div>
              {active ? (
                <button
                  type="button"
                  onClick={() => { setActive(null); setMessages([]); setDoc(null); }}
                  className="cursor-pointer cf-mono"
                  style={{ background: "transparent", border: "none", color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, padding: 4 }}
                >
                  Close ✕
                </button>
              ) : null}
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
              {!active ? (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
                  <Hammer weight="duotone" size={36} color="var(--bsd-red)" />
                  <p style={{ margin: 0, color: "var(--bsd-muted)", fontSize: 13.5, maxWidth: 260, lineHeight: 1.55 }}>
                    Pick a column or open Startup Q&amp;A. Clarifyd Assistant takes it from there.
                  </p>
                </div>
              ) : messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "88%",
                    padding: "12px 14px",
                    background: m.role === "user" ? "var(--bsd-ink)" : "var(--bsd-paper-deep)",
                    color: m.role === "user" ? "var(--bsd-paper)" : "var(--bsd-ink)",
                    border: m.role === "user" ? "none" : "1px solid var(--bsd-hairline)",
                    fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap",
                  }}
                >
                  {m.role === "assistant" ? (
                    <div className="cf-mono" style={{ fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800, color: "var(--bsd-red)", marginBottom: 6 }}>
                      Reply
                    </div>
                  ) : null}
                  {m.content}
                </div>
              ))}
              {busy ? (
                <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--bsd-red)", animation: "cf-pulse 1s ease-in-out infinite" }} />
                  Composing…
                </div>
              ) : null}
            </div>

            <div style={{ borderTop: "1.5px solid var(--bsd-ink)", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, background: "var(--bsd-paper-deep)" }}>
              {active && active.mode !== "chat" ? (
                <button
                  type="button"
                  onClick={generateDocument}
                  disabled={generating || busy}
                  className="bsd-btn cursor-pointer"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <FileText weight="duotone" size={12} />
                  {generating ? "Drafting…" : "Generate document"}
                </button>
              ) : null}
              <div className="bsd-field" style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                  disabled={!active || busy}
                  placeholder={active ? (active.mode === "chat" ? "Ask a startup legal question…" : "Type a deal term or a question…") : "Pick a column first"}
                  className="bsd-input"
                  style={{ flex: 1, fontSize: 15 }}
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={!active || busy || !input.trim()}
                  className="bsd-btn bsd-btn--sm cursor-pointer"
                  aria-label="Send"
                  style={{ flexShrink: 0 }}
                >
                  <PaperPlaneRight weight="bold" size={12} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Generated document */}
      {doc ? (
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
                {active?.name ?? "Generated"} · draft
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={copyDocument} className="bsd-btn bsd-btn--ghost bsd-btn--sm cursor-pointer">
                <Copy weight="bold" size={11} /> Copy
              </button>
              <button type="button" onClick={downloadDocument} className="bsd-btn bsd-btn--sm cursor-pointer">
                <Download weight="bold" size={11} /> Download
              </button>
            </div>
          </div>
          <pre style={{ margin: 0, padding: "22px 24px", background: "var(--bsd-paper)", fontFamily: "Geist Mono, monospace", fontSize: 13.5, color: "var(--bsd-ink)", lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 600, overflowY: "auto" }}>
            {doc}
          </pre>
        </motion.section>
      ) : null}
      <NoticeModal
        open={notice !== null}
        notice={notice}
        onClose={() => setNotice(null)}
      />
    </AppShell>
  );
}
