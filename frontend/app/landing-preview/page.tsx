"use client";

/**
 * Landing preview — Clarifyd "Night Desk"
 *
 * A confident DARK editorial surface. Scene: a founder reading a term sheet at
 * 1am, the only light a desk lamp on a dark room. Deep ink-plum ground, warm
 * paper-white type, one signal red that behaves like a highlighter pen finding
 * the dangerous clause. Distinct from the live light "Broadsheet" landing.
 *
 * Self-contained: local OKLCH tokens, own nav/footer, all motion is Framer
 * Motion with prefers-reduced-motion fallbacks. Not modifying the live route.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useInView,
  useReducedMotion,
  useMotionValue,
  useSpring,
  animate,
} from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Warning,
  ShieldCheck,
  Lightning,
  FileArrowUp,
  MagnifyingGlass,
  ListChecks,
  Export,
  Sun,
  Moon,
} from "@phosphor-icons/react";

/**
 * Theme tokens are CSS custom properties resolved per `data-theme` on the page
 * root (see THEME_VARS in ScopedStyles). `C` maps each token name to its
 * `var(--np-*)` reference so component-level color literals flow through both
 * themes without touching every call site.
 */
const C = {
  ground: "var(--np-ground)",
  groundDeep: "var(--np-ground-deep)",
  panel: "var(--np-panel)",
  panelHi: "var(--np-panel-hi)",
  paper: "var(--np-paper)",
  body: "var(--np-body)",
  muted: "var(--np-muted)",
  faint: "var(--np-faint)",
  hairline: "var(--np-hairline)",
  hairlineSoft: "var(--np-hairline-soft)",
  red: "var(--np-red)",
  redHi: "var(--np-red-hi)",
  redSoft: "var(--np-red-soft)",
  amber: "var(--np-amber)",
  green: "var(--np-green)",
  navScrim: "var(--np-nav-scrim)",
  lampGlow: "var(--np-lamp-glow)",
};

type Theme = "dark" | "light";
const THEME_STORAGE_KEY = "clarifyd-landing-theme";

const EOQ = [0.22, 1, 0.36, 1] as const;
const MONO = 'var(--font-geist-mono, "Geist Mono", ui-monospace, monospace)';
const SANS = "var(--font-geist-sans, Geist, ui-sans-serif, system-ui, sans-serif)";

export default function LandingPreviewPage() {
  const reduce = useReducedMotion() ?? false;
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      className="mobile-managed"
      data-theme={theme}
      style={{
        background: C.ground,
        color: C.body,
        minHeight: "100dvh",
        fontFamily: SANS,
        fontFeatureSettings: "'tnum', 'ss01'",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <LampGlow reduce={reduce} />
      <SkipLink />
      <Nav theme={theme} reduce={reduce} onToggleTheme={toggleTheme} />
      <main id="main">
        <Hero reduce={reduce} />
        <Ticker reduce={reduce} />
        <Workflow reduce={reduce} />
        <Differentiator reduce={reduce} />
        <Trust reduce={reduce} />
        <CtaTeaser reduce={reduce} />
      </main>
      <Footer />
      <ScopedStyles />
    </div>
  );
}

/* ------------------------------------------------------------------ theme */

/**
 * Resolves the active theme. SSR renders the default ("dark") so server and
 * first client render agree; the stored / system preference is read in an
 * effect and applied after mount to avoid a hydration mismatch.
 */
function useTheme() {
  const reduce = useReducedMotion() ?? false;
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    let initial: Theme = "dark";
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        initial = stored;
      } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
        initial = "light";
      }
    } catch {
      // localStorage unavailable (private mode etc.) — keep the default.
    }
    setTheme(initial);
  }, []);

  const toggleTheme = (origin?: { x: number; y: number }) => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const commit = () => {
      setTheme(next);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // ignore persistence failure
      }
    };

    const startViewTransition = (
      document as Document & {
        startViewTransition?: (cb: () => void) => { finished: Promise<unknown> };
      }
    ).startViewTransition;

    if (!reduce && origin != null && typeof startViewTransition === "function") {
      const root = document.documentElement;
      root.style.setProperty("--np-sweep-x", `${origin.x}px`);
      root.style.setProperty("--np-sweep-y", `${origin.y}px`);
      root.style.setProperty("--np-sweep-r", `${sweepRadius(origin.x, origin.y)}px`);
      root.dataset.npSweep = "1";
      const transition = startViewTransition.call(document, () => commit());
      void transition.finished.finally(() => {
        delete root.dataset.npSweep;
      });
    } else {
      commit();
    }
  };

  return { theme, toggleTheme };
}

/** Distance from (x,y) to the farthest viewport corner — the reveal radius. */
function sweepRadius(x: number, y: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dx = Math.max(x, w - x);
  const dy = Math.max(y, h - y);
  return Math.hypot(dx, dy);
}

/* Sun <-> moon icon that morphs with a subtle spring. Drives the page-wide
 * theme switch from its own screen coordinates so the reveal originates here. */
