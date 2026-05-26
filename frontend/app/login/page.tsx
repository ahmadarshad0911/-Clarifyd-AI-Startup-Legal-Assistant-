"use client";

/**
 * /login — Broadsheet · v7
 *
 * Clerk-hosted sign-in. We embed Clerk's <SignIn /> on the right half of
 * an editorial split, keeping the Broadsheet masthead, kicker, and value
 * props on the left. Clerk handles email, password, OAuth (Google +
 * Facebook), passwordless, and verification — no custom forms needed.
 */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { SignIn, useUser } from "@clerk/nextjs";
import { ArrowUpRight, Check, ShieldCheck } from "@phosphor-icons/react";

const EOQ = [0.23, 1, 0.32, 1] as const;

export default function LoginPage() {
  const reduce = useReducedMotion() ?? false;
  const { isLoaded, isSignedIn } = useUser();

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bsd-paper)", color: "var(--bsd-body)" }}>
      <header
        style={{
          borderBottom: "3px double var(--bsd-ink)",
          padding: "16px 32px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Link
          href="/"
          className="cursor-pointer"
          style={{ display: "inline-flex", alignItems: "baseline", gap: 12, textDecoration: "none" }}
        >
          <span
            style={{
              fontFamily: "Geist, sans-serif",
              fontWeight: 800,
              fontSize: 22,
              color: "var(--bsd-ink)",
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            Clarifyd
          </span>
          <span
            className="cf-mono"
            style={{
              color: "var(--bsd-muted)",
              fontSize: 9.5,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Sign in
          </span>
        </Link>
        <Link
          href="/contact"
          className="cf-mono cursor-pointer"
          style={{
            color: "var(--bsd-muted)",
            fontSize: 10.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 700,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          Need help <ArrowUpRight weight="bold" size={11} />
        </Link>
      </header>

      <main
        style={{
          padding: "56px 32px 80px",
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)",
          gap: 56,
        }}
        className="grid-cols-1 lg:grid-cols-[5fr_7fr]"
      >
        <motion.aside
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EOQ }}
          style={{ display: "flex", flexDirection: "column", gap: 24 }}
        >
          <span
            className="bsd-kicker"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <ShieldCheck weight="duotone" size={14} aria-hidden />
            Welcome back
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(40px, 5.5vw, 72px)",
              lineHeight: 0.98,
              letterSpacing: "-0.035em",
              color: "var(--bsd-ink)",
              fontWeight: 700,
            }}
          >
            Sign in to your{" "}
            <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>
              workspace.
            </span>
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              color: "var(--bsd-body)",
              lineHeight: 1.6,
              maxWidth: 440,
            }}
          >
            Resume your contract reviews. Findings and drafts are exactly where you left them.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              paddingTop: 14,
              borderTop: "1px solid var(--bsd-hairline)",
            }}
          >
            <Bullet label="Email & password, Google, or Facebook" />
            <Bullet label="Clause-level risk scoring in seconds" />
            <Bullet label="Founder-favorable rewrites, drop-in ready" />
          </div>
        </motion.aside>

        <motion.section
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EOQ, delay: 0.06 }}
          style={{ display: "flex", justifyContent: "center" }}
        >
          {!isLoaded ? (
            <div
              className="cf-mono"
              style={{
                color: "var(--bsd-muted)",
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 700,
                padding: 40,
              }}
            >
              Loading…
            </div>
          ) : (
            <SignIn
              path="/login"
              routing="path"
              signUpUrl="/login"
              forceRedirectUrl="/dashboard"
              signUpForceRedirectUrl="/onboarding/profile"
              appearance={{
                elements: {
                  rootBox: { width: "100%", maxWidth: 460 },
                  card: {
                    background: "var(--bsd-paper)",
                    border: "1.5px solid var(--bsd-ink)",
                    boxShadow: "none",
                    borderRadius: 2,
                  },
                  headerTitle: {
                    fontFamily: "Geist, sans-serif",
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: "var(--bsd-ink)",
                  },
                  headerSubtitle: { color: "var(--bsd-muted)" },
                  socialButtonsBlockButton: {
                    background: "transparent",
                    border: "1px solid var(--bsd-rule)",
                    color: "var(--bsd-ink)",
                    fontFamily: "Geist Mono, monospace",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    borderRadius: 2,
                  },
                  formButtonPrimary: {
                    background: "var(--bsd-red)",
                    border: "1px solid var(--bsd-red)",
                    color: "var(--bsd-paper)",
                    fontFamily: "Geist Mono, monospace",
                    fontSize: 11.5,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    borderRadius: 2,
                  },
                  footerActionLink: { color: "var(--bsd-red)", fontWeight: 700 },
                  dividerLine: { background: "var(--bsd-rule)" },
                  formFieldInput: {
                    background: "var(--bsd-paper-low, var(--bsd-paper))",
                    border: "1px solid var(--bsd-rule)",
                    borderRadius: 2,
                    color: "var(--bsd-ink)",
                  },
                },
              }}
            />
          )}
        </motion.section>
      </main>
    </div>
  );
}

function Bullet({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--bsd-body)" }}>
      <Check weight="bold" size={12} color="var(--bsd-red)" aria-hidden />
      {label}
    </div>
  );
}
