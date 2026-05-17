"use client";

/** Pricing — dark editorial. */

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "../../lib/auth";

type Plan = {
  id: string;
  name: string;
  monthly: number | null;
  features: string[];
  cta: string;
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "founder",
    name: "Founder",
    monthly: 29,
    features: [
      "3 contracts / mo",
      "Kimi K2 risk analysis",
      "Suggested rewrites",
      "Standard support",
    ],
    cta: "Start Founder",
  },
  {
    id: "growth",
    name: "Growth",
    monthly: 99,
    features: [
      "20 contracts / mo",
      "Priority Kimi reasoning + cache",
      "Co-Pilot + templates",
      "Negotiation tracker",
      "Team sharing (up to 5)",
      "Audit chain exports",
    ],
    cta: "Get Growth",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthly: null,
    features: [
      "Unlimited analysis",
      "Custom risk rulesets",
      "SOC-2 tamper-evident exports",
      "Dedicated success partner",
      "SLA",
    ],
    cta: "Contact sales",
  },
];

export default function PricingPage() {
  const { token } = useAuth();
  const [annual, setAnnual] = useState(true);

  useEffect(() => {
    const orig = document.body.style.background;
    document.body.style.background = "#020617";
    return () => {
      document.body.style.background = orig;
    };
  }, []);

  function priceLabel(p: Plan): { big: string; small: string } {
    if (p.monthly === null) return { big: "Custom", small: "" };
    const m = annual ? Math.round(p.monthly * 0.8) : p.monthly;
    return { big: `$${m}`, small: "/mo" };
  }

  const planHref = token ? "/dashboard" : "/login";

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
            <Link href="/faq" className="text-slate-400 hover:text-slate-100 cursor-pointer">
              FAQ
            </Link>
            <Link
              href={planHref}
              className="rounded-lg bg-white text-slate-950 px-3.5 py-1.5 font-semibold hover:bg-slate-200 cursor-pointer transition-colors duration-200"
            >
              {token ? "Open app" : "Sign in"} →
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-28 pb-24">
        <section className="mx-auto max-w-6xl px-6 text-center">
          <div
            className="text-[10px] uppercase tracking-[0.18em] text-violet-400"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            ↳ pricing
          </div>
          <h1 className="mt-3 text-4xl md:text-5xl text-white font-semibold tracking-tight">
            Free until your seed round.
          </h1>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">
            3 contracts free forever. Pay only when you outgrow it. No annual
            lock-in, no contact-sales wall.
          </p>

          <div className="mt-9 inline-flex items-center gap-3 rounded-full border border-white/10 bg-slate-900/60 p-1">
            {(["annual", "monthly"] as const).map((mode) => {
              const isAnnual = mode === "annual";
              const active = isAnnual === annual;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAnnual(isAnnual)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors duration-200 ${
                    active
                      ? "bg-white text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {mode === "annual" ? "Annual −20%" : "Monthly"}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((p) => {
            const label = priceLabel(p);
            const popular = !!p.popular;
            return (
              <div
                key={p.id}
                className={`relative rounded-2xl border p-7 flex flex-col transition-all duration-200 ${
                  popular
                    ? "border-indigo-400/40 bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-900/40 md:scale-[1.03] shadow-2xl"
                    : "border-white/10 bg-slate-900/40 hover:bg-slate-900/60"
                }`}
              >
                {popular ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider"
                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      most popular
                    </span>
                  </div>
                ) : null}
                <div className="text-sm text-slate-400 font-semibold">
                  {p.name}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl text-white font-semibold tracking-tight">
                    {label.big}
                  </span>
                  {label.small ? (
                    <span className="text-sm text-slate-400">{label.small}</span>
                  ) : null}
                </div>
                {annual && p.monthly !== null ? (
                  <div className="mt-1 text-xs text-slate-500">
                    billed annually · save 20%
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-slate-500">&nbsp;</div>
                )}

                <ul className="mt-6 space-y-3 flex-1">
                  {p.features.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-slate-300"
                    >
                      <span className="text-emerald-400 mt-0.5">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={p.id === "enterprise" ? "/contact" : planHref}
                  className={`mt-7 inline-flex justify-center items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold cursor-pointer transition-colors duration-200 ${
                    popular
                      ? "bg-white text-slate-950 hover:bg-slate-200"
                      : "border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                  }`}
                >
                  {p.cta} →
                </Link>
              </div>
            );
          })}
        </section>

        <section className="mx-auto max-w-3xl px-6 mt-20 text-center">
          <h2 className="text-2xl text-white font-semibold tracking-tight">
            Questions?
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            See the FAQ or reach out — we usually reply in under a day.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/faq"
              className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-100 px-4 py-2 text-sm cursor-pointer transition-colors duration-200"
            >
              Read FAQ →
            </Link>
            <Link
              href="/contact"
              className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-100 px-4 py-2 text-sm cursor-pointer transition-colors duration-200"
            >
              Contact us →
            </Link>
          </div>
        </section>
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
