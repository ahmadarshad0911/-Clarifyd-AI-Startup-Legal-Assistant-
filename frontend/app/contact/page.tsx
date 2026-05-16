"use client";

/**
 * Contact page — public marketing route (no auth gate).
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Hero (title + live-time response-window indicator)       │
 *   ├──────────────────┬──────────────────────────────────────┤
 *   │ Channels (3D     │ Form (glass-field-strong)            │
 *   │ flip-on-hover    │  - name / email / company / topic    │
 *   │ cards)           │  - message                           │
 *   │                  │  - Send → paper airplane fly-off     │
 *   ├──────────────────┴──────────────────────────────────────┤
 *   │ FAQ accordion (glass)                                    │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Motion:
 *   - Parallax aurora orbs follow cursor lazily.
 *   - Each channel card flips 180° on hover to reveal the actual value
 *     plus a copy-to-clipboard button.
 *   - Form has bubbly focus halos via glass-field-strong.
 *   - On submit: button morphs into a paper airplane SVG that flies up
 *     and to the right, then a success card slides up from below.
 *   - All animations gated on prefers-reduced-motion.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AuroraBackground } from "../../components/common/aurora-background";
import { ContactForm } from "../../components/contact/contact-form";

type Channel = {
  icon: string;
  label: string;
  value: string;
  href: string;
  tone: string;
};

const CHANNELS: Channel[] = [
  {
    icon: "mail",
    label: "Email us",
    value: "hello@clarifyd.com",
    href: "mailto:hello@clarifyd.com",
    tone: "#3525cd",
  },
  {
    icon: "support_agent",
    label: "Live chat",
    value: "Mon–Fri · 9-5 PKT",
    href: "#",
    tone: "#7c3aed",
  },
  {
    icon: "schedule",
    label: "Book a demo",
    value: "cal.com/clarifyd",
    href: "https://cal.com/clarifyd",
    tone: "#059669",
  },
  {
    icon: "forum",
    label: "Community",
    value: "discord.gg/clarifyd",
    href: "https://discord.gg/clarifyd",
    tone: "#ea580c",
  },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How fast do you respond?",
    a: "Email: under 6 business hours (PKT). Live chat: instant during 9-5 PKT. Demo bookings: same day for any slot you pick.",
  },
  {
    q: "Do you offer custom jurisdiction templates?",
    a: "Yes — Enterprise plans include bespoke templates for any single jurisdiction (US, UK, EU, SG, AU, others on request). Drop us a note with your jurisdiction and we'll scope it.",
  },
  {
    q: "Can I get a free trial of Pro?",
    a: "Every signup includes 3 free Pro analyses, no credit card. After that, Starter ($19/mo) keeps you in the Kimi reasoning loop. Enterprise pilots run 14 days.",
  },
  {
    q: "Is my data used to train any model?",
    a: "No. We never train on customer contracts. Encryption at rest (AES-256) and in transit (TLS 1.3). Audit log is hash-chained and tamper-evident.",
  },
];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ContactPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Parallax orbs follow cursor.
  const stageRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = stageRef.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--ox", `${px * 30}px`);
      el.style.setProperty("--oy", `${py * 30}px`);
    }
    el.addEventListener("mousemove", onMove, { passive: true });
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  // Live response-window indicator.
  const [nowLabel, setNowLabel] = useState<string>("Online");
  useEffect(() => {
    function tick() {
      const d = new Date();
      // Treat user-local hour as a rough proxy.
      const h = d.getHours();
      const dow = d.getDay();
      const weekday = dow >= 1 && dow <= 5;
      const onShift = weekday && h >= 9 && h < 17;
      setNowLabel(onShift ? "Online — replying live" : "Async — usually < 6 hrs");
    }
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  async function copy(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      window.setTimeout(() => setCopiedIdx(null), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="contact-root text-on-surface font-body-lg overflow-x-hidden min-h-screen">
      <AuroraBackground />

      {/* ============ HEADER ============ */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 md:px-10 py-4 flex justify-between items-center gap-4 glass-frosted">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span className="material-symbols-outlined text-primary text-3xl">gavel</span>
          <span className="font-display-hero text-2xl font-bold text-onboarding-navy tracking-tight">
            Clarifyd
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          <Link href="/" className="hidden sm:inline hover:text-primary transition-colors">
            Home
          </Link>
          <Link href="/pricing" className="hidden sm:inline hover:text-primary transition-colors">
            Pricing
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-primary to-accent-violet text-white text-[12px] shadow-md shadow-primary/40"
          >
            Sign in
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </nav>
      </header>

      <main ref={stageRef} className="contact-stage relative pt-28 md:pt-36 pb-24 px-4 md:px-10">
        {/* Parallax floating orbs */}
        <div className="contact-orb contact-orb-1" aria-hidden />
        <div className="contact-orb contact-orb-2" aria-hidden />
        <div className="contact-orb contact-orb-3" aria-hidden />

        <div className="max-w-container-max mx-auto relative z-10">
          {/* ============ HERO ============ */}
          <div className="text-center mb-12 md:mb-16">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest text-primary bg-white/55 border border-white/65 backdrop-blur">
              <span className="contact-status-dot" aria-hidden />
              {nowLabel}
            </span>
            <h1 className="font-display-hero text-[36px] sm:text-[48px] md:text-[64px] leading-[1.06] text-onboarding-navy mt-4 m-0 tracking-tight">
              We&rsquo;d love to{" "}
              <span className="bg-gradient-to-r from-primary to-accent-violet bg-clip-text text-transparent">
                hear from you.
              </span>
            </h1>
            <p className="text-on-surface-variant max-w-xl mx-auto mt-4 text-[15px] sm:text-[17px] leading-relaxed">
              Sales, support, demos, press, custom jurisdiction templates — pick a channel below or send the form. Real humans on the other end.
            </p>
          </div>

          {/* ============ SPLIT: CHANNELS + FORM ============ */}
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6 lg:gap-10 items-start">
            {/* CHANNELS */}
            <section className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {CHANNELS.map((c, i) => (
                <div key={c.label} className="flip-card" style={{ "--tone": c.tone } as React.CSSProperties}>
                  <div className="flip-card-inner">
                    {/* FRONT */}
                    <div className="flip-card-face flip-card-front crystal-glass">
                      <div
                        className="w-12 h-12 rounded-2xl inline-flex items-center justify-center mb-3"
                        style={{ background: `${c.tone}1a`, color: c.tone }}
                      >
                        <span className="material-symbols-outlined text-[24px]">{c.icon}</span>
                      </div>
                      <div className="font-display-hero text-h3 text-onboarding-navy m-0 leading-tight">
                        {c.label}
                      </div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">
                        Hover to reveal
                      </div>
                    </div>
                    {/* BACK */}
                    <div
                      className="flip-card-face flip-card-back"
                      style={{
                        background: `linear-gradient(135deg, ${c.tone}, ${c.tone}cc)`,
                      }}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-widest text-white/85">
                        {c.label}
                      </div>
                      <div className="font-display-hero text-[18px] sm:text-[20px] text-white mt-1 break-all leading-tight">
                        {c.value}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <a
                          href={c.href}
                          target={c.href.startsWith("http") ? "_blank" : undefined}
                          rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
                          Open
                        </a>
                        <button
                          type="button"
                          onClick={() => copy(c.value, i)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {copiedIdx === i ? "check" : "content_copy"}
                          </span>
                          {copiedIdx === i ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* FORM */}
            <section className="crystal-glass rounded-3xl p-5 sm:p-7 md:p-8 relative overflow-hidden">
              <ContactForm heading={null} subheading={null} />
            </section>
          </div>

          {/* ============ FAQ ACCORDION ============ */}
          <section className="mt-16 md:mt-24 max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">
                Frequently asked
              </span>
              <h2 className="font-display-hero text-h1-mobile md:text-h1 text-onboarding-navy m-0 mt-2">
                Quick answers first.
              </h2>
            </div>
            <ul className="flex flex-col gap-3 list-none p-0 m-0">
              {FAQS.map((f, i) => {
                const open = openFaq === i;
                return (
                  <li key={i} className="crystal-glass rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                    >
                      <span className="font-semibold text-onboarding-navy text-[15px]">
                        {f.q}
                      </span>
                      <span
                        className="material-symbols-outlined text-primary shrink-0"
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
                      style={{
                        gridTemplateRows: open ? "1fr" : "0fr",
                      }}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <p className="text-on-surface-variant text-body-sm px-5 pb-4 m-0 leading-relaxed">
                          {f.a}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="px-4 md:px-10 pb-10 pt-4">
        <div className="max-w-container-max mx-auto flex flex-wrap items-center justify-between gap-4 text-[11px] text-on-surface-variant/80 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[16px]">gavel</span>
            Clarifyd © {new Date().getFullYear()} · Decision support, not legal advice
          </div>
          <div className="flex gap-5">
            <Link href="/terms">Terms</Link>
            <Link href="/terms?tab=privacy">Privacy</Link>
            <Link href="/feedback">Feedback</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
