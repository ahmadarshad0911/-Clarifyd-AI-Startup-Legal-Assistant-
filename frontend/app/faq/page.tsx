"use client";

/** /faq — Broadsheet · v6 */

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Question } from "@phosphor-icons/react";

import { PublicShell } from "../../components/public-shell";
import { BroadsheetSearch } from "../../components/broadsheet-search";

type Category = "all" | "start" | "pricing" | "security" | "reasoning" | "account" | "billing";
type Faq = { id: string; category: Exclude<Category, "all">; q: string; a: string };

const CATS: Array<{ v: Category; label: string }> = [
  { v: "all", label: "All" },
  { v: "start", label: "Getting started" },
  { v: "pricing", label: "Pricing" },
  { v: "security", label: "Security" },
  { v: "reasoning", label: "Reasoning" },
  { v: "account", label: "Account" },
  { v: "billing", label: "Billing" },
];

const FAQS: Faq[] = [
  { id: "what",    category: "start",     q: "What is Clarifyd?", a: "Clarifyd is an AI contract risk analyzer for early-stage founders. Upload a PDF or DOCX, get clause-level findings, founder-friendly rewrites, and an exportable collaborator draft. Reasoning runs against Clarifyd AI." },
  { id: "first",   category: "start",     q: "How do I run my first analysis?", a: "Sign up (3 free analyses included), open the Dashboard, drop a contract under 10 MB. We extract every clause, score it, and surface the verdict in the Findings tab — usually in 8 seconds on cache, under a minute cold." },
  { id: "free",    category: "pricing",   q: "Is there a free tier?", a: "Yes — 3 contracts a month forever, no credit card. Founder ($29/mo) unlocks unlimited + collaborator-doc export. Counsel covers SSO, custom jurisdiction templates, and dedicated review." },
  { id: "annual",  category: "pricing",   q: "Do you offer annual billing?", a: "Yes — annual drops the effective price by ~20% across Founder and Counsel." },
  { id: "train",   category: "security",  q: "Do you train models on my contracts?", a: "No. Contracts go to Clarifyd AI for reasoning, then sit cached by sha-256." },
  { id: "sec",     category: "security",  q: "How is my data secured?", a: "Your contracts stay private to your account. Industry-standard encryption protects data in transit and at rest. You can delete any analysis at any time from the dashboard." },
  { id: "model",   category: "reasoning", q: "What model are you using?", a: "Clarifyd AI reasoning, with a deterministic rules engine fallback if the model is unreachable. Report-level cache means re-reads are byte-identical and ~116× faster." },
  { id: "halluc",  category: "reasoning", q: "What if the model hallucinates a clause?", a: "It can't — by design. Every flagged clause is verified against a verbatim substring of your contract before it reaches your screen. Ungrounded findings are dropped silently." },
  { id: "juris",   category: "reasoning", q: "Which jurisdictions do you cover?", a: "Default: US, UK, EU, Singapore, Australia. Custom jurisdictions on Counsel — usually a 5-day turnaround." },
  { id: "delete",  category: "account",   q: "How do I delete my account?", a: "Settings → Danger zone → Delete account. We hard-delete the user row and all owned drafts within 24 hours." },
  { id: "export",  category: "account",   q: "Can I export my contracts and findings?", a: "Yes. Findings → Export → JSON or PDF for any analysis. Whole-account export (zip) is on Founder and above." },
  { id: "refund",  category: "billing",   q: "Do you offer refunds?", a: "Within 14 days of any new subscription, no questions asked." },
  { id: "invoice", category: "billing",   q: "Can I get an invoice for accounting?", a: "Every paid subscription generates a PDF invoice on charge. Settings → Billing → Invoices." },
];

const EOQ = [0.23, 1, 0.32, 1] as const;

function highlight(text: string, q: string): ReactNode {
  const needle = q.trim();
  if (!needle) return text;
  const re = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  return parts.map((p, i) =>
    p.toLowerCase() === needle.toLowerCase() ? (
      <mark key={i} style={{ background: "var(--bsd-red-soft)", color: "var(--bsd-ink)", padding: "0 2px" }}>{p}</mark>
    ) : (<span key={i}>{p}</span>),
  );
}

