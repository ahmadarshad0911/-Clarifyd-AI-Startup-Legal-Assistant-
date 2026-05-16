"use client";

/**
 * FAQ — public, glass theme, premium motion.
 *
 * Features:
 *   - Hero with live-filter search (debounced) + result count.
 *   - Sliding-pill category tabs (All / Getting started / Pricing /
 *     Security / Reasoning / Account / Billing).
 *   - Accordion cards using the grid-template-rows 0fr↔1fr trick for
 *     smooth real-CSS height animation.
 *   - Match-term highlight (yellow) in question + answer.
 *   - Empty state with bouncing illustration when no results.
 *   - Sticky category sidebar on desktop, dropdown on mobile.
 *   - "Still curious?" CTA card linking to /contact.
 *   - Every motion gated on prefers-reduced-motion.
 */

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { AuroraBackground } from "../../components/common/aurora-background";

type Category =
  | "all"
  | "start"
  | "pricing"
  | "security"
  | "reasoning"
  | "account"
  | "billing";

type Faq = { id: string; category: Exclude<Category, "all">; q: string; a: string };

const CATEGORIES: Array<{ v: Category; label: string; icon: string }> = [
  { v: "all",       label: "All",            icon: "all_inclusive" },
  { v: "start",     label: "Getting started", icon: "rocket_launch" },
  { v: "pricing",   label: "Pricing",        icon: "sell" },
  { v: "security",  label: "Security",       icon: "shield" },
  { v: "reasoning", label: "Reasoning",      icon: "psychology" },
  { v: "account",   label: "Account",        icon: "person" },
  { v: "billing",   label: "Billing",        icon: "credit_card" },
];

