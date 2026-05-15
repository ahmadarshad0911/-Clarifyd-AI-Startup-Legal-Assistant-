"use client";

import Link from "next/link";

import { AuroraBackground } from "../components/common/aurora-background";
import { ScrollReveal } from "../components/common/scroll-reveal";
import { useAuth } from "../lib/auth";

export default function LandingPage() {
  const { token } = useAuth();
  const primaryHref = token ? "/dashboard" : "/login";
  const primaryLabel = token ? "Go to dashboard" : "Get started";

  return (
    <div className="text-on-surface font-body-lg overflow-x-hidden">
      <AuroraBackground />

      <header className="fixed top-0 left-0 w-full z-[100] px-4 md:px-8 py-4 flex justify-between items-center gap-4 glass-frosted">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-3xl">gavel</span>
          <span className="font-display-hero text-2xl font-bold text-onboarding-navy tracking-tight">
            Clarifyd
          </span>
        </div>
        <nav className="hidden md:flex gap-8 text-[11px] font-label-caps font-bold tracking-[0.2em] uppercase text-on-surface-variant">
          <a className="hover:text-primary transition-colors" href="#solutions">Solutions</a>
          <a className="hover:text-primary transition-colors" href="#how">How it works</a>
          <Link className="hover:text-primary transition-colors" href="/pricing">Pricing</Link>
          <a className="hover:text-primary transition-colors" href="#security">Security</a>
        </nav>
        <Link
          href={primaryHref}
          className="btn-capsule btn-capsule-primary text-[11px] tracking-[0.2em] uppercase px-6 py-2"
        >
          {token ? "Dashboard" : "Sign in"}
        </Link>
      </header>

      <main className="relative z-10 pt-32 px-4 md:px-8 max-w-7xl mx-auto">
        {/* Hero */}
        <ScrollReveal as="section" variant="scale" className="mb-32">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            <span className="font-label-caps text-label-caps text-primary tracking-[0.2em] uppercase mb-6">
              AI Contract Risk Analyzer
            </span>
            <h1 className="font-display-hero text-5xl md:text-8xl leading-[1.1] text-onboarding-navy tracking-tighter mb-8">
              Read every <br />
              <span className="italic text-primary">clause before</span> <br />
              you sign.
            </h1>
            <div className="glass-frosted p-8 md:p-12 rounded-3xl shadow-2xl mt-4 w-full max-w-2xl">
              <p className="text-lg md:text-xl text-on-surface-variant leading-relaxed mb-8">
                Clarifyd uses Kimi reasoning to surface high-risk terms, loopholes, and missing
                protections in your contracts — with the authority of a senior partner, in under a
                minute.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href={primaryHref} className="btn-capsule btn-capsule-primary text-lg px-10">
                  {primaryLabel}
                </Link>
                <a
                  href="#how"
                  className="btn-capsule glass-semi-clear text-onboarding-navy text-lg px-10"
                >
                  See how it works
                </a>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Solutions bento */}
        <section id="solutions" className="mb-32 scroll-mt-28">
          <ScrollReveal>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-12 gap-8">
              <h2 className="font-display-hero text-4xl lg:text-6xl text-onboarding-navy">
                Intelligence at scale.
              </h2>
              <div className="flex gap-8 text-[10px] font-label-caps font-bold uppercase tracking-widest text-onboarding-navy/60">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">verified</span> SOC 2
                </span>
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">lock</span> 256-bit
                </span>
              </div>
            </div>
          </ScrollReveal>
          <ScrollReveal variant="stagger" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 glass-frosted rounded-3xl p-8 md:p-12 min-h-[360px] flex flex-col justify-end text-left">
              <div className="inline-flex items-center w-fit gap-2 px-4 py-1 rounded-full bg-status-danger/10 text-status-danger text-[10px] font-label-caps font-bold uppercase tracking-widest mb-6">
                <span className="w-2 h-2 rounded-full bg-status-danger animate-pulse" />
                Critical risk detection
              </div>
              <h3 className="font-display-hero text-3xl md:text-4xl text-onboarding-navy mb-4">
                Loopholes, surfaced
              </h3>
              <p className="text-on-surface-variant text-lg max-w-lg">
                Every clause assessed, risky terms flagged, founder-favorable rewrites suggested,
                then cross-verified — with a clear verdict.
              </p>
            </div>
            <div className="lg:col-span-4 glass-semi-clear rounded-3xl p-8 flex flex-col justify-between text-left">
              <span className="material-symbols-outlined text-primary text-4xl mb-4 block">
                auto_awesome
              </span>
              <div>
                <h4 className="font-display-hero text-2xl text-onboarding-navy mb-2">
                  Legal Co-Pilot
                </h4>
                <p className="text-sm text-on-surface-variant">
                  Build templates or ask any startup legal question.
                </p>
              </div>
            </div>
            <div className="lg:col-span-4 glass-crystal rounded-3xl p-8 flex flex-col justify-between border-l-4 border-l-onboarding-gold/40 text-left">
              <span className="material-symbols-outlined text-onboarding-gold text-4xl mb-4 block">
                security
              </span>
              <div>
                <h4 className="font-display-hero text-2xl text-onboarding-navy mb-2">
                  Injection shield
                </h4>
                <p className="text-sm text-on-surface-variant">
                  Hardened against adversarial text in third-party paper.
                </p>
              </div>
            </div>
            <div className="lg:col-span-8 glass-semi-clear rounded-3xl p-8 flex flex-col justify-between text-left">
              <span className="material-symbols-outlined text-status-success text-4xl mb-4 block">
                history_edu
              </span>
              <div>
                <h4 className="font-display-hero text-2xl text-onboarding-navy mb-2">
                  Tamper-evident exports
                </h4>
                <p className="text-sm text-on-surface-variant">
                  Cryptographically sealed audit reports for every analysis.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* How it works */}
        <section id="how" className="mb-32 scroll-mt-28">
          <ScrollReveal>
            <h2 className="font-display-hero text-4xl md:text-5xl text-center text-onboarding-navy mb-24">
              Three steps to clarity.
            </h2>
          </ScrollReveal>
          <ScrollReveal variant="stagger" className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-8 items-stretch">
            {[
              {
                n: "1",
                t: "Upload your contract",
                b: "Drag and drop any PDF or Word document. 256-bit encryption on every transfer.",
                cls: "glass-frosted",
              },
              {
                n: "2",
                t: "Kimi-powered analysis",
                b: "Reasoning scans for high-risk clauses, missing protections, unfavorable terms.",
                cls: "glass-semi-clear",
              },
              {
                n: "3",
                t: "Review the verdict",
                b: "Categorized report with loopholes, suggested clauses, and cross-verification.",
                cls: "glass-crystal border-t-8 border-t-onboarding-gold/30",
              },
            ].map((s, i) => (
              <div
                key={s.n}
                className={`${s.cls} p-10 rounded-3xl relative shadow-xl flex flex-col text-left ${
                  i > 0 ? "mt-8 md:mt-0" : ""
                }`}
              >
                <div
                  className={`absolute -top-10 left-8 w-20 h-20 rounded-full flex items-center justify-center font-display-hero text-4xl border-4 border-white/50 ${
                    s.n === "3"
                      ? "bg-onboarding-gold text-white"
                      : "glass-semi-clear text-primary"
                  }`}
                >
                  {s.n}
                </div>
                <div className="mt-8">
                  <h3 className="font-display-hero text-2xl md:text-3xl text-onboarding-navy mb-4">
                    {s.t}
                  </h3>
                  <p className="text-on-surface-variant leading-relaxed">{s.b}</p>
                </div>
              </div>
            ))}
          </ScrollReveal>
        </section>

        {/* Final CTA */}
        <ScrollReveal as="section" variant="scale" className="pb-32 text-center scroll-mt-28">
          <div id="security" className="glass-frosted p-12 md:p-24 rounded-3xl relative overflow-hidden scroll-mt-28">
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-[80px]" />
            <h2 className="font-display-hero text-4xl md:text-6xl text-onboarding-navy mb-12 relative z-10">
              Ready to secure your next deal?
            </h2>
            <Link
              href={primaryHref}
              className="btn-capsule btn-capsule-primary md:text-2xl inline-flex relative z-10 py-6 px-16 text-xl"
            >
              {primaryLabel}
            </Link>
          </div>
        </ScrollReveal>
      </main>

      <footer className="glass-frosted py-8 px-4 md:px-8 border-t border-white/20" role="note">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-4 text-[11px] text-on-surface-variant/90 text-center md:text-left">
          <span className="font-label-caps font-bold uppercase tracking-widest text-onboarding-navy whitespace-nowrap">
            Legal disclaimer:
          </span>
          <p className="m-0 flex-1">
            Clarifyd is an AI-powered contract analysis tool, not a law firm. Findings do not
            constitute legal advice and do not create an attorney-client relationship. Always
            consult qualified legal counsel before signing binding agreements.
          </p>
          <Link
            href="/terms"
            className="font-label-caps uppercase tracking-widest text-primary hover:underline whitespace-nowrap"
          >
            Terms &amp; conditions
          </Link>
        </div>
      </footer>
    </div>
  );
}