function ThemeToggle({
  theme,
  reduce,
  onToggle,
}: {
  theme: Theme;
  reduce: boolean;
  onToggle: (origin?: { x: number; y: number }) => void;
}) {
  const isDark = theme === "dark";
  const nextLabel = isDark ? "Switch to light theme" : "Switch to dark theme";

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    onToggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  const spring = { type: "spring", duration: 0.5, bounce: 0.2 } as const;
  const enter = { opacity: 1, scale: 1, rotate: 0 };
  const exit = reduce
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.6, rotate: isDark ? 90 : -90 };
  const from = reduce
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.6, rotate: isDark ? -90 : 90 };

  return (
    <motion.button
      type="button"
      className="np-themetoggle"
      onClick={handleClick}
      aria-label={nextLabel}
      aria-pressed={!isDark}
      title={nextLabel}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      whileHover={reduce ? undefined : { scale: 1.04 }}
    >
      <span className="np-themetoggle__well" aria-hidden>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={theme}
            className="np-themetoggle__icon"
            initial={from}
            animate={enter}
            exit={exit}
            transition={reduce ? { duration: 0.12 } : spring}
          >
            {isDark ? (
              <Moon weight="fill" size={18} />
            ) : (
              <Sun weight="fill" size={18} />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.button>
  );
}

/* ----------------------------------------------------------------- atoms */

function SkipLink() {
  return (
    <a href="#main" className="np-skip">
      Skip to content
    </a>
  );
}

/** Soft desk-lamp pool of light behind the hero. Pure decoration. */
function LampGlow({ reduce }: { reduce: boolean }) {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 0.4], [0, reduce ? 0 : -120]);
  const opacity = useTransform(scrollYProgress, [0, 0.35], [1, 0.15]);
  return (
    <motion.div
      aria-hidden
      style={{
        position: "fixed",
        top: "-18vh",
        left: "50%",
        x: "-50%",
        y: reduce ? 0 : y,
        opacity: reduce ? 0.7 : opacity,
        width: "min(120vw, 1400px)",
        height: "70vh",
        pointerEvents: "none",
        zIndex: 0,
        background:
          "radial-gradient(ellipse 60% 60% at 50% 0%, var(--np-lamp-glow), transparent 70%)",
        filter: "blur(8px)",
      }}
    />
  );
}

function Eyebrow({ children, color = C.red }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="np-mono"
      style={{
        color,
        fontSize: 11,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

/* Magnetic spring CTA. Falls back to a plain link when motion is reduced. */
function MagneticCta({
  href,
  variant = "primary",
  children,
  reduce,
  block,
}: {
  href: string;
  variant?: "primary" | "ghost";
  children: React.ReactNode;
  reduce: boolean;
  block?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 220, damping: 16, mass: 0.4 });
  const y = useSpring(my, { stiffness: 220, damping: 16, mass: 0.4 });

  function handleMove(e: React.MouseEvent) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set(((e.clientX - (r.left + r.width / 2)) / r.width) * 14);
    my.set(((e.clientY - (r.top + r.height / 2)) / r.height) * 14);
  }
  function handleLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <motion.a
      ref={ref}
      href={href}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ x: reduce ? 0 : x, y: reduce ? 0 : y }}
      className={`np-cta ${variant === "primary" ? "np-cta--primary" : "np-cta--ghost"}${block ? " np-cta--block" : ""}`}
    >
      {children}
    </motion.a>
  );
}

function Reveal({
  children,
  reduce,
  delay = 0,
  y = 18,
  as = "div",
}: {
  children: React.ReactNode;
  reduce: boolean;
  delay?: number;
  y?: number;
  as?: "div" | "li";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp
      ref={ref as React.RefObject<HTMLDivElement & HTMLLIElement>}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: EOQ, delay: reduce ? 0 : delay }}
    >
      {children}
    </Comp>
  );
}

/** Count-up on scroll into view. Snaps to final value when motion reduced. */
function CountUp({
  to,
  suffix = "",
  prefix = "",
  decimals = 0,
  reduce,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  reduce: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [val, setVal] = useState(reduce ? to : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setVal(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 1.4,
      ease: EOQ,
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [inView, to, reduce]);

  return (
    <span ref={ref}>
      {prefix}
      {val.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------- nav */

const NAV_LINKS: Array<[string, string]> = [
  ["Pricing", "/pricing"],
  ["Security", "/security"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
];

function Nav({
  theme,
  reduce,
  onToggleTheme,
}: {
  theme: Theme;
  reduce: boolean;
  onToggleTheme: (origin?: { x: number; y: number }) => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="np-nav"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: scrolled ? C.navScrim : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: `1px solid ${scrolled ? C.hairline : "transparent"}`,
        transition: "background 240ms ease, border-color 240ms ease",
      }}
    >
      <div className="np-nav__inner">
        <Link href="/landing-preview" className="np-brand" aria-label="Clarifyd home">
          <span className="np-brand__dot" aria-hidden />
          <span className="np-brand__word">Clarifyd</span>
        </Link>
        <nav aria-label="Primary" className="np-nav__links">
          {NAV_LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="np-navlink">
              {label}
            </Link>
          ))}
        </nav>
        <div className="np-nav__actions">
          <Link href="/login" className="np-navlink np-navlink--plain">
            Sign in
          </Link>
          <ThemeToggle theme={theme} reduce={reduce} onToggle={onToggleTheme} />
          <Link href="/login" className="np-cta np-cta--primary np-cta--sm">
            Start free <ArrowRight weight="bold" size={13} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ----------------------------------------------------------------- hero */

function Hero({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const cardY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -60]);

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.09, delayChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: reduce ? 0 : 22 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EOQ } },
  };

  return (
    <section ref={ref} className="np-hero" aria-labelledby="hero-title">
      <motion.div
        className="np-hero__copy"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={item}>
          <Eyebrow>Decision support for founders, not legal advice</Eyebrow>
        </motion.div>
        <motion.h1 id="hero-title" variants={item} className="np-hero__title">
          Know what you&rsquo;re signing
          <br />
          before the room does.
        </motion.h1>
        <motion.p variants={item} className="np-hero__lede">
          Drop a SAFE, term sheet, vendor MSA, or NDA. Clarifyd scores every clause
          for risk, hunts the loopholes (including the dangerous clauses that aren&rsquo;t
          there), and shows you the exact line to add. First read back in about ten
          seconds.
        </motion.p>
        <motion.div variants={item} className="np-hero__actions">
          <MagneticCta href="/login" reduce={reduce}>
            Read your first contract <ArrowRight weight="bold" size={14} aria-hidden />
          </MagneticCta>
          <MagneticCta href="/pricing" variant="ghost" reduce={reduce}>
            See pricing
          </MagneticCta>
        </motion.div>
        <motion.dl variants={item} className="np-hero__stats">
          <div>
            <dt>First read</dt>
            <dd>
              <CountUp to={10} suffix="s" reduce={reduce} />
            </dd>
          </div>
          <div>
            <dt>Free contracts</dt>
            <dd>
              <CountUp to={3} reduce={reduce} />
            </dd>
          </div>
          <div>
            <dt>Findings cited</dt>
            <dd>
              <CountUp to={100} suffix="%" reduce={reduce} />
            </dd>
          </div>
        </motion.dl>
      </motion.div>

      <motion.div className="np-hero__mock" style={{ y: reduce ? 0 : cardY }}>
        <ScanCard reduce={reduce} />
      </motion.div>
    </section>
  );
}

