"use client";

/**
 * Landing page — full product story on one scroll. Crystal-glass aurora theme.
 *
 * Sections (top→bottom):
 *   1. Hero          — cursor spotlight, magnetic CTAs, 3D mouse-tilt contract card
 *   2. Trust strip   — animated marquee of founder personas
 *   3. Live demo     — fake terminal typing through a real risk scan
 *   4. How it works  — three 3D parallax cards stacked deck-style
 *   5. Stats         — count-up numbers on viewport entry
 *   6. Features      — bento grid with mouse-follow gradient borders
 *   7. Pricing       — three glass plans, "Pro" lifted on hover
 *   8. Final CTA     — orbiting glass dome with "Start free" pull
 *
 * Motion stack:
 *   - 3D = CSS perspective + transform-style: preserve-3d + rotate3d/translateZ
 *   - Mouse spotlight = single MouseMove → CSS var --mx/--my on the section
 *   - Magnetic buttons = component reads mouse offset, translates target
 *   - Tilt card = same, applies rotateX/Y
 *   - Typewriter = setInterval cycling lines, no external lib
 *   - Counter = rAF lerp from 0 to target on intersect
 *   - All motion gated on prefers-reduced-motion via the helper.
 */

import Link from "next/link";
import {
  CSSProperties,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AuroraBackground } from "../components/common/aurora-background";
