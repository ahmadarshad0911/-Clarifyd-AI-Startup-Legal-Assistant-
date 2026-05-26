"use client";

/**
 * /login (catch-all) — Broadsheet · v7
 *
 * Clerk-hosted SignIn embedded inside a full editorial spread. Left column:
 * masthead, kicker, value props, founder pull-quote. Right column: themed
 * <SignIn /> with sharp edges, ink rule, red primary, Geist Mono caps on
 * social buttons.
 *
 * Catch-all route ([[...rest]]) is required by Clerk so Clerk's internal
 * sub-routes (factor-two, verify-email, etc.) resolve cleanly.
 */

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { SignIn, useUser } from "@clerk/nextjs";
import {
  ArrowUpRight,
  Check,
  Quotes,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react";

const EOQ = [0.23, 1, 0.32, 1] as const;

const QUOTE = {
  q: "Caught a 365-day non-compete buried in clause 22 my lawyer missed.",
  who: "Maya R., founder",
  tag: "SAFE · pre-seed",
};

export default function LoginPage() {
  const reduce = useReducedMotion() ?? false;
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  // If already signed in (e.g. user hits /login after a successful OAuth
  // return), Clerk sometimes hangs on its catchall-check route while it
  // probes for the session. Push them to /dashboard explicitly so the
  // spinner doesn't loop.
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bsd-paper)",
        color: "var(--bsd-body)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Masthead */}
      <header
        style={{
          borderBottom: "3px double var(--bsd-ink)",
          padding: "14px 32px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Link
          href="/"
          className="cursor-pointer"
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 12,
            textDecoration: "none",
          }}
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
        <div
          className="cf-mono"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            color: "var(--bsd-muted)",
            fontSize: 9.5,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          <span>Vol. I · No. 06</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <Link
            href="/contact"
            className="cursor-pointer"
            style={{
              color: "var(--bsd-muted)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Need help <ArrowUpRight weight="bold" size={11} />
          </Link>
        </div>
      </header>

      {/* Dateline */}
      <div
        style={{
          borderBottom: "1px solid var(--bsd-hairline)",
          padding: "6px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "Geist Mono, monospace",
          fontSize: 9.5,
          color: "var(--bsd-muted)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        <span>The Clarifyd Broadsheet · daily edition</span>
        <span>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      <main
        style={{
          padding: "48px 32px 80px",
          maxWidth: 1280,
          width: "100%",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)",
          gap: 64,
          flex: 1,
        }}
        className="grid-cols-1 lg:grid-cols-[5fr_7fr]"
      >
        {/* Left column */}
        <motion.aside
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EOQ }}
          style={{ display: "flex", flexDirection: "column", gap: 28 }}
        >
          <span
            className="bsd-kicker"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <ShieldCheck weight="duotone" size={14} aria-hidden />
            Welcome back, founder
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
              reading room.
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
            Resume contract reviews. Findings, rewrites, and your library are
            exactly where you left them.
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              paddingTop: 16,
              borderTop: "1px solid var(--bsd-hairline)",
            }}
          >
            <Bullet label="One-tap sign-in with Google or Facebook" />
            <Bullet label="Clause-level risk scoring in seconds" />
            <Bullet label="Founder-favorable rewrites, drop-in ready" />
            <Bullet label="Export DOCX redlines for your counterparty" />
          </div>

          <motion.figure
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EOQ, delay: 0.18 }}
            style={{
              margin: "12px 0 0",
              padding: "20px 22px",
              borderLeft: "3px solid var(--bsd-red)",
              background: "var(--bsd-paper-low, transparent)",
            }}
          >
            <Quotes weight="duotone" size={18} color="var(--bsd-red)" />
            <blockquote
              style={{
                margin: "8px 0 12px",
                fontSize: 16,
                color: "var(--bsd-ink)",
                fontStyle: "italic",
                lineHeight: 1.5,
              }}
            >
              &ldquo;{QUOTE.q}&rdquo;
            </blockquote>
            <figcaption
              className="cf-mono"
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                fontFamily: "Geist Mono, monospace",
                fontSize: 10.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--bsd-muted)",
                fontWeight: 700,
              }}
            >
              <span>— {QUOTE.who}</span>
              <span style={{ color: "var(--bsd-red)" }}>{QUOTE.tag}</span>
            </figcaption>
          </motion.figure>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="cf-mono"
            style={{
              fontFamily: "Geist Mono, monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--bsd-muted)",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: "auto",
            }}
          >
            <Sparkle weight="duotone" size={12} color="var(--bsd-red)" />
            Sign-in by Clerk · session-only, never logged
          </motion.div>
        </motion.aside>

        {/* Right column — Clerk SignIn (no motion wrapper: Clerk's internal
            mount cycle and callback handler must run synchronously, otherwise
            sso-callback can hang in the loading state). */}
        <section
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            position: "relative",
            paddingTop: 18,
          }}
        >
          {(
            <div style={{ width: "100%", maxWidth: 460, position: "relative" }}>
              {/* Red double-rule above card */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: -18,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: "var(--bsd-red)",
                }}
              />
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: -13,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: "var(--bsd-red)",
                  opacity: 0.4,
                }}
              />
              <div
                className="cf-mono"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: "Geist Mono, monospace",
                  fontSize: 10,
                  letterSpacing: "0.20em",
                  textTransform: "uppercase",
                  color: "var(--bsd-red)",
                  fontWeight: 800,
                  marginBottom: 14,
                }}
              >
                Section · Identification
              </div>
              <SignIn
                path="/login"
                routing="path"
                signUpUrl="/login"
                forceRedirectUrl="/dashboard"
                signUpForceRedirectUrl="/onboarding/profile"
                appearance={{
                  layout: {
                    socialButtonsPlacement: "top",
                    showOptionalFields: true,
                  },
                  variables: {
                    colorPrimary: "#b8260f",
                    colorBackground: "#f4ede1",
                    colorText: "#0c0a08",
                    colorTextSecondary: "#6c6356",
                    colorInputBackground: "#f7f1e7",
                    colorInputText: "#0c0a08",
                    colorDanger: "#b8260f",
                    borderRadius: "2px",
                    fontFamily:
                      "Geist, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
                    fontFamilyButtons:
                      "Geist Mono, ui-monospace, monospace",
                    fontSize: "14px",
                  },
                  elements: {
                    rootBox: { width: "100%" },
                    card: {
                      background: "var(--bsd-paper)",
                      border: "1px solid var(--bsd-ink)",
                      boxShadow: "none",
                      borderRadius: 2,
                      padding: "28px 28px 24px",
                    },
                    header: { paddingBottom: 8 },
                    headerTitle: {
                      fontFamily: "Geist, sans-serif",
                      fontSize: 24,
                      fontWeight: 700,
                      letterSpacing: "-0.02em",
                      color: "var(--bsd-ink)",
                    },
                    headerSubtitle: {
                      color: "var(--bsd-muted)",
                      fontSize: 13,
                    },
                    socialButtonsBlockButton: {
                      background: "transparent",
                      border: "1px solid var(--bsd-rule)",
                      color: "var(--bsd-ink)",
                      fontFamily: "Geist Mono, monospace",
                      fontSize: 11,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      borderRadius: 2,
                      padding: "10px 14px",
                    },
                    socialButtonsBlockButtonText: {
                      color: "var(--bsd-ink)",
                      fontWeight: 700,
                    },
                    dividerLine: { background: "var(--bsd-rule)", height: 1 },
                    dividerText: {
                      fontFamily: "Geist Mono, monospace",
                      fontSize: 10,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--bsd-muted)",
                      fontWeight: 700,
                    },
                    formFieldLabel: {
                      fontFamily: "Geist Mono, monospace",
                      fontSize: 10,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--bsd-muted)",
                      fontWeight: 700,
                    },
                    formFieldInput: {
                      background:
                        "var(--bsd-paper-low, var(--bsd-paper))",
                      border: "1px solid var(--bsd-rule)",
                      borderRadius: 2,
                      color: "var(--bsd-ink)",
                      padding: "10px 12px",
                      fontSize: 14,
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
                      padding: "12px 18px",
                    },
                    footerActionLink: {
                      color: "var(--bsd-red)",
                      fontWeight: 700,
                      textDecoration: "none",
                    },
                    identityPreviewText: { color: "var(--bsd-body)" },
                    formFieldHintText: { color: "var(--bsd-muted)" },
                    formFieldErrorText: { color: "var(--bsd-red)" },
                    alert: { borderRadius: 2 },
                  },
                }}
              />
              <p
                className="cf-mono"
                style={{
                  marginTop: 14,
                  fontFamily: "Geist Mono, monospace",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--bsd-muted)",
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                By signing in you accept the{" "}
                <Link
                  href="/terms"
                  className="cursor-pointer"
                  style={{
                    color: "var(--bsd-ink)",
                    textDecoration: "underline",
                  }}
                >
                  terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/security"
                  className="cursor-pointer"
                  style={{
                    color: "var(--bsd-ink)",
                    textDecoration: "underline",
                  }}
                >
                  privacy policy
                </Link>
                .
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Bullet({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 13.5,
        color: "var(--bsd-body)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          display: "grid",
          placeItems: "center",
          background: "var(--bsd-red-soft, transparent)",
          border: "1px solid var(--bsd-red)",
          color: "var(--bsd-red)",
          borderRadius: 2,
        }}
      >
        <Check weight="bold" size={11} />
      </span>
      {label}
    </div>
  );
}