export default function FaqPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [cat, setCat] = useState<Category>("all");
  const [openId, setOpenId] = useState<string | null>(FAQS[0].id);

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
    const c: Record<Category, number> = { all: FAQS.length, start: 0, pricing: 0, security: 0, reasoning: 0, account: 0, billing: 0 };
    FAQS.forEach((f) => { c[f.category] += 1; });
    return c;
  }, []);

  return (
    <PublicShell>
      <section style={{ padding: "72px 32px 32px", borderBottom: "1.5px solid var(--bsd-ink)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)", gap: 56, alignItems: "end" }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EOQ }}>
            <span className="bsd-kicker" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Question weight="duotone" size={14} aria-hidden />
              Help
            </span>
            <h1 style={{ margin: "12px 0 0", fontSize: "clamp(48px, 7vw, 96px)", lineHeight: 0.95, letterSpacing: "-0.04em", color: "var(--bsd-ink)", fontWeight: 700 }}>
              Asked <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>often.</span>
            </h1>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EOQ, delay: 0.1 }}>
            <p style={{ margin: 0, fontSize: 16, color: "var(--bsd-body)", lineHeight: 1.6, maxWidth: 420 }}>
              Search or browse by topic. Still stuck? <Link href="/contact" className="bsd-link" style={{ fontWeight: 600 }}>Ask us</Link>.
            </p>
            <div style={{ marginTop: 26, maxWidth: 480 }}>
              <BroadsheetSearch
                label="Index of questions"
                placeholder="Type a term — SAFE, refund, jurisdiction…"
                value={query}
                onChange={setQuery}
                meta={`${filtered.length} of ${FAQS.length}`}
              />
            </div>
          </motion.div>
        </div>
      </section>

      <section style={{ padding: "20px 32px", borderBottom: "1.5px solid var(--bsd-ink)", background: "var(--bsd-paper-deep)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {CATS.map((c) => {
            const active = cat === c.v;
            return (
              <button
                key={c.v}
                type="button"
                onClick={() => setCat(c.v)}
                className={`bsd-chip cf-mono${active ? " is-active" : ""}`}
                style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}
              >
                {c.label}
                <span style={{ marginLeft: 5, opacity: 0.6 }}>{counts[c.v]}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ padding: "48px 32px 72px" }}>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", maxWidth: 920, marginLeft: "auto", marginRight: "auto" }}>
          {filtered.length === 0 ? (
            <li style={{ padding: 32, border: "1.5px solid var(--bsd-rule)", textAlign: "center", color: "var(--bsd-muted)", fontStyle: "italic", fontSize: 14 }}>
              No matches. Try a different search or category.
            </li>
          ) : filtered.map((f, i) => {
            const open = openId === f.id;
            return (
              <li
                key={f.id}
                style={{
                  borderTop: i === 0 ? "2px solid var(--bsd-ink)" : "none",
                  borderBottom: i === filtered.length - 1 ? "2px solid var(--bsd-ink)" : "1px solid var(--bsd-hairline)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : f.id)}
                  aria-expanded={open}
                  className="cursor-pointer bsd-row"
                  style={{
                    width: "100%", textAlign: "left",
                    padding: "20px 0",
                    background: open ? "var(--bsd-paper-deep)" : "transparent",
                    border: "none",
                    display: "flex", alignItems: "baseline", gap: 18,
                    fontSize: 17, color: "var(--bsd-ink)", fontWeight: 500,
                    letterSpacing: "-0.005em",
                  }}
                >
                  <motion.span
                    animate={{ rotate: open ? 45 : 0 }}
                    transition={{ duration: 0.22, ease: EOQ }}
                    style={{ display: "inline-flex", color: open ? "var(--bsd-red)" : "var(--bsd-muted)", flexShrink: 0, marginTop: 3 }}
                  >
                    <Plus weight="bold" size={13} aria-hidden />
                  </motion.span>
                  <span style={{ flex: 1 }}>{highlight(f.q, debounced)}</span>
                </button>
                <div
                  style={{
                    display: "grid",
                    gridTemplateRows: open ? "1fr" : "0fr",
                    transition: "grid-template-rows 280ms var(--ease-out), opacity 240ms var(--ease-out)",
                    opacity: open ? 1 : 0,
                  }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <p style={{ margin: 0, paddingLeft: 31, paddingBottom: 22, fontSize: 14.5, lineHeight: 1.65, color: "var(--bsd-body)", maxWidth: "60ch" }}>
                      {highlight(f.a, debounced)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </PublicShell>
  );
}
