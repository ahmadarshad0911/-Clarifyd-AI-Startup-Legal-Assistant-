"use client";

/**
 * PublicShell — Broadsheet · v6
 *
 * Masthead + body slot + inverted footer. Used by /pricing, /faq, /contact,
 * /terms. Landing has its own bespoke masthead.
 */

import Link from "next/link";
import { ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react";

import { useAuth } from "../lib/auth";

export function PublicShell({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const ctaHref = token ? "/dashboard" : "/login";
  const ctaLabel = token ? "Open app" : "Sign in";

  return (
    <div
      style={{
        background: "var(--bsd-paper)",
        color: "var(--bsd-body)",
        minHeight: "100dvh",
        display: "flex", flexDirection: "column",
      }}
    >
      <header
        style={{
          borderBottom: "3px double var(--bsd-ink)",
          padding: "16px 32px 12px",
          display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "end", gap: 16,
        }}
      >
        <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700 }}>
          Vol. I · No. 03
        </span>
        <Link href="/" className="cursor-pointer" style={{ textDecoration: "none" }}>
          <span style={{ display: "block", fontFamily: "Geist, sans-serif", fontWeight: 800, fontSize: 26, color: "var(--bsd-ink)", letterSpacing: "-0.04em", lineHeight: 1, textAlign: "center" }}>
            The Clarifyd
          </span>
          <span className="cf-mono" style={{ display: "block", textAlign: "center", color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", marginTop: 2 }}>
            Broadsheet
          </span>
        </Link>
        <nav style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
          <Link href="/faq" className="bsd-link cf-mono" style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>FAQ</Link>
          <Link href="/pricing" className="bsd-link cf-mono" style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>Plans</Link>
          <Link href="/contact" className="bsd-link cf-mono" style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>Contact</Link>
          <Link href={ctaHref} className="bsd-btn bsd-btn--sm">
            {ctaLabel} <ArrowRight weight="bold" size={11} />
          </Link>
        </nav>
      </header>

      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>

      <footer style={{ padding: "48px 32px 36px", background: "var(--bsd-ink)", color: "var(--bsd-paper)" }}>
        <div
          style={{
            maxWidth: 1280, margin: "0 auto",
            display: "grid", gridTemplateColumns: "minmax(0, 2fr) repeat(3, minmax(0, 1fr))", gap: 36,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em" }}>The Clarifyd Broadsheet</div>
            <p style={{ margin: "12px 0 0", color: "#bbb", fontSize: 13, maxWidth: 380, lineHeight: 1.6 }}>
              A weekly editorial on what your contracts are actually saying. Founder readers only.
            </p>
          </div>
          <FootCol heading="Product" items={[["Plans", "/pricing"], ["FAQ", "/faq"], ["Sign in", "/login"]]} />
          <FootCol heading="Company" items={[["Contact", "/contact"], ["Privacy", "/terms?tab=privacy"], ["Terms", "/terms"]]} />
          <FootCol heading="Resources" items={[["Status", "/status"], ["Changelog", "/changelog"], ["Security", "/security"]]} />
        </div>
        <div
          style={{
            maxWidth: 1280, margin: "28px auto 0",
            paddingTop: 18, borderTop: "1px solid rgba(244, 237, 225, 0.18)",
            display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
            fontFamily: "Geist Mono, monospace", fontSize: 10,
            color: "#9b9181", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600,
          }}
        >
          <span>© 2026 Clarifyd · v0.6.0</span>
          <span>Built for pre-seed founders</span>
        </div>
      </footer>
    </div>
  );
}

function FootCol({ heading, items }: { heading: string; items: Array<[string, string]> }) {
  return (
    <div>
      <div className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800, marginBottom: 14 }}>
        {heading}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(([label, href]) => (
          <li key={label}>
            <Link
              href={href}
              className="cursor-pointer"
              style={{ color: "var(--bsd-paper)", fontSize: 13.5, textDecoration: "none", transition: "color 200ms ease" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bsd-red)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--bsd-paper)")}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