type Finding = {
  clause: string;
  severity: "Critical" | "High" | "Clear";
  note: string;
};
const HERO_FINDINGS: Finding[] = [
  { clause: "Liability cap", severity: "Critical", note: "Missing — no ceiling on founder exposure" },
  { clause: "IP assignment", severity: "High", note: "Ambiguous — assignee never named" },
  { clause: "Data return on exit", severity: "Critical", note: "Missing — no deletion duty" },
  { clause: "Confidentiality term", severity: "Clear", note: "Bounded at 3 years" },
];
const SEV_COLOR: Record<Finding["severity"], string> = {
  Critical: C.red,
  High: C.amber,
  Clear: C.green,
};

/** Live-feeling product moment: rows resolve one by one as if scanning. */
function ScanCard({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const show = reduce ? true : inView;

  return (
    <div ref={ref} className="np-scan" role="img" aria-label="Clarifyd analysis showing a missing liability cap flagged critical, an ambiguous IP assignment, a missing data-return clause, and a bounded confidentiality term">
      <div className="np-scan__bar">
        <span className="np-mono np-scan__file">seed_safe_v3.pdf</span>
        <span className="np-scan__live">
          <span className={`np-scan__pulse${reduce ? " is-static" : ""}`} aria-hidden />
          <span className="np-mono">analyzing</span>
        </span>
      </div>
      <ul className="np-scan__list">
        {HERO_FINDINGS.map((f, i) => (
          <motion.li
            key={f.clause}
            className="np-scan__row"
            initial={{ opacity: 0, x: reduce ? 0 : -10 }}
            animate={show ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.45, ease: EOQ, delay: reduce ? 0 : 0.5 + i * 0.32 }}
          >
            <span
              className="np-scan__sev"
              style={{ background: SEV_COLOR[f.severity], color: f.severity === "Clear" ? C.groundDeep : C.paper }}
            >
              {f.severity}
            </span>
            <span className="np-scan__clause">{f.clause}</span>
            <span className="np-scan__note">{f.note}</span>
          </motion.li>
        ))}
      </ul>
      <div className="np-scan__foot">
        <span className="np-mono">3 risks ranked, 1 clear</span>
        <span className="np-mono np-scan__time">8.4s</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- ticker */

const CONTRACT_TYPES = [
  "SAFE",
  "Term sheet",
  "Vendor MSA",
  "Mutual NDA",
  "Offer letter",
  "SaaS subscription",
  "Convertible note",
  "Advisor agreement",
  "DPA",
  "Reseller agreement",
];

function Ticker({ reduce }: { reduce: boolean }) {
  const items = [...CONTRACT_TYPES, ...CONTRACT_TYPES];
  return (
    <section className="np-ticker" aria-label="Contract types Clarifyd reads">
      <div className={`np-ticker__track${reduce ? " is-static" : ""}`}>
        {items.map((t, i) => (
          <span className="np-ticker__item" key={`${t}-${i}`} aria-hidden={i >= CONTRACT_TYPES.length}>
            <span className="np-ticker__mark">/</span>
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- workflow */

const STEPS: Array<{
  icon: React.ReactNode;
  title: string;
  body: string;
  detail: string;
}> = [
  {
    icon: <FileArrowUp weight="duotone" size={26} aria-hidden />,
    title: "Upload",
    body: "Drop a PDF or DOCX, or paste the text. Clarifyd auto-detects whether it's a SAFE, term sheet, MSA, or NDA.",
    detail: "PDF · DOCX · paste",
  },
  {
    icon: <MagnifyingGlass weight="duotone" size={26} aria-hidden />,
    title: "Analyze",
    body: "Every clause is scored for risk and grounded against its verbatim text. No invented findings, no guesses.",
    detail: "~10s · cited to the clause",
  },
  {
    icon: <ListChecks weight="duotone" size={26} aria-hidden />,
    title: "Review",
    body: "Risks ranked critical to clear. Each flag carries plain-language reasoning and the exact line to add or change.",
    detail: "Ranked · plain language",
  },
  {
    icon: <Export weight="duotone" size={26} aria-hidden />,
    title: "Export",
    body: "Hand your counterparty a clean draft with a change log that proves what moved and why. PDF or DOCX.",
    detail: "Draft + change log",
  },
];

function Workflow({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.4"],
  });
  const line = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section className="np-section np-workflow" aria-labelledby="wf-title">
      <Reveal reduce={reduce}>
        <Eyebrow>The workflow</Eyebrow>
        <h2 id="wf-title" className="np-section__title">
          Four moves from PDF to a draft your counterparty can sign.
        </h2>
      </Reveal>

      <div ref={ref} className="np-steps">
        <div className="np-steps__rail" aria-hidden>
          <motion.span className="np-steps__fill" style={{ height: reduce ? "100%" : line }} />
        </div>
        <ol className="np-steps__list">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} reduce={reduce} delay={i * 0.08} as="li">
              <article className="np-step">
                <div className="np-step__num" aria-hidden>
                  <span className="np-mono">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="np-step__icon" aria-hidden>
                  {s.icon}
                </div>
                <h3 className="np-step__title">{s.title}</h3>
                <p className="np-step__body">{s.body}</p>
                <span className="np-mono np-step__detail">{s.detail}</span>
              </article>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------- loophole differentiator */

const GAPS: Array<{ label: string; risk: string }> = [
  { label: "No liability cap", risk: "Unlimited founder exposure" },
  { label: "No IP assignment", risk: "Work product stays with the contractor" },
  { label: "No data return on termination", risk: "Vendor keeps your customer data" },
];

function Differentiator({ reduce }: { reduce: boolean }) {
  return (
    <section className="np-section np-diff" aria-labelledby="diff-title">
      <div className="np-diff__grid">
        <div className="np-diff__lead">
          <Reveal reduce={reduce}>
            <Eyebrow>More than a summarizer</Eyebrow>
            <h2 id="diff-title" className="np-section__title">
              A summary tells you what the contract says. Clarifyd tells you what it
              <span className="np-mark"> forgot to say.</span>
            </h2>
            <p className="np-diff__body">
              Most risk hides in absence. A vendor MSA with no liability cap, an NDA
              with no data-return duty, an offer letter with no IP assignment. Clarifyd
              sweeps for the clauses that should be there and aren&rsquo;t, then flags
              ambiguous language and suggests the precise line to add.
            </p>
            <MagneticCta href="/login" reduce={reduce}>
              Find your loopholes <ArrowRight weight="bold" size={14} aria-hidden />
            </MagneticCta>
          </Reveal>
        </div>

        <div className="np-diff__panel">
          <Reveal reduce={reduce} delay={0.1}>
            <div className="np-gapcard">
              <div className="np-gapcard__head">
                <Warning weight="fill" size={16} color={C.red} aria-hidden />
                <span className="np-mono">Missing clause sweep</span>
              </div>
              <ul className="np-gaplist">
                {GAPS.map((g, i) => (
                  <Reveal key={g.label} reduce={reduce} delay={0.18 + i * 0.1} as="li">
                    <div className="np-gap">
                      <span className="np-gap__label">{g.label}</span>
                      <span className="np-gap__risk">{g.risk}</span>
                    </div>
                  </Reveal>
                ))}
              </ul>
              <div className="np-gapcard__suggest">
                <span className="np-mono np-gapcard__suggestlabel">Suggested line</span>
                <p className="np-gapcard__line">
                  &ldquo;The Company&rsquo;s aggregate liability under this Agreement shall
                  not exceed the fees paid in the twelve months preceding the claim.&rdquo;
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      <Reveal reduce={reduce} delay={0.2}>
        <div className="np-assistant">
          <div className="np-assistant__avatar" aria-hidden>
            <Lightning weight="fill" size={18} color={C.paper} />
          </div>
          <div>
            <h3 className="np-assistant__title">Ask Clarifyd AI the follow-up</h3>
            <p className="np-assistant__body">
              &ldquo;Is this non-compete enforceable for a remote hire?&rdquo; &ldquo;Draft a
              data-return clause for this MSA.&rdquo; The conversational assistant answers
              in context and drafts the document. Decision support, never legal advice.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ trust */

const TRUST: Array<{ icon: React.ReactNode; title: string; body: string }> = [
  {
    icon: <ShieldCheck weight="duotone" size={24} aria-hidden />,
    title: "Encrypted in transit and at rest",
    body: "Your contracts are private to your account and never used to train a model.",
  },
  {
    icon: <ListChecks weight="duotone" size={24} aria-hidden />,
    title: "Tamper-evident audit trail",
    body: "Every analysis, accept, and export is recorded so you can prove what changed and when.",
  },
  {
    icon: <Warning weight="duotone" size={24} aria-hidden />,
    title: "Honest about its limits",
    body: "Findings are cited to the clause text. Ungrounded suggestions are dropped, not shown.",
  },
];

function Trust({ reduce }: { reduce: boolean }) {
  return (
    <section className="np-section np-trust" aria-labelledby="trust-title">
      <div className="np-trust__head">
        <Reveal reduce={reduce}>
          <Eyebrow>Built to be trusted</Eyebrow>
          <h2 id="trust-title" className="np-section__title">
            A contract is sensitive. We treat it that way.
          </h2>
        </Reveal>
        <Reveal reduce={reduce} delay={0.08}>
          <div className="np-trust__stat">
            <span className="np-trust__big">
              <CountUp to={1240} reduce={reduce} />
            </span>
            <span className="np-mono np-trust__statlabel">
              founder contracts read last quarter
            </span>
          </div>
        </Reveal>
      </div>
      <ul className="np-trust__list">
        {TRUST.map((t, i) => (
          <Reveal key={t.title} reduce={reduce} delay={i * 0.08} as="li">
            <article className="np-trustcard">
              <span className="np-trustcard__icon" aria-hidden>
                {t.icon}
              </span>
              <h3 className="np-trustcard__title">{t.title}</h3>
              <p className="np-trustcard__body">{t.body}</p>
            </article>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------- cta teaser */

function CtaTeaser({ reduce }: { reduce: boolean }) {
  return (
    <section className="np-section np-cta-teaser" aria-labelledby="cta-title">
      <Reveal reduce={reduce}>
        <div className="np-ctabox">
          <Eyebrow>Free until your seed round</Eyebrow>
          <h2 id="cta-title" className="np-ctabox__title">
            Read three contracts free.
            <br />
            Keep reading for $29 a month.
          </h2>
          <p className="np-ctabox__body">
            No annual lock-in, no contact-sales wall on the first two tiers. Founder
            plan adds unlimited contracts, a negotiation tracker, and collaborator
            export.
          </p>
          <div className="np-ctabox__actions">
            <MagneticCta href="/login" reduce={reduce}>
              Start free <ArrowRight weight="bold" size={14} aria-hidden />
            </MagneticCta>
            <MagneticCta href="/pricing" variant="ghost" reduce={reduce}>
              Compare plans <ArrowUpRight weight="bold" size={14} aria-hidden />
            </MagneticCta>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ----------------------------------------------------------------- footer */

const FOOT_COLS: Array<{ heading: string; items: Array<[string, string]> }> = [
  { heading: "Product", items: [["Pricing", "/pricing"], ["Security", "/security"], ["Sign in", "/login"]] },
  { heading: "Support", items: [["FAQ", "/faq"], ["Contact", "/contact"]] },
];

function Footer() {
  return (
    <footer className="np-footer">
      <div className="np-footer__inner">
        <div className="np-footer__brand">
          <Link href="/landing-preview" className="np-brand" aria-label="Clarifyd home">
            <span className="np-brand__dot" aria-hidden />
            <span className="np-brand__word">Clarifyd</span>
          </Link>
          <p className="np-footer__tag">
            AI contract risk analysis for pre-seed founders. Decision support, not
            legal advice.
          </p>
        </div>
        {FOOT_COLS.map((col) => (
          <nav key={col.heading} aria-label={col.heading} className="np-footer__col">
            <span className="np-mono np-footer__heading">{col.heading}</span>
            <ul>
              {col.items.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="np-footer__link">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="np-footer__base">
        <span className="np-mono">© 2026 Clarifyd</span>
        <span className="np-mono">Preview surface · Night Desk</span>
      </div>
    </footer>
  );
}

/* --------------------------------------------------------------- styles */

function ScopedStyles() {
  return (
    <style jsx global>{`
      /* ---- theme tokens ---- */
      [data-theme="dark"] {
        --np-ground: oklch(0.17 0.018 312);
        --np-ground-deep: oklch(0.13 0.016 312);
        --np-panel: oklch(0.21 0.020 312);
        --np-panel-hi: oklch(0.25 0.022 312);
        --np-paper: oklch(0.96 0.008 85);
        --np-body: oklch(0.82 0.012 90);
        --np-muted: oklch(0.66 0.012 95);
        --np-faint: oklch(0.48 0.012 100);
        --np-hairline: oklch(0.30 0.018 312 / 0.6);
        --np-hairline-soft: oklch(0.30 0.018 312 / 0.32);
        --np-red: oklch(0.63 0.205 27);
        --np-red-hi: oklch(0.70 0.21 30);
        --np-red-soft: oklch(0.63 0.205 27 / 0.16);
        --np-amber: oklch(0.76 0.14 75);
        --np-green: oklch(0.74 0.13 150);
        --np-nav-scrim: oklch(0.15 0.016 312 / 0.86);
        --np-lamp-glow: oklch(0.30 0.05 40 / 0.55);
        --np-ghost-hover: oklch(0.96 0.008 85 / 0.06);
        --np-scan-shadow: 0 30px 80px -40px oklch(0.05 0.02 312 / 0.9);
        --np-toggle-well: oklch(0.25 0.022 312 / 0.7);
        --np-toggle-icon: oklch(0.86 0.10 80);
      }
      [data-theme="light"] {
        /* Plum-tinted near-white (not cream): low-chroma neutral keyed to the
           same hue family as the dark ground. Ink-plum text, same arterial red
           darkened just enough to clear 4.5:1 on the light surface. */
        --np-ground: oklch(0.975 0.004 312);
        --np-ground-deep: oklch(0.945 0.006 312);
        --np-panel: oklch(0.995 0.002 312);
        --np-panel-hi: oklch(0.965 0.005 312);
        --np-paper: oklch(0.24 0.030 312);
        --np-body: oklch(0.36 0.026 312);
        --np-muted: oklch(0.50 0.020 312);
        --np-faint: oklch(0.60 0.016 312);
        --np-hairline: oklch(0.30 0.024 312 / 0.22);
        --np-hairline-soft: oklch(0.30 0.024 312 / 0.12);
        --np-red: oklch(0.55 0.205 27);
        --np-red-hi: oklch(0.49 0.205 27);
        --np-red-soft: oklch(0.55 0.205 27 / 0.12);
        --np-amber: oklch(0.62 0.135 66);
        --np-green: oklch(0.52 0.13 150);
        --np-nav-scrim: oklch(0.985 0.003 312 / 0.82);
        --np-lamp-glow: oklch(0.74 0.085 50 / 0.30);
        --np-ghost-hover: oklch(0.24 0.030 312 / 0.05);
        --np-scan-shadow: 0 24px 60px -38px oklch(0.30 0.04 312 / 0.45);
        --np-toggle-well: oklch(0.93 0.008 312 / 0.9);
        --np-toggle-icon: oklch(0.55 0.13 66);
      }
      /* Root carries a short crossfade on the two themed properties only — the
         var swap cascades everywhere else without a layout-thrashing
         transition: all. Skipped while a View Transitions sweep is running. */
      .mobile-managed {
        transition: background-color 260ms ease, color 260ms ease;
      }
      [data-np-sweep] .mobile-managed { transition: none; }

      /* ---- theme toggle ---- */
      .np-themetoggle {
        position: relative;
        display: inline-grid;
        place-items: center;
        width: 44px;
        height: 44px;
        margin: 0;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--np-toggle-icon);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .np-themetoggle__well {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--np-toggle-well);
        border: 1px solid ${C.hairline};
        transition: border-color 200ms ease, background 200ms ease;
      }
      .np-themetoggle__icon {
        grid-area: 1 / 1;
        display: grid;
        place-items: center;
        transform-origin: 50% 50%;
        will-change: transform, opacity;
      }
      .np-themetoggle:active .np-themetoggle__well { transform: scale(0.95); }
      @media (hover: hover) and (pointer: fine) {
        .np-themetoggle:hover .np-themetoggle__well { border-color: ${C.red}; }
      }

      /* ---- View Transitions theme sweep ---- */
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation: none;
        mix-blend-mode: normal;
      }
      ::view-transition-old(root) { z-index: 1; }
      ::view-transition-new(root) {
        z-index: 2;
        animation: np-sweep 460ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      @keyframes np-sweep {
        from {
          clip-path: circle(0 at var(--np-sweep-x, 50%) var(--np-sweep-y, 0));
          filter: blur(6px);
        }
        to {
          clip-path: circle(
            var(--np-sweep-r, 150vmax) at var(--np-sweep-x, 50%) var(--np-sweep-y, 0)
          );
          filter: blur(0);
        }
      }

      .np-skip {
        position: absolute;
        left: 16px;
        top: -60px;
        z-index: 100;
        background: ${C.paper};
        color: ${C.groundDeep};
        padding: 10px 16px;
        font-family: ${MONO};
        font-size: 12px;
        font-weight: 700;
        text-decoration: none;
        transition: top 180ms ease;
      }
      .np-skip:focus { top: 12px; }

      .np-mono { font-family: ${MONO}; font-feature-settings: 'tnum', 'ss01'; }

      *:focus-visible {
        outline: 2px solid ${C.redHi};
        outline-offset: 3px;
        border-radius: 2px;
      }

      /* ---- CTAs ---- */
      .np-cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        min-height: 48px;
        padding: 14px 26px;
        font-family: ${MONO};
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        text-decoration: none;
        border: 1.5px solid transparent;
        cursor: pointer;
        transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
      }
      .np-cta--sm { min-height: 40px; padding: 10px 18px; font-size: 11px; }
      .np-cta--block { width: 100%; }
      .np-cta--primary { background: ${C.red}; color: ${C.paper}; border-color: ${C.red}; }
      .np-cta--ghost { background: transparent; color: ${C.paper}; border-color: ${C.hairline}; }
      @media (hover: hover) and (pointer: fine) {
        .np-cta--primary:hover { background: ${C.redHi}; border-color: ${C.redHi}; }
        .np-cta--ghost:hover { border-color: ${C.paper}; background: var(--np-ghost-hover); }
      }

      /* ---- nav ---- */
      .np-nav__inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: 14px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
      }
      .np-brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
      }
      .np-brand__dot {
        width: 11px;
        height: 11px;
        background: ${C.red};
        border-radius: 50%;
        box-shadow: 0 0 16px ${C.redSoft};
      }
      .np-brand__word {
        font-family: ${SANS};
        font-weight: 700;
        font-size: 19px;
        letter-spacing: -0.03em;
        color: ${C.paper};
      }
      .np-nav__links { display: flex; align-items: center; gap: 26px; }
      .np-nav__actions { display: flex; align-items: center; gap: 14px; }
      .np-navlink {
        font-family: ${MONO};
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-weight: 600;
        color: ${C.muted};
        text-decoration: none;
        transition: color 180ms ease;
      }
      .np-navlink:hover { color: ${C.paper}; }
      .np-navlink--plain { display: none; }
      @media (max-width: 860px) {
        .np-nav__links { display: none; }
      }

      /* ---- hero ---- */
      .np-hero {
        position: relative;
        z-index: 1;
        max-width: 1200px;
        margin: 0 auto;
        padding: clamp(48px, 8vw, 96px) 24px clamp(40px, 6vw, 72px);
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
        gap: clamp(32px, 5vw, 72px);
        align-items: center;
      }
      .np-hero__title {
        margin: 18px 0 0;
        font-family: ${SANS};
        font-size: clamp(40px, 6.2vw, 84px);
        line-height: 0.98;
        letter-spacing: -0.04em;
        font-weight: 700;
        color: ${C.paper};
        text-wrap: balance;
      }
      .np-hero__lede {
        margin: 22px 0 0;
        font-size: clamp(16px, 1.4vw, 18px);
        line-height: 1.6;
        color: ${C.body};
        max-width: 56ch;
      }
      .np-hero__actions {
        margin: 30px 0 0;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .np-hero__stats {
        margin: 40px 0 0;
        display: flex;
        gap: clamp(24px, 4vw, 48px);
        flex-wrap: wrap;
        border-top: 1px solid ${C.hairlineSoft};
        padding-top: 22px;
      }
      .np-hero__stats dt {
        font-family: ${MONO};
        font-size: 10.5px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: ${C.muted};
      }
      .np-hero__stats dd {
        margin: 6px 0 0;
        font-family: ${MONO};
        font-size: clamp(28px, 3vw, 38px);
        font-weight: 700;
        color: ${C.paper};
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
      }

      /* ---- scan card ---- */
      .np-hero__mock { position: relative; z-index: 1; }
      .np-scan {
        background: ${C.panel};
        border: 1px solid ${C.hairline};
        box-shadow: var(--np-scan-shadow);
      }
      .np-scan__bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        border-bottom: 1px solid ${C.hairlineSoft};
      }
      .np-scan__file { font-size: 12px; color: ${C.body}; }
      .np-scan__live {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 10.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: ${C.red};
      }
      .np-scan__pulse {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${C.red};
        animation: np-blink 1.3s ease-in-out infinite;
      }
      .np-scan__pulse.is-static { animation: none; }
      .np-scan__list { list-style: none; margin: 0; padding: 6px 0; }
      .np-scan__row {
        display: grid;
        grid-template-columns: 78px 1fr;
        grid-template-areas: "sev clause" "sev note";
        gap: 2px 14px;
        padding: 14px 18px;
        border-bottom: 1px solid ${C.hairlineSoft};
      }
      .np-scan__row:last-child { border-bottom: none; }
      .np-scan__sev {
        grid-area: sev;
        align-self: start;
        font-family: ${MONO};
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 4px 7px;
        text-align: center;
      }
      .np-scan__clause { grid-area: clause; font-size: 14.5px; font-weight: 600; color: ${C.paper}; }
      .np-scan__note { grid-area: note; font-size: 13px; color: ${C.muted}; line-height: 1.45; }
      .np-scan__foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 13px 18px;
        border-top: 1px solid ${C.hairline};
        background: ${C.groundDeep};
        font-size: 11px;
        color: ${C.muted};
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .np-scan__time { color: ${C.green}; }

      /* ---- ticker ---- */
      .np-ticker {
        border-top: 1px solid ${C.hairlineSoft};
        border-bottom: 1px solid ${C.hairlineSoft};
        overflow: hidden;
        background: ${C.groundDeep};
        position: relative;
        z-index: 1;
      }
      .np-ticker__track {
        display: flex;
        gap: 40px;
        width: max-content;
        padding: 16px 0;
        animation: np-marquee 38s linear infinite;
      }
      .np-ticker__track.is-static {
        animation: none;
        flex-wrap: wrap;
        width: 100%;
        justify-content: center;
        padding: 16px 24px;
      }
      .np-ticker:hover .np-ticker__track:not(.is-static) { animation-play-state: paused; }
      .np-ticker__item {
        display: inline-flex;
        align-items: center;
        gap: 14px;
        font-family: ${SANS};
        font-size: 17px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: ${C.body};
        white-space: nowrap;
      }
      .np-ticker__mark { color: ${C.red}; font-weight: 700; }

      /* ---- sections ---- */
      .np-section {
        position: relative;
        z-index: 1;
        max-width: 1200px;
        margin: 0 auto;
        padding: clamp(64px, 9vw, 120px) 24px;
      }
      .np-section__title {
        margin: 16px 0 0;
        font-family: ${SANS};
        font-size: clamp(28px, 4vw, 50px);
        line-height: 1.04;
        letter-spacing: -0.035em;
        font-weight: 700;
        color: ${C.paper};
        max-width: 20ch;
        text-wrap: balance;
      }
      .np-mark { color: ${C.red}; }

      /* ---- workflow ---- */
      .np-steps { position: relative; margin-top: clamp(40px, 5vw, 64px); }
      .np-steps__rail {
        position: absolute;
        left: 50%;
        top: 0;
        bottom: 0;
        width: 2px;
        transform: translateX(-50%);
        background: ${C.hairlineSoft};
      }
      .np-steps__fill {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        background: ${C.red};
      }
      .np-steps__list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: clamp(20px, 3vw, 36px);
      }
      .np-step {
        background: ${C.panel};
        border: 1px solid ${C.hairline};
        padding: clamp(24px, 3vw, 36px);
        height: 100%;
      }
      .np-step__num {
        font-family: ${MONO};
        font-size: 13px;
        font-weight: 700;
        color: ${C.red};
        letter-spacing: 0.1em;
      }
      .np-step__icon { color: ${C.amber}; margin: 16px 0 0; }
      .np-step__title {
        margin: 14px 0 0;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: ${C.paper};
      }
      .np-step__body { margin: 10px 0 0; font-size: 15px; line-height: 1.6; color: ${C.body}; max-width: 42ch; }
      .np-step__detail {
        display: inline-block;
        margin: 18px 0 0;
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: ${C.muted};
      }

      /* ---- differentiator ---- */
      .np-diff__grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 0.95fr);
        gap: clamp(32px, 5vw, 72px);
        align-items: center;
      }
      .np-diff__body {
        margin: 22px 0 30px;
        font-size: 16px;
        line-height: 1.65;
        color: ${C.body};
        max-width: 56ch;
      }
      .np-gapcard {
        background: ${C.panel};
        border: 1px solid ${C.hairline};
      }
      .np-gapcard__head {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 20px;
        border-bottom: 1px solid ${C.hairlineSoft};
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: ${C.red};
      }
      .np-gaplist { list-style: none; margin: 0; padding: 0; }
      .np-gap {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px 20px;
        border-bottom: 1px dashed ${C.hairlineSoft};
      }
      .np-gap__label { font-size: 15px; font-weight: 600; color: ${C.paper}; }
      .np-gap__label::before { content: "✕ "; color: ${C.red}; font-weight: 700; }
      .np-gap__risk { font-size: 13.5px; color: ${C.muted}; }
      .np-gapcard__suggest {
        padding: 18px 20px;
        background: ${C.groundDeep};
        border-top: 1px solid ${C.hairline};
      }
      .np-gapcard__suggestlabel {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 10.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: ${C.green};
      }
      .np-gapcard__suggestlabel::before { content: "+"; font-weight: 800; }
      .np-gapcard__line {
        margin: 10px 0 0;
        font-family: ${MONO};
        font-size: 13.5px;
        line-height: 1.6;
        color: ${C.paper};
      }

      .np-assistant {
        margin-top: clamp(40px, 5vw, 64px);
        display: flex;
        gap: 20px;
        align-items: flex-start;
        padding: clamp(22px, 3vw, 32px);
        border: 1px solid ${C.hairline};
        background: linear-gradient(120deg, ${C.panel}, ${C.groundDeep});
      }
      .np-assistant__avatar {
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        background: ${C.red};
      }
      .np-assistant__title { margin: 0; font-size: 19px; font-weight: 700; color: ${C.paper}; letter-spacing: -0.02em; }
      .np-assistant__body { margin: 8px 0 0; font-size: 15px; line-height: 1.6; color: ${C.body}; max-width: 70ch; }

      /* ---- trust ---- */
      .np-trust__head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 32px;
        flex-wrap: wrap;
      }
      .np-trust__stat { text-align: right; }
      .np-trust__big {
        display: block;
        font-family: ${MONO};
        font-size: clamp(40px, 5vw, 64px);
        font-weight: 700;
        color: ${C.red};
        letter-spacing: -0.03em;
        font-variant-numeric: tabular-nums;
      }
      .np-trust__statlabel { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: ${C.muted}; }
      .np-trust__list {
        list-style: none;
        margin: clamp(40px, 5vw, 60px) 0 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: clamp(20px, 3vw, 32px);
      }
      .np-trustcard {
        border-top: 2px solid ${C.red};
        padding: 24px 0 0;
      }
      .np-trustcard__icon { color: ${C.amber}; display: block; }
      .np-trustcard__title { margin: 16px 0 0; font-size: 18px; font-weight: 700; color: ${C.paper}; letter-spacing: -0.015em; line-height: 1.25; }
      .np-trustcard__body { margin: 10px 0 0; font-size: 14.5px; line-height: 1.6; color: ${C.body}; max-width: 38ch; }

      /* ---- cta teaser ---- */
      .np-cta-teaser { padding-bottom: clamp(80px, 10vw, 140px); }
      .np-ctabox {
        border: 1px solid ${C.hairline};
        background: ${C.panel};
        padding: clamp(36px, 6vw, 72px);
        text-align: center;
      }
      .np-ctabox__title {
        margin: 16px 0 0;
        font-family: ${SANS};
        font-size: clamp(30px, 4.5vw, 56px);
        line-height: 1.04;
        letter-spacing: -0.035em;
        font-weight: 700;
        color: ${C.paper};
        text-wrap: balance;
      }
      .np-ctabox__body { margin: 20px auto 0; max-width: 54ch; font-size: 16px; line-height: 1.6; color: ${C.body}; }
      .np-ctabox__actions { margin: 32px 0 0; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

      /* ---- footer ---- */
      .np-footer { position: relative; z-index: 1; border-top: 1px solid ${C.hairline}; background: ${C.groundDeep}; }
      .np-footer__inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: clamp(40px, 5vw, 64px) 24px clamp(28px, 3vw, 40px);
        display: grid;
        grid-template-columns: minmax(0, 2fr) 1fr 1fr;
        gap: 32px;
      }
      .np-footer__tag { margin: 16px 0 0; max-width: 40ch; font-size: 14px; line-height: 1.6; color: ${C.muted}; }
      .np-footer__heading { display: block; font-size: 10.5px; letter-spacing: 0.18em; text-transform: uppercase; color: ${C.red}; margin-bottom: 14px; }
      .np-footer__col ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
      .np-footer__link { font-size: 14px; color: ${C.body}; text-decoration: none; transition: color 160ms ease; }
      .np-footer__link:hover { color: ${C.red}; }
      .np-footer__base {
        max-width: 1200px;
        margin: 0 auto;
        padding: 18px 24px;
        border-top: 1px solid ${C.hairlineSoft};
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: ${C.faint};
      }

      /* ---- keyframes ---- */
      @keyframes np-marquee {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
      }
      @keyframes np-blink {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.3; transform: scale(0.7); }
      }

      /* ---- responsive ---- */
      @media (max-width: 920px) {
        .np-hero { grid-template-columns: 1fr; }
        .np-hero__mock { order: -1; }
        .np-diff__grid { grid-template-columns: 1fr; }
        .np-trust__list { grid-template-columns: 1fr; }
        .np-steps__list { grid-template-columns: 1fr; }
        .np-steps__rail { left: 0; }
      }
      @media (max-width: 560px) {
        .np-footer__inner { grid-template-columns: 1fr 1fr; }
        .np-footer__brand { grid-column: 1 / -1; }
        .np-navlink--plain { display: none; }
        .np-hero__title { font-size: clamp(34px, 11vw, 48px); }
      }

      @media (prefers-reduced-motion: reduce) {
        .np-ticker__track { animation: none !important; }
        .np-scan__pulse { animation: none !important; }
        * { scroll-behavior: auto !important; }
        .mobile-managed { transition: none !important; }
        ::view-transition-new(root),
        ::view-transition-old(root) { animation: none !important; }
      }
    `}</style>
  );
}
