"use client";

/** FAQ — dark editorial. Live filter + category tabs + accordion. */

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";

type Category =
  | "all"
  | "start"
  | "pricing"
  | "security"
  | "reasoning"
  | "account"
  | "billing";

type Faq = { id: string; category: Exclude<Category, "all">; q: string; a: string };

const CATEGORIES: Array<{ v: Category; label: string }> = [
  { v: "all", label: "All" },
  { v: "start", label: "Getting started" },
  { v: "pricing", label: "Pricing" },
  { v: "security", label: "Security" },
  { v: "reasoning", label: "Reasoning" },
  { v: "account", label: "Account" },
  { v: "billing", label: "Billing" },
];

const FAQS: Faq[] = [
  { id: "what-is", category: "start", q: "What is Clarifyd?", a: "Clarifyd is an AI contract risk analyzer for early-stage founders. Upload a PDF or DOCX, get clause-level risk findings, founder-friendly guidance, and an exportable redlined draft. Reasoning runs against Kimi K2 via NVIDIA NIM with a rules-based fallback." },
  { id: "first-analysis", category: "start", q: "How do I run my first analysis?", a: "Sign up (3 free analyses included), open the Dashboard, drop a contract under 25 MB. We extract every clause, score it, and surface the verdict in the Findings tab. From there, jump to the Negotiation Lab to accept Kimi's suggested replacements clause-by-clause and export a collaborator-ready draft." },
  { id: "free-tier", category: "pricing", q: "Is there a free tier?", a: "Yes — 3 analyses per month with rules-only fallback, no credit card. Founder ($29/mo) unlocks Kimi reasoning + PDF export. Growth ($99/mo) adds the collaborator-doc workflow and 20 analyses. Enterprise covers SSO, custom jurisdiction templates and dedicated review." },
  { id: "annual-discount", category: "pricing", q: "Do you offer annual billing?", a: "Yes — paying annually drops the effective price by ~20% across Founder, Growth and Enterprise. Toggle the billing cycle on the pricing page." },
  { id: "data-training", category: "security", q: "Do you train models on my contracts?", a: "No. Customer contracts never train any model. Reasoning calls go directly to the provider (NVIDIA NIM) with no retention beyond the response itself. We additionally cache by sha256 to avoid re-asking the model the same clause twice." },
  { id: "encryption", category: "security", q: "How is my data secured?", a: "AES-256 at rest, TLS 1.3 in transit. Postgres on Neon (serverless, isolated per project). Every reasoning call + login + export is appended to a hash-chained audit log — tamper-evident by default. SSO + IP allowlisting are Enterprise features." },
  { id: "model", category: "reasoning", q: "What model is Clarifyd using?", a: "Kimi K2 reasoning via NVIDIA NIM. Falls back to a deterministic rules engine if the LLM is unreachable — you never see a hard failure. We also cache report outputs so re-reading the same contract is byte-identical and ~116× faster." },
  { id: "accuracy", category: "reasoning", q: "How accurate is the risk scoring?", a: "Each finding ships with a confidence score 0–1. By default we route anything ≥0.7 confidence + high/critical severity to your review queue. Multi-pass cross-verification (rules + LLM) reduces hallucinations. Plus we A1-ground every excerpt against the source contract — no invented clauses." },
  { id: "jurisdictions", category: "reasoning", q: "Which jurisdictions do you cover?", a: "Default templates: US (Delaware default), UK (England & Wales), EU (general), Singapore, Australia. Enterprise plans get custom-tuned templates for any jurisdiction — typically a 5-day turnaround." },
  { id: "delete-account", category: "account", q: "How do I delete my account?", a: "Settings → Danger zone → Delete account. We hard-delete the user row + all owned drafts + analyses within 24 hours. Audit log entries are anonymized (user_id zeroed) but the hash chain itself stays intact for compliance." },
  { id: "export", category: "account", q: "Can I export my contracts and findings?", a: "Yes. Findings tab → Export → JSON or PDF for any individual analysis. Whole-account export (zip of every draft + analysis JSON) is on the Growth plan and above." },
  { id: "refund", category: "billing", q: "Do you offer refunds?", a: "Within 14 days of any new subscription, no questions asked. After 14 days we refund pro-rated for the unused portion if you cancel due to a service outage or breaking change on our side." },
  { id: "invoice", category: "billing", q: "Can I get an invoice for accounting?", a: "Every paid subscription generates a PDF invoice on charge. Find them under Settings → Billing → Invoices." },
];

