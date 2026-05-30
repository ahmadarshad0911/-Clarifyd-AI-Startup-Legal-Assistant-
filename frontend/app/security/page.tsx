"use client";

/**
 * /security — Broadsheet · v6
 *
 * "Security desk" plate. Principles → controls → vulnerability disclosure.
 * Editorial doc, no marketing fluff.
 */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShieldCheck, Lock, Hash, EnvelopeSimple, KeyReturn, Eye, FileLock, Stack,
  type Icon,
} from "@phosphor-icons/react";

import { PublicShell } from "../../components/public-shell";
import { useIsMobile } from "../../lib/use-is-mobile";

const EOQ = [0.23, 1, 0.32, 1] as const;

type Article = {
  n: string;
  Icon: Icon;
  title: string;
  body: string[];
  bullets?: string[];
};

const ARTICLES: Article[] = [
  {
    n: "01", Icon: Lock,
    title: "Your contracts are private",
    body: ["Every contract you upload is scoped to your account. No other Clarifyd user — or staff member — can read your documents."],
    bullets: [
      "Industry-standard encryption protects data in transit and at rest.",
      "Deleted analyses are removed from the dashboard immediately.",
      "Each browser session is scoped to the signed-in user.",
    ],
  },
  {
    n: "02", Icon: KeyReturn,
    title: "Sign in your way",
    body: ["Use email and password, Google, or Facebook to access your founder account. You stay in control of which credentials are connected."],
    bullets: [
      "Disconnect a social login at any time from settings.",
      "Delete your account and we remove every contract you own.",
      "Forgotten password? One-tap email reset.",
    ],
  },
  {
    n: "03", Icon: Hash,
    title: "Built for repeat reviews",
    body: ["Re-upload the same contract and we serve the previous analysis instantly. Compare versions side-by-side as you negotiate."],
    bullets: [
      "Export findings as JSON or PDF for any analysis.",
      "Every accepted clause becomes a one-click redline.",
    ],
  },
  {
    n: "04", Icon: Eye,
    title: "AI use and zero training",
    body: ["Contracts are sent to Clarifyd AI for reasoning, then cached by SHA-256 so a re-upload of the same contract is byte-identical and free. We do not train, fine-tune, or improve models with customer contract content. Ever."],
  },
  {
    n: "05", Icon: FileLock,
    title: "Local storage scoping",
    body: ["The frontend scopes every browser localStorage key by signed-in user via `clarifyd.user-key`. On login or logout we wipe 11 known legacy unscoped keys so a fresh account never sees prior-user data."],
  },
  {
    n: "06", Icon: Stack,
    title: "Operations and access",
    body: ["Production access is two-factor only. Staff cannot read customer contract content unless the customer opens a support ticket and grants read access for a bounded window."],
    bullets: [
      "Quarterly access audit. Off-boarded staff lose all credentials within one business hour.",
      "Backups are encrypted and tested for restore monthly.",
    ],
  },
];

