"use client";

/**
 * /changelog — Broadsheet · v6
 *
 * "Editions archive" plate. Hand-curated releases as ledger entries with
 * volume / number / date / tagged bullets.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Sparkle, Wrench, ShieldCheck, ListMagnifyingGlass } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { PublicShell } from "../../components/public-shell";

const EOQ = [0.23, 1, 0.32, 1] as const;

type Tag = "feature" | "fix" | "security" | "design";
type Entry = { tag: Tag; body: string };
type Release = {
  edition: string;
  version: string;
  date: string;
  title: string;
  summary: string;
  entries: Entry[];
};

const TAG_LABEL: Record<Tag, string> = {
  feature: "Feature",
  fix: "Fix",
  security: "Security",
  design: "Design",
};
const TAG_ICON: Record<Tag, typeof Sparkle> = {
  feature: Sparkle,
  fix: Wrench,
  security: ShieldCheck,
  design: ListMagnifyingGlass,
};
const TAG_COLOR: Record<Tag, string> = {
  feature: "var(--bsd-red)",
  fix: "var(--bsd-sev-medium)",
  security: "var(--bsd-sev-low)",
  design: "var(--bsd-ink)",
};

const RELEASES: Release[] = [
  {
    edition: "Vol. I · No. 06",
    version: "v0.6.0",
    date: "May 2026",
    title: "Broadsheet — the editorial redesign.",
    summary: "Whole-site rebrand to The Broadsheet: ivory paper, coffee ink, arterial red. Pre-seed-only product targeting. Per-user storage scoping fixes the cross-account data bleed.",
    entries: [
      { tag: "design",   body: "Brutalist editorial system across 20+ routes. Geist Sans + Geist Mono, Phosphor duotone icons, sharp edges, no gradients / glass / shadows." },
      { tag: "feature",  body: "New routes: /lawyer (article forthcoming plate), /library (template catalog), /integrations." },
      { tag: "feature",  body: "Reasoning surface renamed Clarifyd AI. Provider abstraction in services/reasoning/ preserved." },
      { tag: "fix",      body: "Per-user localStorage scoping via lib/user-storage.ts. AuthProvider wipes 11 legacy global keys on login/logout." },
      { tag: "fix",      body: "Forms hardened: blue focus ring suppressed, WebKit search decorations hidden, range slider custom thumb (no native black outline)." },
      { tag: "security", body: "AI-can-make-mistakes disclosure consolidated to /terms Article 06 (not splattered across every page)." },
    ],
  },
  {
    edition: "Vol. I · No. 05",
    version: "v0.5.0",
    date: "March 2026",
    title: "Speed pass + reasoning quality.",
    summary: "Pipeline parallelism, cache write-race fix, prompt rubric tightening.",
    entries: [
      { tag: "feature", body: "Per-clause reasoning loop runs in parallel with the reporter; DB writes batched." },
      { tag: "fix",     body: "ClauseCache write race fixed; reporter skipped on clean docs; max_tokens tightened." },
      { tag: "fix",     body: "Severity rubric anchored with worked examples; suggestion validator + one-shot retry." },
    ],
  },
  {
    edition: "Vol. I · No. 04",
    version: "v0.4.0",
    date: "February 2026",
    title: "Findings, exports, OAuth + Postgres.",
    summary: "Single-tab Findings view, DOCX exports, Google + Facebook OAuth, production path live.",
    entries: [
      { tag: "feature",  body: "Findings tab unifies risky clauses + loopholes + suggestions; one-tap Apply." },
      { tag: "feature",  body: "Re-open any analyzed contract from the dashboard, instantly." },
      { tag: "feature",  body: "One-tap sign-in with Google and Facebook." },
      { tag: "feature",  body: "Private workspace — every contract scoped to your account." },
    ],
  },
  {
    edition: "Vol. I · No. 03",
    version: "v0.3.0",
    date: "January 2026",
    title: "Reasoning provider abstraction.",
    summary: "ReasoningProvider ABC, fallback chain, Prometheus counters, audit on every call.",
    entries: [
      { tag: "feature", body: "ReasoningProvider ABC with RulesBasedProvider fallback chain." },
      { tag: "feature", body: "Per-clause SHA-256 cache; report-level cache for byte-identical re-reads." },
      { tag: "feature", body: "Prometheus counters for calls, tokens, cost, latency." },
    ],
  },
];

export default function ChangelogPage() {
  const reduce = useReducedMotion() ?? false;
  return (
    <PublicShell>
      <section style={{ padding: "72px 32px 32px", borderBottom: "1.5px solid var(--bsd-ink)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EOQ }}
          >
            <span className="bsd-kicker" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <ListMagnifyingGlass weight="duotone" size={14} aria-hidden />
              Editions archive
            </span>
            <h1 style={{ margin: "12px 0 0", fontSize: "clamp(36px, 5.5vw, 72px)", fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.03em", lineHeight: 1.02 }}>
              Everything we&rsquo;ve shipped, <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>edition by edition.</span>
            </h1>
            <p style={{ margin: "12px 0 0", color: "var(--bsd-body)", fontSize: 15.5, lineHeight: 1.6, maxWidth: 620 }}>
              Hand-curated. Newest first. Every entry tagged Feature, Fix, Security, or Design so you can scan for what matters to you.
            </p>
          </motion.div>
        </div>
      </section>

      <section style={{ padding: "48px 32px 96px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {RELEASES.map((r, i) => (
            <motion.article
              key={r.version}
              initial={{ opacity: 0, y: reduce ? 0 : 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, ease: EOQ, delay: i * 0.04 }}
              style={{
                paddingTop: i === 0 ? 0 : 56,
                paddingBottom: 32,
                borderTop: i === 0 ? "2px solid var(--bsd-ink)" : "1px dotted var(--bsd-hairline)",
                display: "grid", gridTemplateColumns: "minmax(0, 4fr) minmax(0, 8fr)", gap: 48, alignItems: "start",
              }}
              className="grid-cols-1 lg:grid-cols-[4fr_8fr]"
            >
              <header style={{ position: "sticky", top: 90 }}>
                <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                  {r.edition}
                </span>
                <h2 style={{ margin: "10px 0 0", fontSize: 30, fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.025em", lineHeight: 1.05 }}>
                  {r.title}
                </h2>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--bsd-hairline)", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <span className="cf-mono" style={{ color: "var(--bsd-ink)", fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>
                    {r.version}
                  </span>
                  <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
                    {r.date}
                  </span>
                </div>
              </header>
              <div>
                <p style={{ margin: 0, fontSize: 16, color: "var(--bsd-body)", lineHeight: 1.65, fontStyle: "italic", borderLeft: "2px solid var(--bsd-red)", paddingLeft: 18 }}>
                  {r.summary}
                </p>
                <ul style={{ margin: "24px 0 0", padding: 0, listStyle: "none" }}>
                  {r.entries.map((e, j) => {
                    const Icon = TAG_ICON[e.tag];
                    return (
                      <li
                        key={j}
                        style={{
                          display: "grid", gridTemplateColumns: "44px 96px minmax(0, 1fr)", gap: 16, alignItems: "baseline",
                          padding: "14px 0",
                          borderBottom: j < r.entries.length - 1 ? "1px dotted var(--bsd-hairline)" : "none",
                        }}
                      >
                        <span className="cf-mono" style={{ color: "var(--bsd-soft)", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em" }}>
                          {String(j + 1).padStart(2, "0")}
                        </span>
                        <span
                          className="cf-mono"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            color: TAG_COLOR[e.tag],
                            fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Icon weight="duotone" size={11} /> {TAG_LABEL[e.tag]}
                        </span>
                        <span style={{ fontSize: 14.5, color: "var(--bsd-ink)", lineHeight: 1.55 }}>
                          {e.body}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </motion.article>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
