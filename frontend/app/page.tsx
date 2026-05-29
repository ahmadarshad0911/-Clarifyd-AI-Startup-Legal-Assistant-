"use client";

/**
 * Landing — Clarifyd v6 · "The Broadsheet"
 *
 * Brutalist editorial. Warm ivory paper, deep coffee ink, single arterial
 * red accent. Oversize display type, asymmetric broadsheet grid, sharp
 * edges (no border-radius), no gradients, no glass, no shadows.
 */

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, X, Quotes, CaretRight } from "@phosphor-icons/react";

import { useIsMobile } from "../lib/use-is-mobile";

const T = {
  paper:      "#f4ede1",
  paperDeep:  "#ebe2d0",
  ink:        "#0c0a08",
  body:       "#2b251f",
  muted:      "#6c6356",
  soft:       "#9b9181",
  hairline:   "rgba(12, 10, 8, 0.12)",
  rule:       "rgba(12, 10, 8, 0.22)",
  red:        "#b8260f",
  redHi:      "#8c1c08",
  redSoft:    "rgba(184, 38, 15, 0.10)",
};
const EOQ = [0.23, 1, 0.32, 1] as const;

export default function LandingPage() {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <div className="mobile-managed" style={{ background: T.paper, color: T.body, minHeight: "100dvh", fontFeatureSettings: "'tnum', 'ss01'" }}>
      <Masthead />
      <Hero reduceMotion={reduceMotion} />
      <LoopholeOfTheWeek reduceMotion={reduceMotion} />
      <Process reduceMotion={reduceMotion} />
      <RiskAtlas reduceMotion={reduceMotion} />
      <Plans reduceMotion={reduceMotion} />
      <Manifesto reduceMotion={reduceMotion} />
      <Footer />
      <style jsx global>{`
        .bsd-link { position: relative; color: ${T.ink}; text-decoration: none; transition: color 200ms ease; }
        .bsd-link::after {
          content: ""; position: absolute; left: 0; bottom: -2px;
          width: 100%; height: 1.5px; background: ${T.red};
          transform: scaleX(0); transform-origin: right center;
          transition: transform 260ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        @media (hover: hover) and (pointer: fine) {
          .bsd-link:hover { color: ${T.red}; }
          .bsd-link:hover::after { transform: scaleX(1); transform-origin: left center; }
        }
        .bsd-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 14px 22px; border: 1.5px solid ${T.ink};
          background: ${T.ink}; color: ${T.paper};
          font-family: Geist Mono, monospace;
          font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
          transition: background 200ms ease, color 200ms ease, border-color 200ms ease, transform 100ms ease;
          cursor: pointer; text-decoration: none;
        }
        .bsd-btn:active { transform: translateY(1px); }
        @media (hover: hover) and (pointer: fine) {
          .bsd-btn:hover { background: ${T.red}; border-color: ${T.red}; }
        }
        .bsd-btn--ghost { background: transparent; color: ${T.ink}; }
        @media (hover: hover) and (pointer: fine) {
          .bsd-btn--ghost:hover { background: ${T.ink}; color: ${T.paper}; }
        }
        .bsd-row { transition: background 200ms ease, padding-left 240ms cubic-bezier(0.23, 1, 0.32, 1); }
        @media (hover: hover) and (pointer: fine) {
          .bsd-row:hover { background: ${T.paperDeep}; padding-left: 18px; }
          .bsd-row:hover .bsd-row__caret { transform: translateX(4px); color: ${T.red}; }
        }
        .bsd-row__caret { transition: transform 240ms cubic-bezier(0.23, 1, 0.32, 1), color 200ms ease; }
        @media (prefers-reduced-motion: reduce) {
          .bsd-link::after, .bsd-row { transition: none !important; transform: none !important; padding-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}

function Masthead() {
  const isMobile = useIsMobile();
  return (
    <header
      style={{
        borderBottom: `3px double ${T.ink}`,
        padding: isMobile ? "14px 18px 12px" : "16px 32px 12px",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr auto 1fr",
        justifyItems: isMobile ? "center" : "stretch",
        alignItems: isMobile ? "center" : "end",
        gap: isMobile ? 10 : 16,
      }}
    >
      {isMobile ? null : (
        <span className="cf-mono" style={{ color: T.muted, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700 }}>
          Vol. I · No. 03
        </span>
      )}
      <Link href="/" className="cursor-pointer" style={{ textDecoration: "none" }}>
        <span style={{ display: "block", fontFamily: "Geist, sans-serif", fontWeight: 800, fontSize: isMobile ? 23 : 28, color: T.ink, letterSpacing: "-0.04em", lineHeight: 1, textAlign: "center" }}>
          The Clarifyd
        </span>
        <span style={{ display: "block", textAlign: "center", color: T.muted, fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", marginTop: 2 }}>
          Broadsheet
        </span>
      </Link>
      <nav style={{ display: "flex", justifyContent: isMobile ? "center" : "flex-end", alignItems: "center", gap: isMobile ? 16 : 22, flexWrap: "wrap" }}>
        <Link href="/faq" className="bsd-link cf-mono" style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>FAQ</Link>
        <Link href="/pricing" className="bsd-link cf-mono" style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>Plans</Link>
        <Link href="/contact" className="bsd-link cf-mono" style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>Contact</Link>
        <Link href="/login" className="bsd-btn" style={{ padding: "10px 18px" }}>
          Sign in <ArrowRight weight="bold" size={11} />
        </Link>
      </nav>
    </header>
  );
}

function Hero({ reduceMotion }: { reduceMotion: boolean }) {
  const isMobile = useIsMobile();
  return (
    <section style={{ padding: isMobile ? "56px 18px 64px" : "96px 48px 112px", borderBottom: `1.5px solid ${T.ink}` }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 8fr) minmax(0, 4fr)",
          gap: isMobile ? 32 : 80,
          alignItems: isMobile ? "start" : "end",
          maxWidth: 1200, margin: "0 auto",
        }}
      >
        <motion.h1
          initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EOQ }}
          style={{
            margin: 0,
            fontSize: isMobile ? "clamp(34px, 11vw, 52px)" : "clamp(44px, 6.4vw, 96px)",
            lineHeight: isMobile ? 1.02 : 0.95,
            letterSpacing: "-0.04em",
            color: T.ink,
            fontWeight: 700,
          }}
        >
          {isMobile ? (
            <>Read your next contract like a <span style={{ color: T.red, fontStyle: "italic", fontWeight: 600 }}>senior counsel.</span></>
          ) : (
            <>
              Read your next<br />
              contract like a<br />
              <span style={{ color: T.red, fontStyle: "italic", fontWeight: 600 }}>senior counsel.</span>
            </>
          )}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: EOQ, delay: 0.12 }}
          style={{ display: "flex", flexDirection: "column", gap: 22 }}
        >
          <span className="cf-mono" style={{ color: T.red, fontSize: 12, letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: 800 }}>
            ★ Volume I · The founder edition
          </span>
          <p style={{ margin: 0, fontSize: isMobile ? 16 : 19, color: T.body, lineHeight: 1.6, maxWidth: 380, fontWeight: 500 }}>
            Drop a SAFE, term sheet, or vendor MSA. Clarifyd AI flags the loopholes, rewrites the risky clauses, and hands you a draft your counterparty can sign.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
            <Link href="/login" className="bsd-btn cursor-pointer" style={isMobile ? { flex: 1, justifyContent: "center", minHeight: 48 } : undefined}>
              Start free <ArrowRight weight="bold" size={11} />
            </Link>
            <Link href="/pricing" className="bsd-btn bsd-btn--ghost cursor-pointer" style={isMobile ? { flex: 1, justifyContent: "center", minHeight: 48 } : undefined}>See plans</Link>
          </div>
        </motion.div>
      </div>

      <div
        style={{
          maxWidth: 1200, margin: "72px auto 0",
          paddingTop: 20, borderTop: `1px solid ${T.hairline}`,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
          fontFamily: "Geist Mono, monospace",
          fontSize: 10, color: T.muted, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
        }}
      >
        <span>Powered by Clarifyd AI</span>
        <span style={{ display: "inline-flex", gap: 24, flexWrap: "wrap" }}>
          <span>8s scan</span>
          <span>$0 first 3 contracts</span>
          <span>0 hallucinations</span>
        </span>
      </div>
    </section>
  );
}

function RuleHeavy() {
  return (
    <div style={{ background: T.ink, color: T.paper, padding: "10px 32px", borderBottom: `1.5px solid ${T.ink}` }}>
      <div
        style={{
          maxWidth: 1280, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 28, flexWrap: "wrap",
          fontFamily: "Geist Mono, monospace", fontSize: 10.5, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700,
        }}
      >
        <span style={{ color: T.red }}>★</span>
        <span>Loophole detection</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Founder-friendly rewrites</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Citation-grounded findings</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Drop-in DOCX exports</span>
        <span style={{ color: T.red }}>★</span>
      </div>
    </div>
  );
}

function LoopholeOfTheWeek({ reduceMotion }: { reduceMotion: boolean }) {
  const isMobile = useIsMobile();
  return (
    <section style={{ padding: isMobile ? "64px 18px" : "112px 48px", borderBottom: `1.5px solid ${T.ink}` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <SectionHeader kicker="Featured loophole" title="From a real seed-round SAFE." rule={`No. ${new Date().getDate().toString().padStart(2, "0")}`} />
        <div
          style={{
            marginTop: isMobile ? 36 : 56,
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 5fr) minmax(0, 7fr)",
            gap: isMobile ? 36 : 72,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, ease: EOQ }}
          >
            <span className="cf-mono" style={{ color: T.red, fontSize: 10.5, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
              Severity · Critical
            </span>
            <h3 style={{ margin: "10px 0 14px", fontSize: isMobile ? 23 : 30, lineHeight: 1.15, fontWeight: 600, color: T.ink, letterSpacing: "-0.022em" }}>
              The unlimited liability cap, hidden in 16 words.
            </h3>
            <p style={{ margin: "0 0 18px", fontSize: 15, color: T.body, lineHeight: 1.65 }}>
              The original clause caps the founder personally at any amount the investor declares. Clarifyd AI rewrites it so cap follows the round, not the founder, and only triggers on wilful misrepresentation.
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                "Personal exposure removed",
                "Cap tied to the round, not the founder",
                "Trigger limited to wilful misrepresentation",
              ].map((b) => (
                <li key={b} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: T.body }}>
                  <Check weight="bold" size={13} color={T.red} aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, ease: EOQ, delay: 0.08 }}
            style={{ border: `1.5px solid ${T.ink}` }}
          >
            <div
              style={{
                borderBottom: `1px solid ${T.hairline}`,
                padding: isMobile ? "12px 14px" : "14px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: T.muted,
              }}
            >
              <span>Original clause</span>
              <span style={{ color: T.red, whiteSpace: "nowrap" }}><X weight="bold" size={11} style={{ verticalAlign: "middle" }} /> Flagged</span>
            </div>
            <pre
              style={{
                margin: 0, padding: isMobile ? 14 : 18, background: "transparent",
                fontFamily: "Geist Mono, monospace", fontSize: isMobile ? 12.5 : 13.5,
                color: T.body, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word",
                borderBottom: `1px dashed ${T.rule}`,
              }}
            >
              <s style={{ textDecorationColor: T.red, textDecorationThickness: 2 }}>
                The Founder shall indemnify the Investor for any and all losses incurred, of any amount whatsoever, in connection with this agreement.
              </s>
            </pre>
            <div
              style={{
                borderTop: `2px solid ${T.red}`,
                padding: isMobile ? "12px 14px" : "14px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: T.red,
              }}
            >
              <span>Clarifyd AI rewrite</span>
              <span style={{ whiteSpace: "nowrap" }}><Check weight="bold" size={11} style={{ verticalAlign: "middle" }} /> Founder-friendly</span>
            </div>
            <pre
              style={{
                margin: 0, padding: isMobile ? 14 : 18, background: T.paperDeep,
                fontFamily: "Geist Mono, monospace", fontSize: isMobile ? 12.5 : 13.5,
                color: T.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", fontWeight: 500,
              }}
            >
              The Company shall indemnify the Investor for direct losses up to the amount of the Investor&rsquo;s actual contribution, and only in cases of wilful misrepresentation by the Company.
            </pre>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

type Step = {
  n: string;
  title: string;
  body: string;
  bullets: string[];
  proof: { label: string; lines: string[] };
  cta: { label: string; href: string };
};

const STEPS: Step[] = [
  {
    n: "01",
    title: "Drop the contract",
    body: "PDF, DOCX, or paste raw text. SAFEs, MSAs, NDAs, offer letters, term sheets up to 10 MB.",
    bullets: [
      "Drag-and-drop or browse — no upload queue.",
      "Auto-classified as SAFE, MSA, NDA, lease, or offer letter.",
      "Re-upload same file → free, served from cache.",
    ],
    proof: { label: "Accepted", lines: [".pdf  .docx  .txt", "≤ 10 MB", "≤ 200 pages"] },
    cta: { label: "Upload your first", href: "/login" },
  },
  {
    n: "02",
    title: "Clarifyd AI reads it",
    body: "Reasoning grounded against the verbatim clause text. No invented findings. Citations on every flag.",
    bullets: [
      "Verbatim grounding — every flag carries clause text.",
      "Ungrounded suggestions are silently dropped.",
      "8s cached, < 60s cold.",
    ],
    proof: { label: "Sample finding", lines: [
      "› liability_cap  critical",
      "  cites: §6.3 lines 142-156",
      "  conf:  0.94",
    ]},
    cta: { label: "See a real scan", href: "/findings" },
  },
  {
    n: "03",
    title: "You review",
    body: "Severity-sorted loopholes. Founder-friendly rewrites side-by-side with originals. Accept, reject, edit.",
    bullets: [
      "Critical → Low ranking, no jargon.",
      "Side-by-side diff, original + rewrite.",
      "Inline edits, no re-upload needed.",
    ],
    proof: { label: "Actions", lines: [
      "[ ✓ ] accept",
      "[ ✕ ] reject",
      "[ … ] edit inline",
    ]},
    cta: { label: "Open Findings", href: "/findings" },
  },
  {
    n: "04",
    title: "Hand to counterparty",
    body: "Exported draft with a clear change log proving exactly what was rewritten and why.",
    bullets: [
      "PDF or DOCX export, no watermarks on Founder+.",
      "Side-by-side diff against the original.",
      "Counsel-ready collaborator doc.",
    ],
    proof: { label: "Audit chain", lines: [
      "0x4f2a…b91c  open",
      "0x88d3…0e22  accept §6.3",
      "0xa1cc…774b  export.v3",
    ]},
    cta: { label: "Read the audit doc", href: "/exports" },
  },
];

function Process({ reduceMotion }: { reduceMotion: boolean }) {
  const isMobile = useIsMobile();
  const [openN, setOpenN] = useState<string>("01");
  return (
    <section style={{ padding: isMobile ? "64px 18px" : "112px 48px", borderBottom: `1.5px solid ${T.ink}` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <SectionHeader kicker="The process" title="Eight seconds, four moves." rule="Method" />
        <ol style={{ margin: "48px 0 0", padding: 0, listStyle: "none", borderTop: `2px solid ${T.ink}` }}>
          {STEPS.map((s, i) => {
            const open = openN === s.n;
            return (
              <motion.li
                key={s.n}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, ease: EOQ, delay: i * 0.06 }}
                style={{ borderBottom: `1px solid ${T.hairline}`, background: open ? T.paperDeep : "transparent", transition: "background 240ms cubic-bezier(0.23, 1, 0.32, 1)" }}
              >
                <button
                  type="button"
                  onClick={() => setOpenN(open ? "" : s.n)}
                  aria-expanded={open}
                  className={`bsd-row cursor-pointer${open ? " is-active" : ""}`}
                  style={{
                    width: "100%", textAlign: "left",
                    display: "grid",
                    gridTemplateColumns: isMobile ? "44px 1fr 20px" : "72px 1fr minmax(0, 2.4fr) 24px",
                    alignItems: "center", gap: isMobile ? 14 : 28,
                    padding: isMobile ? "22px 4px" : "32px 24px",
                    background: "transparent", border: "none",
                  }}
                >
                  <span style={{ fontFamily: "Geist Mono, monospace", fontWeight: 800, fontSize: isMobile ? 22 : 30, color: T.red, letterSpacing: "-0.02em", textAlign: "right" }}>
                    {s.n}
                  </span>
                  <span style={{ fontSize: isMobile ? 17 : 22, fontWeight: 600, color: T.ink, letterSpacing: "-0.015em" }}>
                    {s.title}
                  </span>
                  {isMobile ? null : (
                  <span style={{ fontSize: 14.5, color: T.body, lineHeight: 1.55 }}>
                    {s.body}
                  </span>
                  )}
                  <CaretRight
                    className="bsd-row__caret"
                    weight="bold"
                    size={16}
                    color={open ? T.red : T.soft}
                    style={{
                      transform: open ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 240ms cubic-bezier(0.23, 1, 0.32, 1), color 200ms ease",
                    }}
                    aria-hidden
                  />
                </button>
                <div
                  style={{
                    display: "grid",
                    gridTemplateRows: open ? "1fr" : "0fr",
                    transition: "grid-template-rows 320ms cubic-bezier(0.23, 1, 0.32, 1), opacity 240ms ease-out",
                    opacity: open ? 1 : 0,
                  }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "72px minmax(0, 1.4fr) minmax(0, 1fr)",
                        gap: isMobile ? 20 : 28,
                        padding: isMobile ? "0 4px 28px 4px" : "0 24px 40px 24px",
                      }}
                    >
                      {isMobile ? null : <span aria-hidden />}
                      <div>
                        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                          {s.bullets.map((b, j) => (
                            <li
                              key={j}
                              style={{
                                display: "flex", alignItems: "flex-start", gap: 12,
                                fontSize: 15, color: T.body, lineHeight: 1.55,
                                transform: open ? "translateX(0)" : "translateX(-6px)",
                                opacity: open ? 1 : 0,
                                transition: `transform 320ms cubic-bezier(0.23, 1, 0.32, 1) ${60 + j * 50}ms, opacity 280ms ease-out ${60 + j * 50}ms`,
                              }}
                            >
                              <Check weight="bold" size={13} color={T.red} style={{ marginTop: 5, flexShrink: 0 }} aria-hidden />
                              {b}
                            </li>
                          ))}
                        </ul>
                        <Link
                          href={s.cta.href}
                          className="bsd-btn cursor-pointer"
                          style={{
                            marginTop: 22,
                            transform: open ? "translateY(0)" : "translateY(6px)",
                            opacity: open ? 1 : 0,
                            transition: "transform 320ms cubic-bezier(0.23, 1, 0.32, 1) 260ms, opacity 280ms ease-out 260ms",
                          }}
                        >
                          {s.cta.label} <ArrowRight weight="bold" size={11} />
                        </Link>
                      </div>
                      <div
                        style={{
                          background: T.paper,
                          border: `1.5px solid ${T.ink}`,
                          padding: "16px 18px",
                          fontFamily: "Geist Mono, monospace",
                          fontSize: 12.5,
                          color: T.body,
                          lineHeight: 1.7,
                          alignSelf: "start",
                          transform: open ? "translateY(0) scale(1)" : "translateY(8px) scale(0.985)",
                          opacity: open ? 1 : 0,
                          transition: "transform 360ms cubic-bezier(0.23, 1, 0.32, 1) 120ms, opacity 320ms ease-out 120ms",
                        }}
                      >
                        <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800, color: T.red, marginBottom: 10 }}>
                          {s.proof.label}
                        </div>
                        {s.proof.lines.map((ln, j) => (
                          <div key={j} style={{ whiteSpace: "pre" }}>{ln}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

const ATLAS: { type: string; freq: number; sev: "Critical" | "High" | "Medium" | "Low" }[] = [
  { type: "Liability cap",               freq: 84, sev: "Critical" },
  { type: "IP assignment",               freq: 78, sev: "Critical" },
  { type: "Auto-renewal",                freq: 72, sev: "High" },
  { type: "Non-compete scope",           freq: 65, sev: "High" },
  { type: "Termination for convenience", freq: 61, sev: "High" },
  { type: "Pro-rata rights",             freq: 44, sev: "Medium" },
  { type: "Confidentiality term",        freq: 31, sev: "Low" },
];
const SEV_COLORS: Record<string, string> = {
  Critical: T.red,
  High: "#d97706",
  Medium: "#a98b2a",
  Low: T.muted,
};
function RiskAtlas({ reduceMotion }: { reduceMotion: boolean }) {
  const isMobile = useIsMobile();
  return (
    <section style={{ padding: isMobile ? "64px 18px" : "112px 48px", borderBottom: `1.5px solid ${T.ink}` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <SectionHeader kicker="Risk atlas" title="What we find, by how often." rule="Index" />
        <p style={{ margin: "22px 0 0", maxWidth: 560, fontSize: 15, color: T.body, lineHeight: 1.65 }}>
          Sampled across <span style={{ fontFamily: "Geist Mono, monospace", color: T.ink, fontWeight: 700 }}>1,240</span> founder-uploaded pre-seed contracts last quarter. Severity follows Clarifyd&rsquo;s rubric, not the contract&rsquo;s tone.
        </p>
        <div style={{ marginTop: isMobile ? 32 : 48, borderTop: `2px solid ${T.ink}`, borderBottom: `2px solid ${T.ink}` }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "auto 1fr auto" : "80px minmax(0, 3fr) 1fr 1fr",
              gap: isMobile ? 14 : 24,
              padding: "12px 0",
              borderBottom: `1px solid ${T.ink}`,
              fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: T.muted,
            }}
          >
            <span>No.</span>
            <span>Clause type</span>
            {isMobile ? null : <span>Frequency</span>}
            <span style={{ textAlign: "right" }}>Severity</span>
          </div>
          {ATLAS.map((row, i) => (
            <motion.div
              key={row.type}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.3, ease: EOQ, delay: i * 0.025 }}
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "auto 1fr auto" : "80px minmax(0, 3fr) 1fr 1fr",
                gap: isMobile ? "8px 14px" : 28,
                padding: isMobile ? "18px 0" : "22px 0",
                borderBottom: i < ATLAS.length - 1 ? `1px dotted ${T.hairline}` : "none",
                alignItems: "center",
              }}
            >
              <span className="cf-mono" style={{ color: T.soft, fontSize: 12, fontWeight: 700, letterSpacing: "0.10em" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ color: T.ink, fontSize: 15, fontWeight: 500, gridColumn: isMobile ? 2 : "auto", gridRow: isMobile ? 1 : "auto" }}>{row.type}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, gridColumn: isMobile ? "1 / -1" : "auto", gridRow: isMobile ? 2 : "auto", width: isMobile ? "100%" : "auto" }}>
                <div style={{ flex: 1, height: 6, background: T.hairline, position: "relative" }}>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: row.freq / 100 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.7, ease: EOQ, delay: 0.1 + i * 0.025 }}
                    style={{ position: "absolute", inset: 0, background: T.ink, transformOrigin: "left" }}
                  />
                </div>
                <span className="cf-mono" style={{ color: T.muted, fontSize: 11, fontWeight: 700, minWidth: 30, textAlign: "right" }}>
                  {row.freq}%
                </span>
              </div>
              <span
                className="cf-mono"
                style={{
                  justifySelf: "end",
                  gridColumn: isMobile ? 3 : "auto",
                  gridRow: isMobile ? 1 : "auto",
                  color: SEV_COLORS[row.sev],
                  fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800,
                }}
              >
                {row.sev}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PLANS = [
  { name: "Reader",  price: "$0",     cadence: "forever",       bullets: ["3 contracts / month", "Founder-friendly rewrites", "DOCX export with redlines", "Community support"], cta: "Start free",   featured: false },
  { name: "Founder", price: "$29",    cadence: "/ month",       bullets: ["Unlimited contracts", "Collaborator export", "Negotiation tracker", "Same-day email support"],     cta: "Get Founder",  featured: true },
  { name: "Counsel", price: "Custom", cadence: "talk to us",    bullets: ["Everything in Founder", "Custom jurisdiction templates", "SAML SSO + SOC-2 export", "Dedicated partner"], cta: "Talk to sales", featured: false },
];
function Plans({ reduceMotion }: { reduceMotion: boolean }) {
  const isMobile = useIsMobile();
  return (
    <section style={{ padding: isMobile ? "64px 18px" : "112px 48px", borderBottom: `1.5px solid ${T.ink}` }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <SectionHeader kicker="Subscriptions" title="Free until your seed round." rule="Rates" />
        <div
          style={{
            marginTop: isMobile ? 32 : 48,
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
            borderTop: `2px solid ${T.ink}`, borderBottom: `2px solid ${T.ink}`,
          }}
        >
          {PLANS.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, ease: EOQ, delay: i * 0.08 }}
              style={{
                padding: isMobile ? 28 : 40,
                background: p.featured ? T.ink : "transparent",
                color: p.featured ? T.paper : T.ink,
                borderRight: !isMobile && i < PLANS.length - 1 ? `1px solid ${T.hairline}` : "none",
                borderBottom: isMobile && i < PLANS.length - 1 ? `1px solid ${T.hairline}` : "none",
                position: "relative",
                display: "flex", flexDirection: "column", gap: 22,
                minHeight: isMobile ? "auto" : 440,
              }}
            >
              {p.featured ? (
                <span
                  className="cf-mono"
                  style={{
                    position: "absolute", top: -10, left: 28,
                    background: T.red, color: T.paper,
                    padding: "3px 10px", fontSize: 9.5, letterSpacing: "0.20em",
                    textTransform: "uppercase", fontWeight: 800,
                  }}
                >
                  Most chosen
                </span>
              ) : null}
              <span className="cf-mono" style={{ color: p.featured ? T.red : T.muted, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                {p.name}
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: p.featured ? T.paper : T.ink }}>
                  {p.price}
                </span>
                <span style={{ fontSize: 13, color: p.featured ? "#bbb" : T.muted }}>{p.cadence}</span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {p.bullets.map((b) => (
                  <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: p.featured ? "#ddd" : T.body, lineHeight: 1.5 }}>
                    <Check weight="bold" size={12} color={p.featured ? T.red : T.ink} style={{ marginTop: 4, flexShrink: 0 }} aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                href={p.name === "Counsel" ? "/contact" : "/login"}
                className="bsd-btn cursor-pointer"
                style={{
                  background: p.featured ? T.red : T.ink,
                  borderColor: p.featured ? T.red : T.ink,
                  color: T.paper,
                }}
              >
                {p.cta} <ArrowRight weight="bold" size={11} />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Manifesto({ reduceMotion }: { reduceMotion: boolean }) {
  const isMobile = useIsMobile();
  return (
    <section style={{ padding: isMobile ? "80px 18px" : "144px 48px", borderBottom: `1.5px solid ${T.ink}` }}>
      <div style={{ maxWidth: 920, margin: "0 auto", textAlign: "center" }}>
        <Quotes weight="duotone" size={36} color={T.red} aria-hidden />
        <motion.blockquote
          initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: EOQ }}
          style={{
            margin: "20px 0 0",
            fontSize: "clamp(28px, 4vw, 44px)",
            lineHeight: 1.2,
            color: T.ink,
            fontWeight: 500,
            letterSpacing: "-0.022em",
            fontStyle: "italic",
          }}
        >
          We don&rsquo;t replace your lawyer. We make sure you arrive at the meeting already knowing what&rsquo;s in the document.
        </motion.blockquote>
        <p className="cf-mono" style={{ margin: "26px 0 0", color: T.muted, fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700 }}>
          The Clarifyd Editors · Volume I
        </p>
        <div style={{ marginTop: 36, display: "inline-flex", gap: 12 }}>
          <Link href="/login" className="bsd-btn cursor-pointer">
            Start free <ArrowRight weight="bold" size={11} />
          </Link>
          <Link href="/faq" className="bsd-btn bsd-btn--ghost cursor-pointer">Read the FAQ</Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const isMobile = useIsMobile();
  return (
    <footer style={{ padding: isMobile ? "36px 18px 28px" : "48px 32px 36px", background: T.ink, color: T.paper }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "minmax(0, 2fr) repeat(3, minmax(0, 1fr))", gap: isMobile ? 24 : 36 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em" }}>The Clarifyd Broadsheet</div>
          <p style={{ margin: "12px 0 0", color: "#bbb", fontSize: 13, maxWidth: 380, lineHeight: 1.6 }}>
            A weekly editorial on what your contracts are actually saying. Founder readers only.
          </p>
        </div>
        <FootCol heading="Product" items={[["Plans", "/pricing"], ["FAQ", "/faq"], ["Sign in", "/login"]]} />
        <FootCol heading="Company" items={[["Contact", "/contact"], ["Privacy", "/terms?tab=privacy"], ["Terms", "/terms"]]} />
        <FootCol heading="Resources" items={[["Status", "/status"], ["Changelog", "/changelog"], ["Security", "/security"]]} />
      </div>
      <div style={{ maxWidth: 1280, margin: "28px auto 0", paddingTop: 18, borderTop: "1px solid rgba(244, 237, 225, 0.18)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontFamily: "Geist Mono, monospace", fontSize: 10, color: "#9b9181", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600 }}>
        <span>© 2026 Clarifyd · v0.6.0</span>
        <span>Built for pre-seed founders</span>
      </div>
    </footer>
  );
}

function FootCol({ heading, items }: { heading: string; items: Array<[string, string]> }) {
  return (
    <div>
      <div className="cf-mono" style={{ color: T.red, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800, marginBottom: 14 }}>
        {heading}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(([label, href]) => (
          <li key={label}>
            <Link
              href={href}
              className="cursor-pointer"
              style={{ color: T.paper, fontSize: 13.5, textDecoration: "none", transition: "color 200ms ease" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.red)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.paper)}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionHeader({ kicker, title, rule }: { kicker: string; title: string; rule: string }) {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        display: "flex",
        alignItems: isMobile ? "flex-start" : "flex-end",
        justifyContent: "space-between",
        gap: isMobile ? 12 : 24,
        borderBottom: `1px solid ${T.hairline}`,
        paddingBottom: isMobile ? 12 : 14,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span className="cf-mono" style={{ color: T.red, fontSize: isMobile ? 10 : 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
          {kicker}
        </span>
        <h2 style={{ margin: "8px 0 0", fontSize: isMobile ? "clamp(26px, 7.5vw, 34px)" : "clamp(32px, 4vw, 56px)", fontWeight: 700, color: T.ink, letterSpacing: "-0.03em", lineHeight: 1.04 }}>
          {title}
        </h2>
      </div>
      <span
        className="cf-mono"
        style={{
          color: T.muted, fontSize: 10.5, letterSpacing: "0.22em",
          textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap",
          flexShrink: 0, paddingTop: isMobile ? 2 : 0,
        }}
      >
        ◆{isMobile ? "" : ` ${rule}`}
      </span>
    </div>
  );
}
