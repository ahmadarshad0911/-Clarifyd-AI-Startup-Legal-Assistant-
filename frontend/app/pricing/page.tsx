"use client";

import Link from "next/link";
import { useState } from "react";

import { AuroraBackground } from "../../components/common/aurora-background";
import { ScrollReveal } from "../../components/common/scroll-reveal";
import { useAuth } from "../../lib/auth";

type Plan = {
  id: string;
  name: string;
  monthly: number | null;
  features: string[];
  cta: string;
  btnClass: string;
  checkClass: string;
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "founder",
    name: "Founder",
    monthly: 99,
    features: ["3 contracts / mo", "Basic risk mapping", "Kimi verdict + report", "Standard support"],
    cta: "Start Founder",
    btnClass: "bg-onboarding-navy text-white",
    checkClass: "text-status-success",
  },
  {
    id: "growth",
    name: "Growth",
    monthly: 249,
    features: [
      "10 contracts / mo",
      "Priority Kimi reasoning",
      "Legal Co-Pilot + templates",
      "Negotiation Lab",
      "Team sharing (up to 5)",
    ],
    cta: "Get Growth now",
    btnClass: "bg-gradient-to-r from-accent-indigo to-accent-violet text-white",
    checkClass: "text-accent-violet",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthly: null,
    features: [
      "Unlimited analysis",
      "Custom risk rulesets",
      "Tamper-evident SOC2 exports",
      "Dedicated partner success",
    ],
    cta: "Contact sales",
    btnClass: "bg-on-surface text-white",
    checkClass: "text-status-success",
  },
];

export default function PricingPage() {
  const { token } = useAuth();
  const [annual, setAnnual] = useState(true);

  function priceLabel(p: Plan): { big: string; small: string } {
    if (p.monthly === null) return { big: "Custom", small: "" };
    const m = annual ? Math.round(p.monthly * 0.8) : p.monthly;
    return { big: `$${m}`, small: "/mo" };
  }

  const planHref = token ? "/dashboard" : "/login";

  return (
    <div className="text-on-surface font-body-lg overflow-x-hidden min-h-screen">
      <AuroraBackground />

      <header className="fixed top-0 left-0 w-full z-[100] px-4 md:px-8 py-4 flex justify-between items-center gap-4 glass-frosted">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span className="material-symbols-outlined text-primary text-3xl">gavel</span>
          <span className="font-display-hero text-2xl font-bold text-onboarding-navy tracking-tight">
            Clarifyd
          </span>
        </Link>
        <nav className="hidden md:flex gap-8 text-[11px] font-label-caps font-bold tracking-[0.2em] uppercase text-on-surface-variant">
          <Link className="hover:text-primary transition-colors" href="/#solutions">Solutions</Link>
          <Link className="hover:text-primary transition-colors" href="/#how">How it works</Link>
          <span className="text-primary">Pricing</span>
        </nav>
        <Link
          href={planHref}
          className="btn-capsule btn-capsule-primary text-[11px] tracking-[0.2em] uppercase px-6 py-2"
        >
          {token ? "Dashboard" : "Sign in"}
        </Link>
      </header>

      <main className="relative z-10 pt-32 pb-32 max-w-container-max mx-auto px-4 md:px-8">
        <ScrollReveal as="section" className="text-center mb-12">
          <span className="font-label-caps text-label-caps text-primary tracking-[0.2em] uppercase mb-4 block">
            Pricing
          </span>
          <h1 className="font-display-hero text-[42px] md:text-7xl leading-tight mb-4 text-onboarding-navy">
            Simple pricing for <br className="hidden md:block" />
            <span className="italic text-primary">total legal clarity.</span>
          </h1>
          <p className="text-on-surface-variant max-w-2xl mx-auto mb-8 text-lg">
            Stop overpaying for routine reviews. Pick a plan that scales with your deal flow and
            protects your vision.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-4">
            <span
              className={`font-label-caps text-label-caps uppercase ${
                !annual ? "text-onboarding-navy font-bold" : "text-on-surface-variant"
              }`}
            >
              Monthly
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={annual}
              onClick={() => setAnnual((v) => !v)}
              className="relative w-14 h-7 bg-primary rounded-full p-1 transition-all"
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  annual ? "translate-x-7" : "translate-x-0"
                }`}
              />
            </button>
            <div className="flex items-center gap-2">
              <span
                className={`font-label-caps text-label-caps uppercase ${
                  annual ? "text-onboarding-navy font-bold" : "text-on-surface-variant"
                }`}
              >
                Annual
              </span>
              <span className="px-2 py-0.5 bg-status-success/10 text-status-success rounded-full font-label-caps text-[10px]">
                20% OFF
              </span>
            </div>
          </div>
        </ScrollReveal>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((p, i) => {
            const price = priceLabel(p);
            return (
              <ScrollReveal key={p.id} delay={i * 110} className="flex">
                <div
                  className={`crystal-glass rounded-3xl p-8 flex flex-col relative w-full ${
                    p.popular ? "ring-2 ring-accent-violet/40 shadow-2xl md:-mt-3 md:mb-3" : ""
                  }`}
                >
                  {p.popular ? (
                    <div className="popular-badge-float">
                      Most
                      <br />
                      Popular
                    </div>
                  ) : null}
                  <div className="mb-8">
                    <h3 className="font-display-hero text-h2 text-onboarding-navy mb-2">
                      {p.name}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display-hero text-5xl font-bold text-onboarding-navy">
                        {price.big}
                      </span>
                      {price.small ? (
                        <span className="text-on-surface-variant text-sm">{price.small}</span>
                      ) : null}
                    </div>
                    {p.monthly !== null && annual ? (
                      <p className="text-[11px] text-on-surface-variant mt-1 m-0">
                        Billed annually · ${Math.round(p.monthly * 0.8) * 12}/yr
                      </p>
                    ) : null}
                  </div>
                  <ul className="flex flex-col gap-4 mb-10 flex-grow m-0 p-0 list-none">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-3">
                        <span
                          className={`material-symbols-outlined text-[18px] ${p.checkClass}`}
                        >
                          check_circle
                        </span>
                        <span className="text-body-sm">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={p.id === "enterprise" ? "/#security" : planHref}
                    className={`neon-glow-btn w-full py-4 rounded-xl font-bold text-center ${p.btnClass}`}
                  >
                    {p.cta}
                  </Link>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Trust signals */}
        <ScrollReveal
          as="section"
          className="mt-20 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 border-t border-white/40 pt-12"
        >
          {[
            { icon: "lock", text: "Secure payments by Stripe" },
            { icon: "verified_user", text: "30-day money-back guarantee" },
            { icon: "shield", text: "SOC2 Type II in progress" },
          ].map((t) => (
            <div key={t.text} className="flex items-center gap-3 opacity-80">
              <span
                className="material-symbols-outlined text-on-surface-variant"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {t.icon}
              </span>
              <p className="font-label-caps text-label-caps uppercase text-on-surface-variant m-0">
                {t.text}
              </p>
            </div>
          ))}
        </ScrollReveal>
      </main>

      <footer className="glass-frosted py-8 px-4 md:px-8 border-t border-white/20" role="note">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-4 text-[11px] text-on-surface-variant/90 text-center md:text-left">
          <span className="font-label-caps font-bold uppercase tracking-widest text-onboarding-navy whitespace-nowrap">
            Legal disclaimer:
          </span>
          <p className="m-0">
            Clarifyd is an AI-powered contract analysis tool, not a law firm. Findings do not
            constitute legal advice. Always consult qualified legal counsel before signing.
          </p>
        </div>
      </footer>
    </div>
  );
}
