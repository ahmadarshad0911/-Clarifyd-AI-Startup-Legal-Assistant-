"use client";

import { useRef, useState } from "react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { OrbitalLoader } from "../../components/common/orbital-loader";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import type { CopilotMessage, CopilotMode } from "../../lib/contracts";
import { STARTUP_TEMPLATES } from "../../lib/startup-templates";
import { profileContextLine } from "../../lib/founder-profile";

type Tile = {
  id: string;
  name: string;
  icon: string;
  iconClass: string;
  blurb: string;
  footer: string;
  score?: string;
  scoreGlyph?: string;
  mode: CopilotMode;
};

type Active = { id: string; name: string; mode: CopilotMode };

const TEMPLATE_TILES: Tile[] = [
  {
    id: "Mutual NDA",
    name: "Mutual NDA",
    icon: "handshake",
    iconClass: "bg-primary/10 text-primary",
    blurb:
      "Foundational non-disclosure agreement with strict IP protection clauses for startup-investor discussions.",
    footer: "12 deal terms",
    score: "9.8",
    scoreGlyph: "▪",
    mode: "template",
  },
  {
    id: "SAFE Note",
    name: "SAFE Note",
    icon: "description",
    iconClass: "bg-accent-violet/10 text-accent-violet",
    blurb:
      "Standard Agreement for Future Equity, optimized for pre-seed and seed rounds with valuation cap logic.",
    footer: "9 deal terms",
    score: "8.4",
    scoreGlyph: "▲",
    mode: "template",
  },
  {
    id: "Employment Offer",
    name: "Employment Offer",
    icon: "badge",
    iconClass: "bg-status-success/10 text-status-success",
    blurb:
      "Executive-level employment letter including invention assignment and equity vesting schedules.",
    footer: "18 deal terms",
    score: "9.1",
    scoreGlyph: "◆",
    mode: "template",
  },
  {
    id: "SaaS Master Agreement",
    name: "SaaS Master Agreement",
    icon: "receipt_long",
    iconClass: "bg-status-info/10 text-status-info",
    blurb:
      "Comprehensive services agreement covering uptime SLAs, data privacy, and termination rights.",
    footer: "25 deal terms",
    score: "7.9",
    scoreGlyph: "⬣",
    mode: "template",
  },
  {
    id: "__custom__",
    name: "Custom Template",
    icon: "auto_fix",
    iconClass: "bg-onboarding-gold/10 text-onboarding-gold",
    blurb:
      "Describe any document you need — Clarifyd Assistant designs the clauses with you, then drafts it from scratch.",
    footer: "Built to order",
    mode: "custom",
  },
  {
    id: "__chat__",
    name: "Startup Q&A",
    icon: "forum",
    iconClass: "bg-status-info/10 text-status-info",
    blurb:
      "Open chat for any legal, fundraising, hiring, IP, or compliance question — guidance, not documents.",
    footer: "Ask anything",
    mode: "chat",
  },
];

