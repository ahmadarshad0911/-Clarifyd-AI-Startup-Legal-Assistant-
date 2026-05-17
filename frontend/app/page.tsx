"use client";

/**
 * Landing page — dark editorial vibe ("Stripe meets Linear").
 *
 * Self-contained styling: wraps everything in `bg-slate-950` so the body's
 * aurora background (still used by every other route) is fully covered. No
 * change to globals.css or layout.tsx — other pages (auth, dashboard, etc.)
 * keep the existing aurora theme until a follow-up rewrite phase.
 *
 * Design system: persisted at design-system/clarifyd/MASTER.md
 *   - Palette: slate-950 base, slate-800 surfaces, slate-100 text,
 *              indigo-500 → violet-500 gradient accent, emerald-500 CTA
 *   - Type:    Inter (body + display), IBM Plex Mono (accents)
 *   - Motion:  150-300ms cubic-bezier, no scale-on-hover layout shift
 *   - A11y:    AA contrast, visible focus rings, prefers-reduced-motion gated
 *
 * Sections (top→bottom):
 *   1. Sticky nav
 *   2. Hero — headline + dual CTA + live findings card
 *   3. Metric strip — three credibility numbers
 *   4. Live demo — animated terminal scanning a real clause
 *   5. How it works — three-step ink-on-dark explainer
 *   6. Features bento — 6 cards, asymmetric grid
 *   7. Pricing teaser — link to /pricing
 *   8. Final CTA + footer
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../lib/auth";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ============================================================ */
/* Top nav                                                       */
/* ============================================================ */
function Nav() {
  const { token } = useAuth();
  const isAuthenticated = !!token;
  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-slate-100 font-semibold tracking-tight cursor-pointer"
        >
          <span
            className="inline-block h-5 w-5 rounded-[6px]"
            style={{
              background:
                "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              boxShadow: "0 0 18px rgba(139,92,246,0.5)",
            }}
            aria-hidden
          />
          Clarifyd
        </Link>
        <div className="hidden md:flex items-center gap-7 text-sm text-slate-400">
          <a
            href="#features"
            className="hover:text-slate-100 transition-colors duration-200 cursor-pointer"
          >
            Features
          </a>
          <a
            href="#demo"
            className="hover:text-slate-100 transition-colors duration-200 cursor-pointer"
          >
            Demo
          </a>
          <Link
            href="/pricing"
            className="hover:text-slate-100 transition-colors duration-200 cursor-pointer"
          >
            Pricing
          </Link>
          <Link
            href="/faq"
            className="hover:text-slate-100 transition-colors duration-200 cursor-pointer"
          >
            FAQ
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={isAuthenticated ? "/dashboard" : "/login"}
            className="text-sm text-slate-300 hover:text-white transition-colors duration-200 cursor-pointer"
          >
            {isAuthenticated ? "Dashboard" : "Sign in"}
          </Link>
          <Link
            href={isAuthenticated ? "/findings" : "/login"}
            className="text-sm font-medium px-3.5 py-1.5 rounded-lg bg-white text-slate-950 hover:bg-slate-200 transition-colors duration-200 cursor-pointer"
          >
            {isAuthenticated ? "Open app" : "Try free"} →
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ============================================================ */
/* Hero                                                          */
/* ============================================================ */
const LIVE_ROWS = [
  { sev: "critical", name: "Unlimited Liability", time: "62s →" },
  { sev: "critical", name: "Irrevocable IP Grab", time: "0.7s ⚡" },
  { sev: "high", name: "Auto-Renew (365d)", time: "cached" },
  { sev: "high", name: "Personal Guarantee", time: "cached" },
  { sev: "medium", name: "Forced Arbitration", time: "cached" },
];

function SevDot({ sev }: { sev: string }) {
  const color =
    sev === "critical"
      ? "bg-rose-500 shadow-[0_0_10px_#f43f5e]"
      : sev === "high"
        ? "bg-amber-400 shadow-[0_0_10px_#fbbf24]"
        : sev === "medium"
          ? "bg-sky-400 shadow-[0_0_10px_#38bdf8]"
          : "bg-slate-500";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />;
}

function Hero() {
  return (
    <section className="relative pt-32 pb-24">
      {/* Background grid */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, #000 30%, transparent 100%)",
        }}
        aria-hidden
      />
      {/* Soft glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 h-[520px] w-[820px] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(99,102,241,0.18) 0%, transparent 60%)",
          filter: "blur(20px)",
        }}
        aria-hidden
      />

      <div className="mx-auto max-w-6xl px-6">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          {/* Left — headline */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 font-medium">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"
                aria-hidden
              />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                ↳ live · Kimi K2 · 116× faster on cached reads
              </span>
            </div>
            <h1 className="mt-6 text-[44px] sm:text-5xl lg:text-[58px] leading-[1.05] tracking-tight font-semibold text-white">
              Contract review for
              <br />
              founders, in{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400">
                8 seconds.
              </span>
            </h1>
            <p className="mt-6 text-lg text-slate-400 max-w-xl leading-relaxed">
              Drop a PDF. Every clause scored. Every loophole flagged. Every
              fix written for you. No more $400/hr lawyer round-trips to find
              an unlimited-liability bomb.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200 transition-colors duration-200 cursor-pointer"
              >
                Try free
                <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors duration-200 cursor-pointer"
              >
                Watch demo
                <span aria-hidden>↓</span>
              </a>
            </div>
            <p
              className="mt-5 text-xs text-slate-500"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              No card. 3 contracts free. SOC-2 in flight.
            </p>
          </div>

          {/* Right — live card */}
          <div className="relative">
            <div
              className="absolute -inset-2 -z-10 rounded-2xl opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15) 60%, transparent)",
                filter: "blur(24px)",
              }}
              aria-hidden
            />
            <div className="rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur-sm overflow-hidden shadow-2xl">
              {/* Top bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                </div>
                <span
                  className="text-[11px] text-slate-500"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  clarifyd · live findings
                </span>
                <span className="text-[11px] text-emerald-400">● ready</span>
              </div>
              {/* Title */}
              <div className="px-5 py-4 border-b border-white/5">
                <div
                  className="text-[10px] uppercase tracking-[0.14em] text-slate-500"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Master Services Agreement · 6 findings
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <div className="text-white font-semibold">
                    Verdict: <span className="text-rose-400">CRITICAL</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    do not sign as-is
                  </div>
                </div>
              </div>
              {/* Rows */}
              <ul className="divide-y divide-white/5">
                {LIVE_ROWS.map((row, i) => (
                  <li
                    key={i}
                    className="px-5 py-3 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <SevDot sev={row.sev} />
                      <div
                        className="text-[10px] uppercase tracking-[0.14em] w-14 text-slate-500"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        {row.sev}
                      </div>
                      <div className="text-sm text-slate-200 truncate">
                        {row.name}
                      </div>
                    </div>
                    <div
                      className="text-xs text-slate-400 tabular-nums"
                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {row.time}
                    </div>
                  </li>
                ))}
              </ul>
              {/* Footer */}
              <div className="px-5 py-3 border-t border-white/5 bg-slate-900/40 flex items-center justify-between text-xs">
                <span
                  className="text-slate-500"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  $ clarifyd scan dummy.pdf
                </span>
                <span className="text-emerald-400">✓ 0 hallucinations</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/* Metric strip                                                  */
/* ============================================================ */
function Metrics() {
  const items = [
    { num: "0.7s", label: "Re-read same PDF · cache hit" },
    { num: "100%", label: "Detection recall on benchmark" },
    { num: "0", label: "Hallucinated clauses (A1 grounding)" },
  ];
  return (
    <section className="border-y border-white/5 bg-white/[0.015]">
      <div className="mx-auto max-w-6xl px-6 py-10 grid sm:grid-cols-3 gap-8">
        {items.map((it, i) => (
          <div key={i}>
            <div
              className="text-3xl text-white font-semibold tracking-tight"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {it.num}
            </div>
            <div className="mt-1 text-sm text-slate-400">{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================ */
/* Live demo (typewriter terminal)                               */
/* ============================================================ */
const DEMO_LINES = [
  "$ clarifyd scan vendor-msa.pdf",
  "▸ extracting 17 clauses ...",
  "▸ scoring against rubric ...",
  "▸ grounding excerpts ...",
  "",
  "● critical   Unlimited Liability       │  needs cap",
  "● critical   Irrevocable IP Assignment │  carve out pre-existing",
  "● high       Auto-Renew (365d notice)  │  push to 30d",
  "● medium     Net-30 + 1.5%/mo interest │  standard, accept",
  "",
  "verdict      CRITICAL — do not sign as-is",
  "suggestions  written and ready to paste",
  "",
  "next         → review in Findings · → export redline",
];

function Demo() {
  const [idx, setIdx] = useState(0);
  const reducedRef = useRef(false);
  useEffect(() => {
    reducedRef.current = prefersReducedMotion();
    if (reducedRef.current) {
      setIdx(DEMO_LINES.length);
      return;
    }
    const id = setInterval(
      () => setIdx((i) => (i < DEMO_LINES.length ? i + 1 : i)),
      280,
    );
    return () => clearInterval(id);
  }, []);
  return (
    <section id="demo" className="py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <div
            className="text-[10px] uppercase tracking-[0.18em] text-violet-400"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            ↳ live demo
          </div>
          <h2 className="mt-3 text-4xl text-white font-semibold tracking-tight">
            One drop. Every clause scored.
          </h2>
          <p className="mt-3 text-slate-400">
            Real terminal, real Kimi K2 output. The whole pipeline runs in 8
            seconds on cached reads — under a minute even cold.
          </p>
        </div>
        <div className="mt-10 rounded-xl border border-white/10 bg-slate-900/60 overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
            </div>
            <span
              className="text-[11px] text-slate-500"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              ~/contracts $
            </span>
            <span className="w-12" />
          </div>
          <pre
            className="px-5 py-6 text-[13.5px] leading-[1.7] text-slate-300 min-h-[460px] overflow-x-auto"
            style={{ fontFamily: "'IBM Plex Mono', 'Menlo', monospace" }}
          >
            {DEMO_LINES.slice(0, idx).map((line, i) => {
              const color = line.startsWith("● critical")
                ? "text-rose-400"
                : line.startsWith("● high")
                  ? "text-amber-300"
                  : line.startsWith("● medium")
                    ? "text-sky-300"
                    : line.startsWith("▸")
                      ? "text-violet-300"
                      : line.startsWith("$")
                        ? "text-emerald-300"
                        : line.startsWith("verdict")
                          ? "text-rose-300 font-semibold"
                          : line.startsWith("suggestions") ||
                              line.startsWith("next")
                            ? "text-slate-100"
                            : "text-slate-400";
              return (
                <div key={i} className={color}>
                  {line || " "}
                </div>
              );
            })}
            {idx < DEMO_LINES.length && (
              <span className="inline-block h-4 w-2 bg-violet-400 animate-pulse" />
            )}
          </pre>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/* How it works                                                  */
/* ============================================================ */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Drop your contract",
      body: "PDF, DOCX, or paste raw text. We extract every clause, in seconds.",
    },
    {
      n: "02",
      title: "Kimi K2 scores it",
      body: "Severity rubric calibrated by senior counsel examples. Citation-grounded — never invents text.",
    },
    {
      n: "03",
      title: "Drop-in rewrites",
      body: "Founder-friendly replacement language with the numeric fix named (12-month cap, 30-day notice, mutual indemnity).",
    },
  ];
  return (
    <section className="py-28 border-t border-white/5">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <div
            className="text-[10px] uppercase tracking-[0.18em] text-violet-400"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            ↳ workflow
          </div>
          <h2 className="mt-3 text-4xl text-white font-semibold tracking-tight">
            Three steps. No PhD required.
          </h2>
        </div>
        <ol className="mt-12 grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <li
              key={i}
              className="group relative rounded-xl border border-white/10 bg-slate-900/40 p-7 hover:bg-slate-900/70 transition-colors duration-200"
            >
              <div
                className="text-xs text-slate-500 tabular-nums"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {s.n}
              </div>
              <div className="mt-3 text-lg text-white font-semibold tracking-tight">
                {s.title}
              </div>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                {s.body}
              </p>
              <div
                className="absolute bottom-0 left-7 right-7 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                aria-hidden
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ============================================================ */
/* Features bento                                                */
/* ============================================================ */
function Features() {
  return (
    <section id="features" className="py-28 border-t border-white/5">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <div
            className="text-[10px] uppercase tracking-[0.18em] text-violet-400"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            ↳ what's inside
          </div>
          <h2 className="mt-3 text-4xl text-white font-semibold tracking-tight">
            Built for founders who don't have a GC.
          </h2>
        </div>

        <div className="mt-12 grid md:grid-cols-3 md:grid-rows-2 gap-4 auto-rows-[180px]">
          {/* 1 — big card */}
          <div className="md:col-span-2 md:row-span-2 rounded-xl border border-white/10 bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-900/40 p-8 flex flex-col justify-between overflow-hidden relative">
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.14em] text-indigo-300"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                core feature
              </div>
              <h3 className="mt-3 text-2xl text-white font-semibold tracking-tight">
                Citation-grounded AI
              </h3>
              <p className="mt-3 text-sm text-slate-400 max-w-md">
                Every flagged clause traces back to verbatim text in your
                contract. Hallucinated findings get dropped before they reach
                your screen. <em className="text-slate-200">A1 guardrail</em>{" "}
                — zero invented clauses in benchmarks.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-4">
              <code
                className="text-xs text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                excerpt ∈ contract ✓
              </code>
              <code
                className="text-xs text-rose-400 bg-rose-950/40 px-2 py-1 rounded"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                hallucinated ✗
              </code>
            </div>
            <div
              className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full opacity-30"
              style={{
                background:
                  "radial-gradient(circle, rgba(139,92,246,0.6), transparent 70%)",
                filter: "blur(20px)",
              }}
              aria-hidden
            />
          </div>

          {/* 2 */}
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
            <div
              className="text-[10px] uppercase tracking-[0.14em] text-violet-300"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              speed
            </div>
            <h3 className="mt-2 text-base text-white font-semibold">
              116× cache speedup
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Re-read the same contract? Byte-identical response in under a
              second.
            </p>
          </div>

          {/* 3 */}
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
            <div
              className="text-[10px] uppercase tracking-[0.14em] text-violet-300"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              determinism
            </div>
            <h3 className="mt-2 text-base text-white font-semibold">
              Same input → same answer
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Seed-locked sampling + canonical ordering. No drift across re-runs.
            </p>
          </div>

          {/* 4 */}
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
            <div
              className="text-[10px] uppercase tracking-[0.14em] text-violet-300"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              fixes
            </div>
            <h3 className="mt-2 text-base text-white font-semibold">
              Drop-in replacement clauses
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Real legal language with concrete numbers. Paste and ship.
            </p>
          </div>

          {/* 5 */}
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
            <div
              className="text-[10px] uppercase tracking-[0.14em] text-violet-300"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              export
            </div>
            <h3 className="mt-2 text-base text-white font-semibold">
              Audit-chain reports
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Hash-chained finding log. Tamper-evident export for your records.
            </p>
          </div>

          {/* 6 */}
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6">
            <div
              className="text-[10px] uppercase tracking-[0.14em] text-violet-300"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              fallback
            </div>
            <h3 className="mt-2 text-base text-white font-semibold">
              Rules + LLM = no blind spots
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Rules-based safety net catches what the model misses. Defense in
              depth.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/* Pricing teaser                                                */
/* ============================================================ */
function PricingTeaser() {
  return (
    <section className="py-28 border-t border-white/5">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <div
            className="text-[10px] uppercase tracking-[0.18em] text-violet-400"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            ↳ pricing
          </div>
          <h2 className="mt-3 text-4xl text-white font-semibold tracking-tight">
            Free until your seed round.
          </h2>
          <p className="mt-3 text-slate-400">
            3 contracts free. $29/mo when you need more. No annual lock-in, no
            "contact sales" wall.
          </p>
          <div className="mt-8">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-slate-100 hover:bg-white/10 transition-colors duration-200 cursor-pointer"
            >
              See plans
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/* Final CTA                                                     */
/* ============================================================ */
function FinalCTA() {
  return (
    <section className="py-32 border-t border-white/5 relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 -z-10 h-full"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 50% 100%, rgba(99,102,241,0.18) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-5xl text-white font-semibold tracking-tight leading-tight">
          Stop signing things
          <br />
          you haven't read.
        </h2>
        <p className="mt-5 text-slate-400 max-w-xl mx-auto">
          Three free contracts. Eight seconds each. Zero card required.
        </p>
        <div className="mt-9 flex justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 hover:bg-slate-200 transition-colors duration-200 cursor-pointer"
          >
            Start free →
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors duration-200 cursor-pointer"
          >
            Talk to us
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ============================================================ */
/* Footer                                                        */
/* ============================================================ */
function Footer() {
  return (
    <footer className="border-t border-white/5 bg-slate-950/90">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-2 text-slate-300">
            <span
              className="inline-block h-4 w-4 rounded"
              style={{
                background:
                  "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              }}
              aria-hidden
            />
            <span className="font-semibold">Clarifyd</span>
            <span className="text-slate-500 text-sm">
              · contract analysis for founders
            </span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-slate-400">
            <Link
              href="/pricing"
              className="hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Pricing
            </Link>
            <Link
              href="/faq"
              className="hover:text-white transition-colors duration-200 cursor-pointer"
            >
              FAQ
            </Link>
            <Link
              href="/contact"
              className="hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Contact
            </Link>
            <Link
              href="/terms"
              className="hover:text-white transition-colors duration-200 cursor-pointer"
            >
              Terms
            </Link>
          </div>
        </div>
        <div
          className="mt-6 pt-6 border-t border-white/5 text-xs text-slate-500 flex flex-col md:flex-row md:justify-between gap-2"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          <span>© 2026 Clarifyd. Not legal advice.</span>
          <span>
            built with Kimi K2 · Next.js · Neon · Vercel
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================ */
/* Page root                                                     */
/* ============================================================ */
export default function LandingPage() {
  // Force-cover the body's aurora background with our dark canvas.
  // Style applied on a wrapper div so we don't have to mutate globals.css
  // (other routes still use the aurora theme).
  useEffect(() => {
    const original = document.body.style.background;
    document.body.style.background = "#020617"; // slate-950
    return () => {
      document.body.style.background = original;
    };
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
      <Nav />
      <main className="pt-14">
        <Hero />
        <Metrics />
        <Demo />
        <HowItWorks />
        <Features />
        <PricingTeaser />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