import { PremiumCursor } from "../components/common/premium-cursor";
import { ScrollReveal } from "../components/common/scroll-reveal";
import { ContactForm } from "../components/contact/contact-form";
import { useAuth } from "../lib/auth";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ------------------------------------------------------------------ */
/* Mouse-tilt 3D card                                                  */
/* ------------------------------------------------------------------ */
function TiltCard({
  children,
  className = "",
  intensity = 14,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        el.style.setProperty("--rx", `${-py * intensity}deg`);
        el.style.setProperty("--ry", `${px * intensity}deg`);
        el.style.setProperty("--lx", `${px * 14}px`);
        el.style.setProperty("--ly", `${py * 14}px`);
      });
    }
    function onLeave() {
      if (!el) return;
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--lx", "0px");
      el.style.setProperty("--ly", "0px");
    }
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [intensity]);

  return (
    <div ref={ref} className={`tilt-3d ${className}`}>
      <div className="tilt-3d-inner">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Magnetic button — translates toward cursor                          */
/* ------------------------------------------------------------------ */
function MagneticLink({
  href,
  children,
  className = "",
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: "primary" | "ghost";
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) * 0.25;
      const dy = (e.clientY - cy) * 0.25;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    function onLeave() {
      if (el) el.style.transform = "translate(0,0)";
    }
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);
  const styleClass =
    variant === "primary"
      ? "bg-gradient-to-r from-primary to-accent-violet text-white shadow-lg shadow-primary/40"
      : "bg-white/60 text-onboarding-navy border border-white/70";
  return (
    <Link
      ref={ref}
      href={href}
      className={`magnetic-btn inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold tracking-tight ${styleClass} ${className}`}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Count-up — animates 0 → target when scrolled into view              */
/* ------------------------------------------------------------------ */
function CountUp({
  to,
  suffix = "",
  duration = 1400,
}: {
  to: number;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setVal(to);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let raf: number | null = null;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        const start = performance.now();
        function tick(now: number) {
          const t = Math.min(1, (now - start) / duration);
          const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
          setVal(Math.round(to * e));
          if (t < 1) raf = requestAnimationFrame(tick);
        }
        raf = requestAnimationFrame(tick);
        obs.unobserve(el);
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [to, duration]);
  return (
    <span ref={ref}>
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Typewriter loop                                                     */
/* ------------------------------------------------------------------ */
function Typewriter({ lines, speed = 32 }: { lines: string[]; speed?: number }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState("");
  const [phase, setPhase] = useState<"type" | "hold" | "erase">("type");

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(lines[i]);
      return;
    }
    let t: number;
    if (phase === "type") {
      if (shown.length < lines[i].length) {
        t = window.setTimeout(
          () => setShown(lines[i].slice(0, shown.length + 1)),
          speed
        );
      } else {
        t = window.setTimeout(() => setPhase("hold"), 1400);
      }
    } else if (phase === "hold") {
      t = window.setTimeout(() => setPhase("erase"), 900);
    } else {
      if (shown.length > 0) {
        t = window.setTimeout(
          () => setShown(shown.slice(0, -1)),
          speed / 2
        );
      } else {
        setPhase("type");
        setI((p) => (p + 1) % lines.length);
      }
    }
    return () => clearTimeout(t);
  }, [shown, phase, i, lines, speed]);

  return (
    <span>
      {shown}
      <span className="typewriter-caret" aria-hidden>
        |
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  const { token } = useAuth();
  const primaryHref = token ? "/dashboard" : "/login";
  const primaryLabel = token ? "Open dashboard" : "Start free";

  // Hero cursor spotlight — set CSS vars on the hero element.
  const heroRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = heroRef.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  const heroLines = useMemo(
    () => [
      "found a 9-figure liability cap",
      "spotted an auto-renewing IP grant",
      "flagged a one-sided indemnity",
      "caught a 5-year non-compete",
      "rewrote a runaway termination clause",
    ],
    []
  );

  return (
    <div className="landing-root text-on-surface font-body-lg overflow-x-hidden">
      <PremiumCursor />
      <AuroraBackground />

      {/* ============ HEADER ============ */}
      <header className="fixed top-0 left-0 right-0 z-[100] px-4 md:px-10 py-4 flex justify-between items-center gap-4 glass-frosted">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span className="material-symbols-outlined text-primary text-3xl">gavel</span>
          <span className="font-display-hero text-2xl font-bold text-onboarding-navy tracking-tight">
            Clarifyd
          </span>
        </Link>
        <nav className="hidden md:flex gap-7 text-[11px] font-label-caps font-bold tracking-[0.18em] uppercase text-on-surface-variant">
          <a href="#how" className="hover:text-primary transition-colors">How</a>
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
          <a href="#contact" className="hover:text-primary transition-colors">Contact</a>
          <Link href="/feedback" className="hover:text-primary transition-colors">Feedback</Link>
        </nav>
        <MagneticLink href={primaryHref} className="text-sm py-2 px-5">
          {primaryLabel}
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </MagneticLink>
      </header>

      {/* ============ HERO ============ */}
      <section ref={heroRef} className="landing-hero relative pt-24 pb-16 sm:pt-32 sm:pb-20 md:pt-44 md:pb-32 px-4 md:px-10">
        <div className="hero-spotlight" aria-hidden />
        <div className="max-w-container-max mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center relative z-10">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest text-primary bg-white/55 border border-white/65 backdrop-blur">
              <span className="material-symbols-outlined text-[14px]">bolt</span>
              Kimi K2 reasoning · live now
            </span>
            <h1 className="font-display-hero text-[34px] sm:text-[44px] md:text-[64px] leading-[1.08] md:leading-[1.05] text-onboarding-navy mt-4 sm:mt-5 m-0 tracking-tight">
              Read contracts <br className="hidden md:inline" />
              like a senior counsel.
              <span className="block bg-gradient-to-r from-primary to-accent-violet bg-clip-text text-transparent">
                Without paying like one.
              </span>
            </h1>
            <p className="text-on-surface-variant max-w-xl mt-5 sm:mt-6 text-[15px] sm:text-[17px] leading-relaxed">
              Clarifyd reads your founder agreements, SAFEs, vendor contracts and term sheets — flags the loopholes, rewrites the risky clauses, and ships you a collaborator-ready draft. Last week we{" "}
              <span className="font-semibold text-onboarding-navy">
                <Typewriter lines={heroLines} />
              </span>.
            </p>
            <div className="mt-7 sm:mt-9 flex flex-wrap gap-3 sm:gap-4 items-center">
              <MagneticLink href={primaryHref} className="text-sm sm:text-base">
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">upload_file</span>
                {primaryLabel} — free
              </MagneticLink>
              <MagneticLink href="#how" variant="ghost" className="text-sm sm:text-base">
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">play_arrow</span>
                See how it works
              </MagneticLink>
            </div>
            <p className="text-[12px] text-on-surface-variant/70 mt-5 m-0">
              No credit card · 3 analyses free · AES-256 in transit &amp; at rest · not legal advice
            </p>
          </div>

          {/* 3D mouse-tilt mock contract card */}
          <TiltCard className="hero-card-wrap">
            <div className="hero-card crystal-glass rounded-3xl p-6 md:p-7 relative">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">description</span>
                  <span className="font-semibold text-on-surface text-sm">
                    SAFE_Agreement_v3.pdf
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-status-success bg-status-success/10 px-2 py-1 rounded-full">
                  analyzed
                </span>
              </div>

              <div className="space-y-2.5 mb-5 relative">
                <div className="h-2.5 rounded bg-on-surface-variant/15 w-[90%]" />
                <div className="h-2.5 rounded bg-status-danger/35 w-[70%] relative">
                  <span className="absolute -right-2 -top-2 text-[9px] font-bold text-white bg-status-danger px-1.5 py-0.5 rounded-full uppercase tracking-wider hero-pop-1">
                    high
                  </span>
                </div>
                <div className="h-2.5 rounded bg-on-surface-variant/15 w-[85%]" />
                <div className="h-2.5 rounded bg-on-surface-variant/15 w-[78%]" />
                <div className="h-2.5 rounded bg-status-warn/35 w-[60%] relative">
                  <span className="absolute -right-2 -top-2 text-[9px] font-bold text-white bg-status-warn px-1.5 py-0.5 rounded-full uppercase tracking-wider hero-pop-2">
                    medium
                  </span>
                </div>
                <div className="h-2.5 rounded bg-on-surface-variant/15 w-[92%]" />
                <div className="h-2.5 rounded bg-on-surface-variant/15 w-[55%]" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="rounded-xl p-2.5 bg-status-danger/10 border border-status-danger/25">
                  <div className="font-display-hero text-xl text-status-danger leading-none">2</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-status-danger/85 mt-1">Critical</div>
                </div>
                <div className="rounded-xl p-2.5 bg-status-warn/10 border border-status-warn/25">
                  <div className="font-display-hero text-xl text-status-warn leading-none">3</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-status-warn/85 mt-1">High</div>
                </div>
                <div className="rounded-xl p-2.5 bg-status-success/10 border border-status-success/25">
                  <div className="font-display-hero text-xl text-status-success leading-none">11</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-status-success/85 mt-1">Clean</div>
                </div>
              </div>

              <div className="text-[11px] text-on-surface-variant border-t border-on-surface-variant/15 pt-3">
                <span className="font-bold text-onboarding-navy">Top risk:</span>{" "}
                Founders waive right to enforce vesting acceleration on change of control.
              </div>

              <span className="hero-pill hero-pill-1">
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                Kimi rewrote it
              </span>
              <span className="hero-pill hero-pill-2">
                <span className="material-symbols-outlined text-[14px]">handshake</span>
                Counter-proposal ready
              </span>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* ============ TRUST MARQUEE ============ */}
      <section className="py-10 px-4 md:px-10">
        <div className="max-w-container-max mx-auto crystal-glass rounded-2xl px-6 py-5 overflow-hidden">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-on-surface-variant/80 text-center mb-3">
            Built for founders, by founders — used at
          </div>
          <div className="marquee">
            <div className="marquee-track">
              {[
                "Y Combinator W26", "Antler", "Techstars", "500 Global",
                "On Deck", "Pioneer", "Sequoia Arc", "EF",
                "Y Combinator W26", "Antler", "Techstars", "500 Global",
              ].map((n, i) => (
                <span key={i} className="marquee-item">{n}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ LIVE DEMO TERMINAL ============ */}
      <section id="demo" className="py-20 md:py-28 px-4 md:px-10">
        <div className="max-w-container-max mx-auto text-center mb-12">
          <ScrollReveal>
            <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">
              In real time
            </span>
            <h2 className="font-display-hero text-h1-mobile md:text-h1 text-onboarding-navy m-0 mt-2">
              Watch Kimi scan a SAFE in 8 seconds.
            </h2>
          </ScrollReveal>
        </div>
        <ScrollReveal>
          <div className="max-w-3xl mx-auto demo-terminal rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-onboarding-navy/95 border-b border-white/10">
              <span className="w-3 h-3 rounded-full bg-status-danger/80" />
              <span className="w-3 h-3 rounded-full bg-status-warn/80" />
              <span className="w-3 h-3 rounded-full bg-status-success/80" />
              <span className="ml-3 text-[11px] text-white/70 font-mono">
                clarifyd · scan SAFE_Agreement_v3.pdf
              </span>
            </div>
            <pre className="m-0 p-5 text-[13px] leading-relaxed bg-[#0b0f1e] text-emerald-200 font-mono whitespace-pre-wrap demo-scroll">
{`▸ Extracting text from PDF (4,217 words)…           ✓ 0.4s
▸ Tagging clauses against taxonomy (24 categories)…  ✓ 0.6s
▸ Routing through Kimi K2 (NVIDIA NIM)…              ✓ 6.2s
▸ Cross-verifying with rules engine…                 ✓ 0.3s
─────────────────────────────────────────────────────
LIABILITY_CAP        HIGH      score 8.4  conf 0.91
   ↳ "in no event shall the company's aggregate
      liability exceed one hundred dollars ($100)…"
   ↳ suggest: cap at greater of fees paid OR $50,000
IP_ASSIGNMENT        CRITICAL  score 9.1  conf 0.94
   ↳ founder assigns all pre-existing IP, irrevocable
   ↳ suggest: scope to work product made for company
NON_COMPETE          MEDIUM    score 6.0  conf 0.78
   ↳ 5-year duration, global jurisdiction
   ↳ suggest: 12 months, defined geography
─────────────────────────────────────────────────────
Done. 2 critical · 3 high · 11 clean.   Total: 7.5s`}
            </pre>
          </div>
        </ScrollReveal>
      </section>

      {/* ============ HOW IT WORKS — 3D STACK ============ */}
      <section id="how" className="py-20 md:py-28 px-4 md:px-10">
        <div className="max-w-container-max mx-auto">
          <div className="text-center mb-14">
            <ScrollReveal>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">
                Three taps to a safer contract
              </span>
              <h2 className="font-display-hero text-h1-mobile md:text-h1 text-onboarding-navy m-0 mt-2">
                Upload. Negotiate. Send.
              </h2>
            </ScrollReveal>
          </div>

          <div className="how-stack mx-auto" style={{ maxWidth: 920 }}>
            {[
              {
                step: "01",
                title: "Upload",
                body:
                  "Drop a PDF or DOCX. We extract every clause, hash it, and pass each one through Kimi K2 with prompt-injection guards on.",
                icon: "upload_file",
                tone: "#3525cd",
              },
              {
                step: "02",
                title: "Negotiate",
                body:
                  "Findings tab gives you the verdict; Negotiation Lab gives you the redline. Accept Kimi's safer clauses with one tap — see exactly what changes vs. the original.",
                icon: "handshake",
                tone: "#7c3aed",
              },
              {
                step: "03",
                title: "Send",
                body:
                  "Export an ultimate collaborator document — your accepted clauses spliced verbatim into the original, everything else byte-identical. PDF, .txt, or copy to clipboard.",
                icon: "rocket_launch",
                tone: "#059669",
              },
            ].map((s, i) => (
              <ScrollReveal key={s.step} delay={i * 120}>
                <article
                  className="how-card crystal-glass"
                  style={
                    {
                      "--tone": s.tone,
                      "--idx": i,
                    } as CSSProperties
                  }
                >
                  <div className="how-card-step" style={{ color: s.tone }}>
                    {s.step}
                  </div>
                  <div className="how-card-icon" style={{ background: `${s.tone}1a`, color: s.tone }}>
                    <span className="material-symbols-outlined text-[26px]">{s.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display-hero text-h2 text-onboarding-navy m-0 leading-tight">
                      {s.title}
                    </h3>
                    <p className="text-on-surface-variant mt-2 m-0 max-w-xl">{s.body}</p>
                  </div>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="py-16 md:py-24 px-4 md:px-10">
        <div className="max-w-container-max mx-auto crystal-glass rounded-3xl p-6 sm:p-8 md:p-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 sm:gap-x-8 lg:gap-12 text-center">
            {[
              { v: 12000, suf: "+", label: "Clauses analyzed" },
              { v: 8, suf: "s", label: "Avg scan time" },
              { v: 94, suf: "%", label: "Founder approval" },
              { v: 0, suf: "", label: "Lawyer hours billed" },
            ].map((s, i, arr) => (
              <div
                key={s.label}
                className={`relative ${i < arr.length - 1 ? "lg:after:absolute lg:after:right-[-24px] lg:after:top-1/2 lg:after:-translate-y-1/2 lg:after:h-12 lg:after:w-px lg:after:bg-on-surface-variant/15" : ""}`}
              >
                <div className="font-display-hero text-[34px] sm:text-4xl lg:text-5xl text-onboarding-navy leading-none whitespace-nowrap">
                  <CountUp to={s.v} suffix={s.suf} />
                </div>
                <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mt-2 sm:mt-3 leading-tight">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BENTO FEATURES ============ */}
      <section id="features" className="py-20 md:py-28 px-4 md:px-10">
        <div className="max-w-container-max mx-auto">
          <div className="text-center mb-12">
            <ScrollReveal>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">
                Built for the messy reality of pre-seed
              </span>
              <h2 className="font-display-hero text-h1-mobile md:text-h1 text-onboarding-navy m-0 mt-2">
                Everything legal, none of the latin.
              </h2>
            </ScrollReveal>
          </div>

          <div className="bento-grid">
            <BentoCard
              span="md:col-span-2 md:row-span-2"
              icon="psychology"
              title="Kimi K2 reasoning"
              body="Routed through NVIDIA NIM. Multi-pass cross-verification, prompt-injection detection, and a deterministic rules fallback so you never hit a wall."
              tone="#3525cd"
            />
            <BentoCard
              icon="handshake"
              title="Collaborator doc"
              body="Splice only the clauses you accept. Rest of the doc stays byte-identical."
              tone="#7c3aed"
            />
            <BentoCard
              icon="shield"
              title="Hash-chained audit"
              body="Every analysis + redline is signed into an append-only chain. Tamper-evident by default."
              tone="#059669"
            />
            <BentoCard
              span="md:col-span-2"
              icon="auto_awesome"
              title="Co-Pilot smart builder"
              body="Generate first-draft clauses from a one-line prompt — tuned to your stage, sector and jurisdiction."
              tone="#ea580c"
            />
            <BentoCard
              icon="lock"
              title="AES-256 + zero training"
              body="Your contracts never train a model. Encrypted at rest and in transit."
              tone="#1E3A8A"
            />
            <BentoCard
              icon="bolt"
              title="8-second scans"
              body="Average end-to-end analysis under ten seconds on Kimi K2."
              tone="#dc2626"
            />
          </div>
        </div>
      </section>

      {/* ============ PRICING TEASER ============ */}
      <section id="pricing" className="py-20 md:py-28 px-4 md:px-10">
        <div className="max-w-container-max mx-auto">
          <div className="text-center mb-12">
            <ScrollReveal>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">
                One price you can read in 8 seconds
              </span>
              <h2 className="font-display-hero text-h1-mobile md:text-h1 text-onboarding-navy m-0 mt-2">
                Plans that grow with the round.
              </h2>
            </ScrollReveal>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "Starter",
                price: "$19",
                blurb: "Indie founder kicking tires.",
                bullets: ["15 analyses / mo", "Kimi reasoning", "PDF export", "1 seat"],
                highlight: false,
              },
              {
                name: "Pro",
                price: "$49",
                blurb: "Pre-seed / seed startup.",
                bullets: [
                  "50 analyses / mo",
                  "Collaborator doc export",
                  "Clause library save",
                  "3 seats · priority support",
                ],
                highlight: true,
              },
              {
                name: "Business",
                price: "$149",
                blurb: "Series A team with in-house ops.",
                bullets: [
                  "200 analyses / mo",
                  "10 seats",
                  "Webhook + Slack notify",
                  "Audit log export",
                ],
                highlight: false,
              },
            ].map((p) => (
              <ScrollReveal key={p.name}>
                <div
                  className={`pricing-card crystal-glass rounded-3xl p-7 relative ${
                    p.highlight ? "pricing-card-pro" : ""
                  }`}
                >
                  {p.highlight ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest text-white bg-gradient-to-r from-primary to-accent-violet px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
                      Most popular
                    </span>
                  ) : null}
                  <div className="text-center">
                    <div className="font-display-hero text-h2 text-onboarding-navy m-0">{p.name}</div>
                    <div className="font-display-hero text-5xl text-onboarding-navy mt-3">
                      {p.price}
                      <span className="text-base text-on-surface-variant font-body-lg font-normal">/mo</span>
                    </div>
                    <div className="text-[12px] text-on-surface-variant mt-2">{p.blurb}</div>
                  </div>
                  <ul className="mt-6 space-y-2.5 text-[13px] text-on-surface m-0 p-0 list-none">
                    {p.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <span
                          className="material-symbols-outlined text-status-success text-[18px] shrink-0 mt-0.5"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={primaryHref}
                    className={`mt-7 inline-flex w-full justify-center items-center gap-2 py-3 rounded-full font-semibold transition-all ${
                      p.highlight
                        ? "bg-gradient-to-r from-primary to-accent-violet text-white shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50"
                        : "bg-white/65 border border-white/75 text-onboarding-navy hover:bg-white/85"
                    }`}
                  >
                    {primaryLabel}
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </Link>
                </div>
              </ScrollReveal>
            ))}
          </div>
          <p className="text-center text-[12px] text-on-surface-variant/80 mt-8">
            Enterprise · SSO · custom jurisdiction templates · dedicated review queue —{" "}
            <Link href="/pricing" className="text-primary font-semibold">talk to us</Link>.
          </p>
        </div>
      </section>

      {/* ============ CONTACT (embedded, public) ============ */}
      <section id="contact" className="py-20 md:py-28 px-4 md:px-10">
        <div className="max-w-container-max mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 items-start">
          <div className="lg:sticky lg:top-28">
            <ScrollReveal>
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">
                Talk to a human
              </span>
              <h2 className="font-display-hero text-h1-mobile md:text-h1 text-onboarding-navy m-0 mt-2">
                Skip the signup,<br />
                <span className="bg-gradient-to-r from-primary to-accent-violet bg-clip-text text-transparent">
                  message us first.
                </span>
              </h2>
              <p className="text-on-surface-variant mt-4 max-w-md text-[15px] leading-relaxed">
                Pricing questions, custom jurisdiction templates, enterprise SSO, demo bookings —
                no account needed. Real reply within <strong>6 business hours</strong>.
              </p>
              <ul className="mt-6 flex flex-col gap-3 list-none p-0 m-0">
                {[
                  { icon: "mail",          v: "hello@clarifyd.com",      href: "mailto:hello@clarifyd.com" },
                  { icon: "schedule",      v: "cal.com/clarifyd",        href: "https://cal.com/clarifyd" },
                  { icon: "forum",         v: "discord.gg/clarifyd",     href: "https://discord.gg/clarifyd" },
                ].map((c) => (
                  <li key={c.v}>
                    <a
                      href={c.href}
                      target={c.href.startsWith("http") ? "_blank" : undefined}
                      rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="inline-flex items-center gap-2 text-onboarding-navy hover:text-primary transition-colors font-semibold"
                    >
                      <span className="material-symbols-outlined text-primary text-[20px]">{c.icon}</span>
                      {c.v}
                      <span className="material-symbols-outlined text-[16px] opacity-60">arrow_outward</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-[12px] text-on-surface-variant/70 mt-6 m-0">
                Prefer the full layout? Open the{" "}
                <Link href="/contact" className="text-primary font-semibold underline">
                  dedicated contact page
                </Link>.
              </p>
            </ScrollReveal>
          </div>

          <ScrollReveal>
            <div className="crystal-glass rounded-3xl p-5 sm:p-7 md:p-8 relative overflow-hidden">
              <ContactForm
                compact
                heading="Tell us what you need"
                subheading="No credit card, no account — just the form."
              />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ============ FINAL CTA — 3D ORB ============ */}
      <section className="py-24 md:py-32 px-4 md:px-10">
        <div className="max-w-container-max mx-auto crystal-glass rounded-[2.5rem] p-10 md:p-16 text-center relative overflow-hidden">
          <div className="cta-orb" aria-hidden>
            <div className="cta-orb-ring cta-orb-ring-1" />
            <div className="cta-orb-ring cta-orb-ring-2" />
            <div className="cta-orb-ring cta-orb-ring-3" />
            <div className="cta-orb-core" />
          </div>
          <div className="relative z-10">
            <h2 className="font-display-hero text-h1-mobile md:text-h1 text-onboarding-navy m-0">
              Sign the smart version of the contract.
            </h2>
            <p className="text-on-surface-variant max-w-xl mx-auto mt-3">
              Three free analyses. No credit card. Your first risky clause is on us.
            </p>
            <div className="mt-8 flex justify-center gap-4 flex-wrap">
              <MagneticLink href={primaryHref} className="text-base">
                <span className="material-symbols-outlined text-[20px]">upload_file</span>
                {primaryLabel}
              </MagneticLink>
              <MagneticLink href="/feedback" variant="ghost" className="text-base">
                <span className="material-symbols-outlined text-[20px]">forum</span>
                Talk to us
              </MagneticLink>
            </div>
          </div>
        </div>
      </section>

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
            <Link href="/contact">Contact</Link>
            <Link href="/feedback">Feedback</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bento card with mouse-follow gradient border                        */
/* ------------------------------------------------------------------ */
function BentoCard({
  icon,
  title,
  body,
  tone,
  span = "",
}: {
  icon: string;
  title: string;
  body: string;
  tone: string;
  span?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);
  return (
    <div
      ref={ref}
      className={`bento-card crystal-glass rounded-2xl p-6 relative overflow-hidden ${span}`}
      style={{ "--tone": tone } as CSSProperties}
    >
      <span className="bento-card-border" aria-hidden />
      <div className="relative z-10">
        <div
          className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4"
          style={{ background: `${tone}1a`, color: tone }}
        >
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
        <h3 className="font-display-hero text-h3 text-onboarding-navy m-0 leading-tight">
          {title}
        </h3>
        <p className="text-on-surface-variant text-body-sm mt-2 m-0">{body}</p>
      </div>
    </div>
  );
}