const FAQS: Faq[] = [
  {
    id: "what-is",
    category: "start",
    q: "What is Clarifyd?",
    a: "Clarifyd is an AI contract risk analyzer for early-stage founders. Upload a PDF or DOCX, get clause-level risk findings, founder-friendly guidance, and an exportable redlined draft. Reasoning runs against Kimi K2 via NVIDIA NIM with a rules-based fallback.",
  },
  {
    id: "first-analysis",
    category: "start",
    q: "How do I run my first analysis?",
    a: "Sign up (3 free analyses included), open the Dashboard, drop a contract under 25 MB. We extract every clause, score it, and surface the verdict in the Findings tab. From there, jump to the Negotiation Lab to accept Kimi's suggested replacements clause-by-clause and export a collaborator-ready draft.",
  },
  {
    id: "free-tier",
    category: "pricing",
    q: "Is there a free tier?",
    a: "Yes — 3 analyses per month with rules-only fallback, no credit card. Starter ($19/mo) unlocks Kimi reasoning + PDF export. Pro ($49/mo) adds the collaborator-doc workflow and 50 analyses. Enterprise covers SSO, custom jurisdiction templates and dedicated review.",
  },
  {
    id: "annual-discount",
    category: "pricing",
    q: "Do you offer annual billing?",
    a: "Yes — paying annually drops the effective price by ~2 months across Starter, Pro and Business. Toggle the billing cycle on the pricing page (coming soon to the in-app billing portal).",
  },
  {
    id: "data-training",
    category: "security",
    q: "Do you train models on my contracts?",
    a: "No. Customer contracts never train any model. Reasoning calls go directly to the provider (NVIDIA NIM) with no retention beyond the response itself. We additionally cache by sha256 to avoid re-asking the model the same clause twice.",
  },
  {
    id: "encryption",
    category: "security",
    q: "How is my data secured?",
    a: "AES-256 at rest, TLS 1.3 in transit. Postgres on Neon (serverless, isolated per project). Every reasoning call + login + export is appended to a hash-chained audit log — tamper-evident by default. SSO + IP allowlisting are Enterprise features.",
  },
  {
    id: "model",
    category: "reasoning",
    q: "What model is Clarifyd using?",
    a: "Kimi K2.6 reasoning via NVIDIA NIM (current production model: meta/llama-3.3-70b-instruct as the verified fallback while we benchmark Kimi K2 throughput). Falls back to a deterministic rules engine if the LLM is unreachable — you never see a hard failure.",
  },
  {
    id: "accuracy",
    category: "reasoning",
    q: "How accurate is the risk scoring?",
    a: "Each finding ships with a confidence score 0–1. By default we route anything ≥0.7 confidence + high/critical severity to your review queue. Below that threshold we still surface the finding but mark it advisory. Multi-pass cross-verification (rules + LLM) reduces hallucinations.",
  },
  {
    id: "jurisdictions",
    category: "reasoning",
    q: "Which jurisdictions do you cover?",
    a: "Default templates: US (Delaware default), UK (England & Wales), EU (general), Singapore, Australia. Enterprise plans get custom-tuned templates for any jurisdiction — typically a 5-day turnaround once you share a few sample contracts.",
  },
  {
    id: "delete-account",
    category: "account",
    q: "How do I delete my account?",
    a: "Settings → Danger zone → Delete account. We hard-delete the user row + all owned drafts + analyses within 24 hours. Audit log entries are anonymized (user_id zeroed) but the hash chain itself stays intact for compliance.",
  },
  {
    id: "export",
    category: "account",
    q: "Can I export my contracts and findings?",
    a: "Yes. Findings tab → Export → JSON or PDF for any individual analysis. Whole-account export (zip of every draft + analysis JSON) is on the Business plan and above.",
  },
  {
    id: "refund",
    category: "billing",
    q: "Do you offer refunds?",
    a: "Within 14 days of any new subscription, no questions asked. After 14 days we refund pro-rated for the unused portion if you cancel due to a service outage or breaking change on our side.",
  },
  {
    id: "invoice",
    category: "billing",
    q: "Can I get an invoice for accounting?",
    a: "Every paid subscription generates a PDF invoice on charge. Find them under Settings → Billing → Invoices. Send the team email if you need the company name / VAT number changed retroactively.",
  },
];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Highlight matched query inside the text with a <mark>.
function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  const needle = q.toLowerCase();
  return parts.map((p, i) =>
    p.toLowerCase() === needle ? (
      <mark key={i} className="faq-highlight">{p}</mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export default function FaqPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cat, setCat] = useState<Category>("all");
  const [openId, setOpenId] = useState<string | null>(FAQS[0].id);

  // Debounce search.
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

  // Counts per category for the pill labels.
  const counts = useMemo(() => {
    const c: Record<Category, number> = {
      all: FAQS.length, start: 0, pricing: 0, security: 0, reasoning: 0, account: 0, billing: 0,
    };
    FAQS.forEach((f) => { c[f.category] += 1; });
    return c;
  }, []);

  return (
    <div className="faq-root text-on-surface font-body-lg overflow-x-hidden min-h-screen">
      <AuroraBackground />

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 md:px-10 py-4 flex justify-between items-center gap-4 glass-frosted">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span className="material-symbols-outlined text-primary text-3xl">gavel</span>
          <span className="font-display-hero text-2xl font-bold text-onboarding-navy tracking-tight">
            Clarifyd
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          <Link href="/" className="hidden sm:inline hover:text-primary transition-colors">Home</Link>
          <Link href="/contact" className="hidden sm:inline hover:text-primary transition-colors">Contact</Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-primary to-accent-violet text-white text-[12px] shadow-md shadow-primary/40"
          >
            Sign in
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </nav>
      </header>

      <main className="pt-28 md:pt-36 pb-24 px-4 md:px-10 relative">
        <div className="max-w-container-max mx-auto">
          {/* HERO */}
          <div className="text-center mb-10 md:mb-14">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest text-primary bg-white/55 border border-white/65 backdrop-blur">
              <span className="material-symbols-outlined text-[14px]">help</span>
              {FAQS.length} answered questions
            </span>
            <h1 className="font-display-hero text-[36px] sm:text-[48px] md:text-[64px] leading-[1.06] text-onboarding-navy mt-4 m-0 tracking-tight">
              Questions, answered{" "}
              <span className="bg-gradient-to-r from-primary to-accent-violet bg-clip-text text-transparent">
                in seconds.
              </span>
            </h1>
            <p className="text-on-surface-variant max-w-xl mx-auto mt-4 text-[15px] sm:text-[17px] leading-relaxed">
              Search across every Clarifyd doc — pricing, security, the Kimi reasoning chain, jurisdictions, account & billing. Can&rsquo;t find it?{" "}
              <Link href="/contact" className="text-primary font-semibold underline">Ask us</Link>.
            </p>

            {/* SEARCH */}
            <div className="faq-search-wrap mt-7 sm:mt-9 max-w-2xl mx-auto">
              <span className="material-symbols-outlined faq-search-icon">search</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Try "refund" or "jurisdiction" or "Kimi"…'
                className="faq-search-input"
                autoComplete="off"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="faq-search-clear"
                  aria-label="Clear search"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              ) : null}
            </div>
            <div
              className="text-[12px] font-semibold tracking-wider uppercase text-on-surface-variant/70 mt-3 transition-opacity"
              style={{ opacity: debounced ? 1 : 0 }}
              aria-live="polite"
            >
              {filtered.length} {filtered.length === 1 ? "match" : "matches"} for &ldquo;{debounced}&rdquo;
            </div>
          </div>

          {/* CATEGORY TABS — per-chip selected state, no sliding pill */}
          <div className="mx-auto max-w-4xl mb-8 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
            <div className="inline-flex flex-nowrap gap-2 p-1.5 rounded-full bg-white/45 border border-white/65 backdrop-blur min-w-max">
              {CATEGORIES.map((c) => {
                const active = cat === c.v;
                return (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => setCat(c.v)}
                    aria-pressed={active}
                    className="faq-tab"
                    data-active={active}
                  >
                    <span className="material-symbols-outlined text-[16px]">{c.icon}</span>
                    {c.label}
                    <span className="faq-tab-count" data-active={active}>
                      {counts[c.v]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RESULTS */}
          {filtered.length === 0 ? (
            <div className="faq-empty crystal-glass rounded-3xl p-10 max-w-2xl mx-auto text-center">
              <span
                className="material-symbols-outlined text-primary/40 text-[64px] block faq-empty-bounce"
              >
                travel_explore
              </span>
              <h2 className="font-display-hero text-h2 text-onboarding-navy m-0 mt-2">
                Nothing matches that yet.
              </h2>
              <p className="text-on-surface-variant mt-2 mb-5">
                Try a broader term, switch category, or write to us directly.
              </p>
              <Link href="/contact" className="btn-capsule btn-capsule-primary">
                <span className="material-symbols-outlined text-[18px]">forum</span>
                Ask Clarifyd
              </Link>
            </div>
          ) : (
            <ul className="faq-list flex flex-col gap-3 max-w-3xl mx-auto m-0 p-0 list-none">
              {filtered.map((f, i) => {
                const open = openId === f.id;
                const catMeta = CATEGORIES.find((c) => c.v === f.category)!;
                return (
                  <li
                    key={f.id}
                    className="faq-card crystal-glass rounded-2xl overflow-hidden"
                    data-open={open}
                    style={
                      prefersReducedMotion()
                        ? undefined
                        : ({ animationDelay: `${Math.min(i, 10) * 35}ms` } as React.CSSProperties)
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : f.id)}
                      aria-expanded={open}
                      className="w-full flex items-start gap-3 px-5 py-4 text-left"
                    >
                      <span className="faq-card-icon shrink-0">
                        <span className="material-symbols-outlined text-[18px]">
                          {catMeta.icon}
                        </span>
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-onboarding-navy text-[15px] sm:text-[16px] leading-snug">
                          {highlight(f.q, debounced)}
                        </span>
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/80 mt-1">
                          {catMeta.label}
                        </span>
                      </span>
                      <span
                        className="material-symbols-outlined text-primary shrink-0 mt-0.5"
                        style={{
                          transform: open ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        }}
                      >
                        expand_more
                      </span>
                    </button>
                    <div
                      className="faq-body"
                      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <p className="text-on-surface-variant text-body-sm px-5 pb-5 m-0 leading-relaxed pl-[60px]">
                          {highlight(f.a, debounced)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* STILL CURIOUS CTA */}
          <section className="mt-20 md:mt-24 max-w-3xl mx-auto">
            <div className="shimmer-gold-border rounded-[2rem] bg-onboarding-navy text-white p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
              <div
                className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
                style={{ background: "rgba(180, 83, 9, 0.25)", filter: "blur(80px)" }}
                aria-hidden
              />
              <div className="relative z-10">
                <span className="font-label-caps text-label-caps uppercase tracking-widest text-onboarding-gold/90">
                  Still curious?
                </span>
                <h2 className="font-display-hero text-h2 m-0 mt-1 leading-tight">
                  Ask a human — &lt; 6 hr reply.
                </h2>
                <p className="text-body-sm opacity-90 m-0 mt-2 max-w-md">
                  No question too founder-specific. Send it over and the right
                  person at Clarifyd will pick it up the same business day.
                </p>
              </div>
              <Link
                href="/contact"
                className="relative z-10 bg-onboarding-gold hover:bg-onboarding-gold/90 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-onboarding-gold/30 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[20px]">forum</span>
                Contact us
              </Link>
            </div>
          </section>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="px-4 md:px-10 pb-10 pt-4">
        <div className="max-w-container-max mx-auto flex flex-wrap items-center justify-between gap-4 text-[11px] text-on-surface-variant/80 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[16px]">gavel</span>
            Clarifyd © {new Date().getFullYear()} · Decision support, not legal advice
          </div>
          <div className="flex gap-5">
            <Link href="/terms">Terms</Link>
            <Link href="/terms?tab=privacy">Privacy</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/feedback">Feedback</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