export default function CopilotPage() {
  const { client } = useAuth();
  const { push } = useToast();
  const [active, setActive] = useState<Active | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [doc, setDoc] = useState<string | null>(null);
  const [customDraft, setCustomDraft] = useState("");
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
      startSession(
        t.id,
        t.name,
        "template",
        `I want to build a ${t.name}. Walk me through the first deal term I need to provide.`
      );
    } else if (t.mode === "chat") {
      startSession(
        "Startup Q&A",
        "Startup Q&A",
        "chat",
        "Hi — I'm a startup founder. Introduce yourself briefly and ask what I'd like guidance on."
      );
    }
    // custom handled by the custom-name form
  }

  function startCustom() {
    const name = customDraft.trim();
    if (!name) return;
    setCustomDraft("");
    startSession(
      name,
      name,
      "custom",
      `I want to create a custom document: "${name}". Confirm the purpose and parties, then guide me through the clauses it should contain.`
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
      const res = await client.copilotGuidance(active.name, text, next, active.mode);
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Co-Pilot request failed.", "error");
      setMessages(next);
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
      push("Document copied to clipboard", "success");
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
    ? active.mode === "chat"
      ? "Startup Q&A — ask anything"
      : active.mode === "custom"
      ? `Custom builder: ${active.name}`
      : `Active: ${active.name} Builder`
    : "Pick a tile to start";

  return (
    <AppShell>
      {generating ? (
        <OrbitalLoader
          fullscreen
          statusLines={["Drafting clauses…", "Filling deal terms…", "Cross-checking…"]}
        />
      ) : null}

      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <span className="font-label-caps text-label-caps text-primary tracking-widest uppercase mb-2 block">
            Legal Co-Pilot
          </span>
          <h2 className="font-display-hero text-3xl md:text-4xl text-onboarding-navy mb-3">
            Draft with precision
          </h2>
          <p className="text-on-surface-variant leading-relaxed">
            Pick a vetted template, design a custom document from scratch, or just ask the
            Kimi-powered assistant any startup legal question.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full crystal-glass border-onboarding-gold/30 w-fit">
          <span
            className="material-symbols-outlined text-onboarding-gold text-sm"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified
          </span>
          <span className="text-xs font-bold text-onboarding-gold font-label-caps uppercase">
            Audited 2026
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        {/* Tile gallery */}
        <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
          {TEMPLATE_TILES.map((t) => {
            const selected =
              (t.mode === "chat" && active?.mode === "chat") ||
              (t.mode === "template" && active?.id === t.id) ||
              (t.mode === "custom" && active?.mode === "custom");

            if (t.mode === "custom") {
              return (
                <div
                  key={t.id}
                  className={`crystal-glass p-6 rounded-3xl text-left transition-all ${
                    selected ? "ring-2 ring-primary ring-offset-2" : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${t.iconClass}`}
                    >
                      <span className="material-symbols-outlined text-h2">{t.icon}</span>
                    </div>
                  </div>
                  <h3 className="font-h3 text-h3 text-on-surface mb-2">{t.name}</h3>
                  <p className="text-on-surface-variant text-body-sm mb-4">{t.blurb}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customDraft}
                      onChange={(e) => setCustomDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") startCustom();
                      }}
                      placeholder="e.g. Advisor Agreement, Co-Founder Vesting…"
                      className="flex-1 min-w-0 bg-white border border-white/70 rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-primary text-body-sm"
                    />
                    <button
                      type="button"
                      onClick={startCustom}
                      disabled={!customDraft.trim()}
                      className="w-10 h-10 shrink-0 bg-onboarding-gold text-white rounded-full flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50"
                      aria-label="Start custom builder"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTile(t)}
                className={`crystal-glass p-6 rounded-3xl text-left transition-all group hover:-translate-y-1 ${
                  selected ? "ring-2 ring-primary ring-offset-2" : ""
                }`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${t.iconClass}`}
                  >
                    <span className="material-symbols-outlined text-h2">{t.icon}</span>
                  </div>
                  {t.score ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-white/60 rounded text-[10px] font-bold text-on-surface-variant uppercase">
                      <span>{t.scoreGlyph}</span>
                      <span>Score {t.score}</span>
                    </div>
                  ) : null}
                </div>
                <h3 className="font-h3 text-h3 text-on-surface mb-2">{t.name}</h3>
                <p className="text-on-surface-variant text-body-sm mb-6">{t.blurb}</p>
                <div className="flex items-center justify-between border-t border-white/50 pt-4">
                  <span className="text-xs text-on-surface-variant font-label-caps uppercase">
                    {selected ? "Active" : t.footer}
                  </span>
                  <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">
                    {selected ? "check_circle" : "arrow_forward"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Builder / chat */}
        <div className="lg:col-span-5 lg:sticky lg:top-[120px] flex flex-col crystal-glass rounded-3xl overflow-hidden border-2 border-primary/20 h-[600px]">
          <div className="p-4 bg-white/40 border-b border-white/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg">
                  <span className="material-symbols-outlined">auto_awesome</span>
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-status-success rounded-full border-2 border-white" />
              </div>
              <div>
                <p className="font-bold text-body-sm m-0">Clarifyd Assistant</p>
                <p className="text-[10px] text-on-surface-variant flex items-center gap-1 m-0">
                  <span className="inline-block w-1.5 h-1.5 bg-status-success rounded-full" />
                  {statusLabel}
                </p>
              </div>
            </div>
            {active ? (
              <button
                type="button"
                onClick={() => {
                  setActive(null);
                  setMessages([]);
                }}
                className="material-symbols-outlined text-on-surface-variant p-1 hover:bg-black/5 rounded"
                aria-label="Close builder"
              >
                close
              </button>
            ) : null}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5">
            {!active ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                <span className="material-symbols-outlined text-primary/40 text-[56px]">
                  smart_toy
                </span>
                <p className="text-on-surface-variant text-body-sm max-w-[240px]">
                  Pick a template, name a custom document, or open Startup Q&amp;A — Clarifyd Assistant
                  takes it from there.
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col gap-1 max-w-[85%] ${
                    m.role === "user" ? "self-end items-end ml-auto" : ""
                  }`}
                >
                  <div
                    className={`p-4 text-body-sm whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-primary text-white rounded-2xl rounded-tr-none shadow-md"
                        : "bg-white rounded-2xl rounded-tl-none shadow-sm border border-white/80"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {busy ? (
              <div className="flex items-center gap-2 text-on-surface-variant text-body-sm">
                <span className="material-symbols-outlined animate-spin text-[18px]">
                  progress_activity
                </span>
                Clarifyd Assistant is thinking…
              </div>
            ) : null}
          </div>

          <div className="p-4 bg-white/40 border-t border-white/50 space-y-3">
            {active && active.mode !== "chat" ? (
              <button
                type="button"
                onClick={generateDocument}
                disabled={generating || busy}
                className="btn-capsule btn-capsule-primary w-full text-sm"
              >
                <span className="material-symbols-outlined text-[18px]">draft</span>
                {generating ? "Drafting document…" : "Generate document"}
              </button>
            ) : null}
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                disabled={!active || busy}
                placeholder={
                  active
                    ? active.mode === "chat"
                      ? "Ask a startup legal question…"
                      : "Type a deal term or ask a question…"
                    : "Pick a tile first"
                }
                className="w-full bg-white border border-white/70 rounded-full px-6 py-3 pr-12 outline-none focus:ring-2 focus:ring-primary shadow-sm text-body-sm disabled:opacity-60"
              />
              <button
                type="button"
                onClick={send}
                disabled={!active || busy || !input.trim()}
                className="absolute right-2 top-1.5 w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50"
                aria-label="Send"
              >
                <span className="material-symbols-outlined text-sm">send</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {doc ? (
        <section className="crystal-glass rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">description</span>
              <h3 className="font-h3 text-h3 text-onboarding-navy m-0">
                {active?.name ?? "Generated document"} — draft
              </h3>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={copyDocument}
                className="btn-capsule glass-semi-clear text-primary text-sm px-5"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                Copy
              </button>
              <button
                type="button"
                onClick={downloadDocument}
                className="btn-capsule btn-capsule-primary text-sm px-5"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download
              </button>
            </div>
          </div>
          <pre className="bg-white/70 rounded-2xl p-6 text-body-sm whitespace-pre-wrap font-code-snippet text-on-surface max-h-[600px] overflow-y-auto m-0">
            {doc}
          </pre>
        </section>
      ) : null}

      <div className="rounded-2xl bg-[#B45309]/80 text-white py-3 px-6 text-center" role="note">
        <p className="text-xs font-bold tracking-tight m-0">
          <span className="material-symbols-outlined align-middle mr-1 text-sm">gavel</span>
          NOT LEGAL ADVICE: Clarifyd Assistant is an AI tool, not a law firm. Consult a qualified attorney
          before executing any document.
        </p>
      </div>
    </AppShell>
  );
}