function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  const needle = q.toLowerCase();
  return parts.map((p, i) =>
    p.toLowerCase() === needle ? (
      <mark key={i} className="bg-amber-400/30 text-amber-200 rounded px-0.5">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export default function FaqPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cat, setCat] = useState<Category>("all");
  const [openId, setOpenId] = useState<string | null>(FAQS[0].id);

  useEffect(() => {
    const orig = document.body.style.background;
    document.body.style.background = "#020617";
    return () => {
      document.body.style.background = orig;
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 140);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return FAQS.filter((f) => {
      if (cat !== "all" && f.category !== cat) return false;
      if (!q) return true;
      return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    });
  }, [debounced, cat]);

  const counts = useMemo(() => {
    const c: Record<Category, number> = {
      all: FAQS.length,
      start: 0,
      pricing: 0,
      security: 0,
      reasoning: 0,
      account: 0,
      billing: 0,
    };
    FAQS.forEach((f) => {
      c[f.category] += 1;
    });
    return c;
  }, []);

  return (
    <div
      className="min-h-screen text-slate-200"
      style={{
        background:
          "radial-gradient(ellipse 90% 50% at 50% -10%, rgba(99,102,241,0.10) 0%, transparent 50%), #020617",
        fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-100 font-semibold tracking-tight cursor-pointer"
          >
            <span
              className="inline-block h-5 w-5 rounded-[6px]"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              }}
              aria-hidden
            />
            Clarifyd
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/pricing"
              className="text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              Pricing
            </Link>
            <Link
              href="/contact"
              className="text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              Contact
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-28 pb-20">
        <header className="mx-auto max-w-3xl px-6 text-center">
          <div
            className="text-[10px] uppercase tracking-[0.18em] text-violet-400"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            ↳ help
          </div>
          <h1 className="mt-3 text-4xl text-white font-semibold tracking-tight">
            Frequently asked questions
          </h1>
          <p className="mt-3 text-slate-400">
            Search or browse by topic. Don't see your question? <Link href="/contact" className="text-indigo-300 hover:text-indigo-200 cursor-pointer">Ask us →</Link>
          </p>

          <div className="mt-7 relative max-w-xl mx-auto">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search FAQs…"
              className="w-full rounded-lg border border-white/10 bg-slate-900/60 px-4 py-3 pl-10 text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
            {debounced ? (
              <div
                className="absolute -bottom-6 left-0 text-[10px] uppercase tracking-[0.14em] text-slate-500"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {filtered.length} match{filtered.length === 1 ? "" : "es"}
              </div>
            ) : null}
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-6 mt-10 flex flex-wrap gap-2 justify-center">
          {CATEGORIES.map((c) => {
            const active = cat === c.v;
            return (
              <button
                key={c.v}
                type="button"
                onClick={() => setCat(c.v)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors duration-200 cursor-pointer ${
                  active
                    ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-200"
                    : "border-white/10 bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                {c.label}{" "}
                <span
                  className="ml-1 text-[10px] text-slate-500"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {counts[c.v]}
                </span>
              </button>
            );
          })}
        </div>

        <ul className="mx-auto max-w-3xl px-6 mt-8 space-y-2">
          {filtered.length === 0 ? (
            <li className="rounded-xl border border-white/10 bg-slate-900/40 p-8 text-center text-slate-400 text-sm">
              No matches. Try a different search or category.
            </li>
          ) : (
            filtered.map((f) => {
              const open = openId === f.id;
              return (
                <li
                  key={f.id}
                  className={`rounded-xl border transition-all duration-200 ${
                    open
                      ? "border-indigo-400/30 bg-slate-900/60"
                      : "border-white/10 bg-slate-900/40 hover:bg-slate-900/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : f.id)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 cursor-pointer"
                    aria-expanded={open}
                  >
                    <span className="text-sm text-slate-100 font-semibold">
                      {highlight(f.q, debounced)}
                    </span>
                    <span
                      className={`text-slate-500 transition-transform duration-200 ${
                        open ? "rotate-180" : ""
                      }`}
                    >
                      ▾
                    </span>
                  </button>
                  {open ? (
                    <div className="px-5 pb-5 -mt-1 text-sm text-slate-300 leading-relaxed">
                      {highlight(f.a, debounced)}
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>

        <div className="mx-auto max-w-3xl px-6 mt-12 rounded-xl border border-white/10 bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-900/40 p-7 text-center">
          <div className="text-sm text-white font-semibold">Still curious?</div>
          <p className="mt-1 text-sm text-slate-400">
            Hit our inbox. We answer most threads same day.
          </p>
          <Link
            href="/contact"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white text-slate-950 px-4 py-2 text-sm font-semibold hover:bg-slate-200 cursor-pointer transition-colors duration-200"
          >
            Contact us →
          </Link>
        </div>
      </main>

      <footer className="border-t border-white/5 bg-slate-950/90">
        <div
          className="mx-auto max-w-6xl px-6 py-6 text-xs text-slate-500 flex flex-col md:flex-row justify-between gap-2"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          <span>© 2026 Clarifyd. Not legal advice.</span>
          <Link href="/" className="hover:text-slate-300 cursor-pointer">
            ← landing
          </Link>
        </div>
      </footer>
    </div>
  );
}