export default function SecurityPage() {
  const reduce = useReducedMotion() ?? false;
  const isMobile = useIsMobile();
  return (
    <PublicShell>
      <section style={{ padding: isMobile ? "48px 18px 24px" : "72px 32px 32px", borderBottom: "1.5px solid var(--bsd-ink)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EOQ }}
            style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}
          >
            <div>
              <span className="bsd-kicker" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck weight="duotone" size={14} aria-hidden />
                Security desk
              </span>
              <h1 style={{ margin: "12px 0 0", fontSize: "clamp(36px, 5.5vw, 72px)", fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.03em", lineHeight: 1.02 }}>
                What we do so you can <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>upload a contract.</span>
              </h1>
              <p style={{ margin: "12px 0 0", color: "var(--bsd-body)", fontSize: 15.5, lineHeight: 1.6, maxWidth: 620 }}>
                You trust us with documents that, in the wrong inbox, would change your cap table. We treat them like that.
              </p>
            </div>
            <a
              href="mailto:security@clarifyd.com"
              className="bsd-btn cursor-pointer"
            >
              <EnvelopeSimple weight="duotone" size={12} />
              security@clarifyd.com
            </a>
          </motion.div>
        </div>
      </section>

      <article style={{ padding: isMobile ? "32px 18px" : "48px 32px", maxWidth: 1100, margin: "0 auto" }}>
        {ARTICLES.map((a, i) => (
          <motion.section
            key={a.n}
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.4, ease: EOQ, delay: i * 0.04 }}
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 4fr) minmax(0, 8fr)",
              gap: isMobile ? 18 : 48,
              padding: isMobile ? "26px 0" : "36px 0",
              borderTop: i === 0 ? "2px solid var(--bsd-ink)" : "1px dotted var(--bsd-hairline)",
              borderBottom: i === ARTICLES.length - 1 ? "2px solid var(--bsd-ink)" : "none",
              alignItems: "start",
            }}
          >
            <header style={isMobile ? undefined : { position: "sticky", top: 100 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  {a.n}
                </span>
                <a.Icon weight="duotone" size={22} color="var(--bsd-red)" aria-hidden />
              </div>
              <h2 style={{ margin: "12px 0 0", fontSize: 24, fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                {a.title}
              </h2>
            </header>
            <div>
              {a.body.map((p, j) => (
                <p key={j} style={{ margin: j === 0 ? 0 : "12px 0 0", fontSize: 15.5, color: "var(--bsd-body)", lineHeight: 1.7 }}>
                  {p}
                </p>
              ))}
              {a.bullets ? (
                <ul style={{ margin: "18px 0 0", padding: 0, listStyle: "none" }}>
                  {a.bullets.map((b, k) => (
                    <li
                      key={k}
                      style={{
                        display: "grid", gridTemplateColumns: "28px 1fr", gap: 10, alignItems: "baseline",
                        padding: "10px 0",
                        borderBottom: k < (a.bullets?.length ?? 0) - 1 ? "1px dotted var(--bsd-hairline)" : "none",
                      }}
                    >
                      <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 10.5, letterSpacing: "0.18em", fontWeight: 800 }}>
                        {String.fromCharCode(0x2014)}
                      </span>
                      <span style={{ fontSize: 14.5, color: "var(--bsd-ink)", lineHeight: 1.6 }}>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </motion.section>
        ))}
      </article>

      {/* Disclosure plate */}
      <section style={{ padding: isMobile ? "0 18px 64px" : "0 32px 96px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div
            style={{
              background: "var(--bsd-ink)", color: "var(--bsd-paper)",
              padding: isMobile ? "28px 20px" : "36px 32px",
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) auto",
              gap: isMobile ? 22 : 28,
              alignItems: isMobile ? "start" : "center",
            }}
          >
            <div>
              <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                Responsible disclosure
              </span>
              <h2 style={{ margin: "10px 0 0", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                Found a vulnerability?
              </h2>
              <p style={{ margin: "10px 0 0", color: "#cfc8b8", fontSize: 15, lineHeight: 1.6, maxWidth: 560 }}>
                Email <span className="cf-mono" style={{ color: "var(--bsd-paper)", fontWeight: 800 }}>security@clarifyd.com</span> with a reproduction. We acknowledge within 48 hours. Eligible findings receive credit on this page and a token of thanks.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: isMobile ? "flex-start" : "flex-end" }}>
              <a
                href="mailto:security@clarifyd.com"
                className="cursor-pointer cf-mono"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 22px",
                  background: "var(--bsd-red)", color: "var(--bsd-paper)",
                  border: "1.5px solid var(--bsd-red)",
                  fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                <EnvelopeSimple weight="duotone" size={12} /> Email security
              </a>
              <Link
                href="/terms?tab=privacy"
                className="cursor-pointer cf-mono"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "10px 20px",
                  background: "transparent", color: "var(--bsd-paper)",
                  border: "1.5px solid var(--bsd-paper)",
                  fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                <ShieldCheck weight="duotone" size={11} /> Privacy policy
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
