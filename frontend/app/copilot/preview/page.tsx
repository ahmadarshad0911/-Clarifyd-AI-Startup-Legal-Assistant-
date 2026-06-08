"use client";

/**
 * /copilot/preview — Clarifyd AI · redesign preview
 *
 * Standalone review route; does NOT replace /copilot. Two entry options only
 * (no template tiles — the Library covers those): Startup Q&A and Custom
 * Template. The chatbot is the centerpiece and opens as an animated popup
 * (right-docked panel on desktop, near-fullscreen sheet on mobile) from a
 * floating launcher. Streaming, off-topic handling, doc generation, and
 * session persistence are ported verbatim from the live page.
 *
 * Design: product register (impeccable). Motion conveys state (popup open,
 * launcher, draft reveal), never page-load decoration; no numbered-section
 * scaffolding; no em dashes in copy.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, Chat, Sparkle, PaperPlaneRight, X, Download, Copy,
  FileText, Compass, PenNib, ChatCircleDots,
} from "@phosphor-icons/react";

import { DarkAppShell as AppShell } from "../../../components/shell/dark-app-shell";
import { OrbitalLoader } from "../../../components/common/orbital-loader";
import { NoticeModal, type NoticeContent } from "../../../components/notice-modal";
import { ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useToast } from "../../../lib/toast";
import type { CopilotMessage, CopilotMode } from "../../../lib/contracts";
import { STARTUP_TEMPLATES } from "../../../lib/startup-templates";
import { profileContextLine } from "../../../lib/founder-profile";
import { readJSON, writeJSON } from "../../../lib/user-storage";
import { useIsMobile } from "../../../lib/use-is-mobile";

// Distinct key from the live page so the preview never collides with a
// real in-progress session on /copilot.
const SESSION_KEY = "clarifyd.copilot-preview-session";

type Active = { id: string; name: string; mode: CopilotMode };
type SavedSession = {
  active?: Active | null;
  messages?: CopilotMessage[];
  doc?: string | null;
  open?: boolean;
};

const EOQ = [0.23, 1, 0.32, 1] as const;
const SPRING = { type: "spring" as const, stiffness: 380, damping: 32, mass: 0.9 };

// The assistant emits this token (instructed in the custom opener) only once
// it has collected every detail needed to draft. The "Generate document"
// action stays hidden until it appears, and the token is stripped from the
// visible reply so the founder never sees it.
const READY_TOKEN = "READY_TO_DRAFT";
function stripReadyToken(text: string): string {
  return text.replace(new RegExp(`\\s*${READY_TOKEN}\\s*`, "g"), " ").trimEnd();
}

export default function CopilotPreviewPage() {
  const { client } = useAuth();
  const { push } = useToast();
  const reduce = useReducedMotion() ?? false;
  const isMobile = useIsMobile();

  const saved = useRef<SavedSession>(readJSON<SavedSession>(SESSION_KEY, {}));
  const [active, setActive] = useState<Active | null>(saved.current.active ?? null);
  const [messages, setMessages] = useState<CopilotMessage[]>(saved.current.messages ?? []);
  const [doc, setDoc] = useState<string | null>(saved.current.doc ?? null);
  const [open, setOpen] = useState<boolean>(saved.current.open ?? false);
  const [input, setInput] = useState("");
  const [customDraft, setCustomDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<NoticeContent | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    writeJSON(SESSION_KEY, { active, messages, doc, open });
  }, [active, messages, doc, open]);

  // Lock body scroll + Escape-to-close while the popup is open, and move
  // focus to the chat input so keyboard users land inside the dialog.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const startSession = useCallback(
    async (id: string, name: string, mode: CopilotMode, opener: string) => {
      setActive({ id, name, mode });
      setMessages([]);
      setDoc(null);
      setOpen(true);
      setBusy(true);
      try {
        const res = await client.copilotGuidance(name, opener, [], mode, profileContextLine());
        setMessages([{ role: "assistant", content: res.reply }]);
      } catch (err) {
        push(err instanceof ApiError ? err.message : "Clarifyd AI failed to start.", "error");
      } finally {
        setBusy(false);
        scrollToBottom();
      }
    },
    [client, push, scrollToBottom],
  );

  function openChat() {
    if (active?.mode === "chat") {
      setOpen(true);
      return;
    }
    startSession(
      "Startup Q&A", "Startup Q&A", "chat",
      "Hi — I'm a startup founder. Introduce yourself briefly and ask what I'd like guidance on.",
    );
  }

  function startCustom() {
    const name = customDraft.trim();
    if (!name) return;
    setCustomDraft("");
    startSession(
      name, name, "custom",
      `I want to create a custom document: "${name}". Confirm the purpose and parties, then guide me through the clauses it should contain, asking for each required detail ONE at a time. Only once you have gathered every detail needed to draft a complete document, end that single message with the token ${READY_TOKEN} on its own line. Never output that token before you truly have everything.`,
    );
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
      setMessages([...next, { role: "assistant", content: "" }]);
      await client.copilotGuidanceStream(active.name, text, next, active.mode, (chunk) => {
        setMessages((cur) => {
          const copy = [...cur];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            copy[copy.length - 1] = { role: "assistant", content: last.content + chunk };
          }
          return copy;
        });
        scrollToBottom();
      }, profileContextLine());
    } catch (err) {
      if (err instanceof ApiError && err.code === "off_topic_question") {
        setNotice({
          kind: "rejection",
          caption: "STOP PRESS · OFF-TOPIC QUESTION",
          headline: "Clarifyd AI only answers legal & startup questions.",
          body:
            err.message ||
            "I can help with contracts, term sheets, NDAs, fundraising, hiring, IP, equity, and compliance, but not coding tasks, math problems, or general chat.",
          hint: "Try: 'What should I look for in a SAFE valuation cap?' or 'Explain the cliff in employee vesting.'",
          primaryLabel: "Got it",
        });
        setMessages(messages); // drop the off-topic turn from history
      } else {
        push(err instanceof ApiError ? err.message : "Clarifyd AI request failed.", "error");
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
      const res = await client.copilotGuidance(active.name, prompt, messages, active.mode, profileContextLine());
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

  function resetSession() {
    setActive(null);
    setMessages([]);
    setDoc(null);
    setOpen(false);
  }

  const statusLabel = active
    ? active.mode === "chat" ? "Startup Q&A · ask anything"
      : active.mode === "custom" ? `Custom builder · ${active.name}`
      : `Builder · ${active.name}`
    : "New session";

  const hasThread = active !== null && messages.length > 0;
  const qaResuming = active?.mode === "chat" && messages.length > 0;
  // Show "Generate document" only after the assistant signals it has every
  // detail (sticky once seen, so later turns don't hide it again).
  const readyToDraft =
    active !== null &&
    active.mode !== "chat" &&
    messages.some((m) => m.role === "assistant" && m.content.includes(READY_TOKEN));

  return (
    <AppShell>
      {generating ? (
        <OrbitalLoader fullscreen statusLines={["Drafting clauses…", "Filling deal terms…", "Cross-checking…"]} />
      ) : null}

      {/* ===== Hero ===== */}
      <section style={{ paddingBottom: 28, borderBottom: "1px solid var(--bsd-hairline)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 720 }}>
            <span className="cf-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--bsd-red)" }}>
              <Compass weight="duotone" size={14} aria-hidden />
              Clarifyd AI · Draft room
            </span>
            <h1 style={{ margin: "12px 0 0", fontSize: "clamp(38px, 6vw, 68px)", fontWeight: 800, color: "var(--bsd-ink)", letterSpacing: "-0.035em", lineHeight: 0.98, textWrap: "balance" }}>
              Your advisor,{" "}
              <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>on call.</span>
            </h1>
            <p style={{ margin: "16px 0 0", color: "var(--bsd-body)", fontSize: 16, lineHeight: 1.6, maxWidth: 560, textWrap: "pretty" }}>
              Ask a founder-grade legal question, or describe a document and draft it clause by
              clause. Clarifyd AI thinks alongside you. It is decision support, not a substitute
              for licensed counsel.
            </p>
          </div>
          <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>
            ◆ Audited 2026
          </span>
        </div>
      </section>

      {/* ===== Two entry options (Q&A primary, Custom secondary) ===== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.08fr 0.92fr",
          gap: isMobile ? 18 : 28,
          marginTop: 40,
          alignItems: "stretch",
        }}
      >
        {/* Q&A — the primary, filled action */}
        <article
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            padding: isMobile ? "24px 20px" : "30px 28px",
            background: "var(--bsd-paper-deep)",
            border: "2px solid var(--bsd-ink)",
          }}
        >
          <ChatCircleDots weight="duotone" size={32} color="var(--bsd-red)" aria-hidden />
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? 24 : 28, fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.025em" }}>
              Startup Q&amp;A
            </h2>
            <p style={{ margin: "10px 0 0", fontSize: 14.5, color: "var(--bsd-body)", lineHeight: 1.55, maxWidth: 420 }}>
              Open chat for legal, fundraising, hiring, IP, or compliance questions. Answers
              stream in, scoped to your founder profile.
            </p>
          </div>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
              Ask anything · streamed
            </span>
            <button
              type="button"
              onClick={openChat}
              className="bsd-btn cursor-pointer"
              style={{ width: "100%", justifyContent: "center", minHeight: 48 }}
            >
              <Chat weight="duotone" size={14} />
              {qaResuming ? "Resume conversation" : "Open chat"}
            </button>
          </div>
        </article>

        {/* Custom Template — secondary, input-led */}
        <article
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            padding: isMobile ? "24px 20px" : "30px 28px",
            background: "var(--bsd-paper)",
            border: "1.5px solid var(--bsd-hairline)",
          }}
        >
          <PenNib weight="duotone" size={30} color="var(--bsd-ink)" aria-hidden />
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.02em" }}>
              Custom Template
            </h2>
            <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--bsd-body)", lineHeight: 1.55, maxWidth: 420 }}>
              Describe any document (an Advisor Agreement, Co-Founder Vesting, a SAFE side letter)
              and Clarifyd AI designs the clauses with you, then drafts it from scratch.
            </p>
          </div>
          <div className="bsd-field" style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", gap: 10 }}>
            <label htmlFor="preview-custom" style={SR_ONLY}>
              Describe the document you want to create
            </label>
            <input
              id="preview-custom"
              type="text"
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") startCustom(); }}
              placeholder="Advisor Agreement, Co-Founder Vesting…"
              className="bsd-input"
              style={{ flex: 1, fontSize: 15, minHeight: 44 }}
            />
            <button
              type="button"
              onClick={startCustom}
              disabled={!customDraft.trim()}
              className="bsd-btn bsd-btn--sm cursor-pointer"
              style={{ minHeight: 44 }}
            >
              Start <ArrowRight weight="bold" size={11} />
            </button>
          </div>
        </article>
      </div>

      {/* ===== Generated document (custom flow output) — revealed on state ===== */}
      <AnimatePresence>
        {doc ? (
          <motion.section
            key="galley"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EOQ }}
            style={{ marginTop: 48, border: "2px solid var(--bsd-ink)", background: "var(--bsd-paper-deep)" }}
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
            <pre style={{ margin: 0, padding: isMobile ? "16px 16px" : "22px 24px", background: "var(--bsd-paper)", fontFamily: "Geist Mono, monospace", fontSize: isMobile ? 12.5 : 13.5, color: "var(--bsd-ink)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: isMobile ? 420 : 600, overflowY: "auto" }}>
              {doc}
            </pre>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {/* ===== Floating launcher (state-driven motion) ===== */}
      <AnimatePresence>
        {!open ? (
          <motion.button
            key="launcher"
            type="button"
            onClick={openChat}
            initial={{ opacity: 0, scale: reduce ? 1 : 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduce ? 1 : 0.7 }}
            transition={reduce ? { duration: 0.16 } : SPRING}
            whileHover={reduce ? undefined : { scale: 1.04 }}
            whileTap={reduce ? undefined : { scale: 0.96 }}
            aria-label={hasThread ? "Resume Clarifyd AI chat" : "Open Clarifyd AI chat"}
            className="cf-mono cursor-pointer"
            style={{
              position: "fixed",
              right: isMobile ? 18 : 28,
              bottom: isMobile ? 18 : 28,
              zIndex: 80,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              minHeight: 56,
              padding: "0 20px",
              background: "var(--bsd-ink)",
              color: "var(--bsd-paper)",
              border: "2px solid var(--bsd-ink)",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 800,
              boxShadow: "0 14px 40px -14px rgba(12,10,8,0.45)",
            }}
          >
            <Chat weight="duotone" size={20} color="var(--bsd-red)" aria-hidden />
            {isMobile ? null : (hasThread ? "Resume Clarifyd AI" : "Ask Clarifyd AI")}
            {hasThread ? (
              <span
                aria-hidden
                style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--bsd-red)", animation: "cf-pulse 1.4s ease-in-out infinite" }}
              />
            ) : null}
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* ===== Chat popup (the centerpiece) ===== */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EOQ }}
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 90,
              background: "rgba(12, 10, 8, 0.46)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              display: "flex",
              alignItems: isMobile ? "flex-end" : "center",
              justifyContent: isMobile ? "stretch" : "flex-end",
              padding: isMobile ? 0 : "0 28px 28px 28px",
            }}
          >
            <motion.section
              key="popup"
              role="dialog"
              aria-modal="true"
              aria-labelledby="clarifyd-ai-popup-title"
              onClick={(e) => e.stopPropagation()}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: isMobile ? 40 : 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: isMobile ? 40 : 12 }}
              transition={reduce ? { duration: 0.16 } : SPRING}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "var(--bsd-paper)",
                border: "2px solid var(--bsd-ink)",
                width: isMobile ? "100%" : 460,
                maxWidth: "100%",
                height: isMobile ? "90dvh" : "min(680px, 82dvh)",
                boxShadow: "0 28px 80px -24px rgba(12,10,8,0.55)",
              }}
            >
              {/* Header */}
              <header style={{ borderBottom: "2px solid var(--bsd-ink)", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--bsd-paper-deep)" }}>
                <div style={{ minWidth: 0 }}>
                  <div id="clarifyd-ai-popup-title" className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                    Clarifyd AI
                  </div>
                  <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--bsd-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {statusLabel}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {hasThread ? (
                    <button
                      type="button"
                      onClick={resetSession}
                      className="cursor-pointer cf-mono"
                      style={{ background: "transparent", border: "none", color: "var(--bsd-muted)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, padding: "8px 8px", minHeight: 44 }}
                    >
                      New
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Minimize chat"
                    className="cursor-pointer"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, background: "transparent", border: "none", color: "var(--bsd-ink)", cursor: "pointer" }}
                  >
                    <X weight="bold" size={18} />
                  </button>
                </div>
              </header>

              {/* Messages */}
              <div
                ref={scrollRef}
                aria-live="polite"
                style={{ flex: 1, overflowY: "auto", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14 }}
              >
                {messages.length === 0 && !busy ? (
                  <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center" }}>
                    <Sparkle weight="duotone" size={34} color="var(--bsd-red)" aria-hidden />
                    <p style={{ margin: 0, color: "var(--bsd-muted)", fontSize: 13.5, maxWidth: 260, lineHeight: 1.55 }}>
                      Ask a startup legal question. Clarifyd AI answers in plain English. This is
                      decision support, not legal advice.
                    </p>
                  </div>
                ) : (
                  messages.map((m, i) => (
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
                      {m.role === "assistant" ? stripReadyToken(m.content) : m.content}
                    </div>
                  ))
                )}
                {busy ? (
                  <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--bsd-red)", animation: "cf-pulse 1s ease-in-out infinite" }} />
                    Composing…
                  </div>
                ) : null}
              </div>

              {/* Composer */}
              <div style={{ borderTop: "1.5px solid var(--bsd-ink)", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, background: "var(--bsd-paper-deep)" }}>
                {readyToDraft ? (
                  <button
                    type="button"
                    onClick={generateDocument}
                    disabled={generating || busy}
                    className="bsd-btn cursor-pointer"
                    style={{ width: "100%", justifyContent: "center", minHeight: 44 }}
                  >
                    <FileText weight="duotone" size={12} />
                    {generating ? "Drafting…" : "Generate document"}
                  </button>
                ) : null}
                <div className="bsd-field" style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <label htmlFor="preview-chat-input" style={SR_ONLY}>
                    Message Clarifyd AI
                  </label>
                  <input
                    id="preview-chat-input"
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                    disabled={!active || busy}
                    placeholder={active?.mode === "chat" ? "Ask a startup legal question…" : "Type a deal term or a question…"}
                    className="bsd-input"
                    style={{ flex: 1, fontSize: 15, minHeight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={!active || busy || !input.trim()}
                    className="bsd-btn bsd-btn--sm cursor-pointer"
                    aria-label="Send message"
                    style={{ flexShrink: 0, minHeight: 44, minWidth: 44 }}
                  >
                    <PaperPlaneRight weight="bold" size={12} />
                  </button>
                </div>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <NoticeModal open={notice !== null} notice={notice} onClose={() => setNotice(null)} />
    </AppShell>
  );
}

const SR_ONLY: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};
