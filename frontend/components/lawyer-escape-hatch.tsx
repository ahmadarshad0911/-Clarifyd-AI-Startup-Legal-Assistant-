"use client";

/**
 * LawyerEscapeHatch — workflow stage 10, P2 (§6.14).
 *
 * Single card. Real lawyer name + avatar initial + "Pre-loaded with your
 * scan." Disclaimer in footer: "You are engaging the lawyer directly.
 * Clarifyd is not a referral service."
 *
 * Empty state when no lawyer matches user's jurisdiction → waitlist.
 */

import { ArrowRight, ShieldCheck } from "@phosphor-icons/react";

export type Lawyer = {
  name: string;
  firm: string;      // "ex-Cooley" / "Partner @ Westlake"
  fee: string;       // "$250 flat for first review"
  jurisdiction: string;
  initial?: string;
};

type Props = {
  lawyer?: Lawyer | null;
  draftSummary?: string;     // e.g. "Master Services Agreement — vendor v2 · 6 findings"
  onSend?: () => void;       // sends signed JSON of scan + findings
  onWaitlist?: () => void;
  jurisdiction?: string;     // user's jurisdiction; used in empty state
};

export function LawyerEscapeHatch({
  lawyer,
  draftSummary,
  onSend,
  onWaitlist,
  jurisdiction = "your region",
}: Props) {
  if (!lawyer) {
    return (
      <div
        style={{
          background: "var(--bg-elevated-1)",
          border: "1px solid var(--border-hairline)",
          borderRadius: "var(--r-md)",
          padding: 28,
          textAlign: "center",
        }}
      >
        <ShieldCheck weight="duotone" size={28} color="var(--ink-muted)" />
        <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.55 }}>
          No vetted lawyer in <span style={{ color: "var(--ink-primary)" }}>{jurisdiction}</span> yet.
        </p>
        <button
          type="button"
          onClick={onWaitlist}
          className="cursor-pointer"
          style={{
            marginTop: 16,
            background: "transparent",
            border: "1px solid var(--border-strong)",
            color: "var(--ink-primary)",
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 500,
            borderRadius: "var(--r-sm)",
            transition: "border-color 200ms var(--ease-out)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--brand-500)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
        >
          Join the waitlist
        </button>
      </div>
    );
  }

  const initial = (lawyer.initial ?? lawyer.name[0]).toUpperCase();

  return (
    <div
      style={{
        background: "var(--bg-elevated-1)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-md)",
        padding: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--brand-500), var(--brand-700))",
            color: "var(--ink-on-brand)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Geist, sans-serif",
            fontWeight: 600,
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {initial}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cf-eyebrow" style={{ color: "var(--brand-500)" }}>
            Talk to a startup lawyer · ≤ 24h reply
          </div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 500, letterSpacing: "-0.005em" }}>
            {lawyer.name}
            <span style={{ color: "var(--ink-muted)", fontWeight: 400, marginLeft: 6 }}>
              · {lawyer.firm}
            </span>
          </div>
          <div className="cf-mono" style={{ marginTop: 4, fontSize: 11, letterSpacing: "0.10em", color: "var(--ink-muted)" }}>
            {lawyer.fee} · admitted in {lawyer.jurisdiction}
          </div>
        </div>
      </div>

      {draftSummary ? (
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            background: "var(--bg-base)",
            border: "1px solid var(--border-hairline)",
            borderRadius: "var(--r-sm)",
            fontSize: 13,
            color: "var(--ink-secondary)",
          }}
        >
          <span className="cf-mono" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-muted)", marginRight: 8 }}>
            attached
          </span>
          {draftSummary}
        </div>
      ) : null}

      <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p className="cf-mono" style={{ margin: 0, fontSize: 10, letterSpacing: "0.10em", color: "var(--ink-muted)", maxWidth: 360, lineHeight: 1.5 }}>
          You are engaging the lawyer directly. Clarifyd is not a referral service.
        </p>
        <button
          type="button"
          onClick={onSend}
          className="cursor-pointer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "var(--brand-500)",
            color: "var(--ink-on-brand)",
            padding: "12px 20px",
            border: "none",
            fontSize: 13.5,
            fontWeight: 500,
            borderRadius: "var(--r-sm)",
            transition: "background 200ms var(--ease-out), transform 140ms var(--ease-out)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--brand-400)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--brand-500)")}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          Send my scan to {lawyer.name.split(" ")[0]} <ArrowRight weight="bold" size={13} />
        </button>
      </div>
    </div>
  );
}
