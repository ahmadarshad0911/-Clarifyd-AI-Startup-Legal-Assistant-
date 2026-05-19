"use client";

/** /pricing — Broadsheet · v6 */

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "@phosphor-icons/react";

import { PublicShell } from "../../components/public-shell";
import { useAuth } from "../../lib/auth";

type Plan = { id: string; name: string; monthlyUsd: number | null; features: string[]; cta: string; featured?: boolean; hint: string };

const PLANS: Plan[] = [
  { id: "reader",  name: "Reader",  monthlyUsd: 0,    hint: "3 contracts / month, forever",
    features: ["Clarifyd AI risk analysis", "Citation-grounded findings", "Suggested rewrites", "PDF export", "Community support"],
    cta: "Start free" },
  { id: "founder", name: "Founder", monthlyUsd: 29,   hint: "Billed monthly · cancel anytime", featured: true,
    features: ["Everything in Reader", "Unlimited contracts", "Collaborator doc export", "Free cached re-reads", "Negotiation tracker", "Email support · same-day"],
    cta: "Get Founder" },
  { id: "counsel", name: "Counsel", monthlyUsd: null, hint: "For firms reading at volume",
    features: ["Everything in Founder", "Custom jurisdiction templates", "SAML SSO", "SOC-2 exports", "Dedicated partner"],
    cta: "Talk to sales" },
];

const EOQ = [0.23, 1, 0.32, 1] as const;

export default function PricingPage() {
  const { token } = useAuth();
  const [annual, setAnnual] = useState(true);
  const planHref = token ? "/dashboard" : "/login";

  function price(p: Plan): { big: string; small: string } {
    if (p.monthlyUsd === null) return { big: "Custom", small: "" };
    if (p.monthlyUsd === 0) return { big: "$0", small: "forever" };
    const m = annual ? Math.round(p.monthlyUsd * 0.8) : p.monthlyUsd;
    return { big: `$${m}`, small: "/ month" };
  }

  return (
    <PublicShell>
      <section style={{ padding: "72px 32px 24px", borderBottom: "1.5px solid var(--bsd-ink)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)", gap: 56, alignItems: "end" }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EOQ }}>
            <span className="bsd-kicker">§ Subscriptions</span>
            <h1 style={{ margin: "12px 0 0", fontSize: "clamp(48px, 7vw, 96px)", lineHeight: 0.95, letterSpacing: "-0.04em", color: "var(--bsd-ink)", fontWeight: 700 }}>
              Free until your <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>seed round.</span>
            </h1>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EOQ, delay: 0.1 }} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <p style={{ margin: 0, fontSize: 16, color: "var(--bsd-body)", lineHeight: 1.6, maxWidth: 420 }}>
              Three contracts a month free. $29 when you outgrow it. No annual lock-in. No contact-sales wall on the first two tiers.
            </p>
            <div style={{ display: "inline-flex", border: "1.5px solid var(--bsd-ink)", padding: 3, alignSelf: "flex-start" }}>
              {[{ v: true, label: "Annual −20%" }, { v: false, label: "Monthly" }].map((m) => {
                const active = annual === m.v;
                return (
                  <button
                    key={String(m.v)}
                    type="button"
                    onClick={() => setAnnual(m.v)}
                    className="cursor-pointer cf-mono"
                    style={{
                      padding: "8px 16px",
                      background: active ? "var(--bsd-ink)" : "transparent",
                      color: active ? "var(--bsd-paper)" : "var(--bsd-ink)",
                      border: "none",
                      fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800,
                      transition: "background var(--dur-base) ease, color var(--dur-base) ease",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      <section style={{ padding: "56px 32px", borderBottom: "1.5px solid var(--bsd-ink)" }}>
        <div
          style={{
            maxWidth: 1280, margin: "0 auto",
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            borderTop: "2px solid var(--bsd-ink)", borderBottom: "2px solid var(--bsd-ink)",
          }}
          className="grid-cols-1 md:grid-cols-3"
        >
          {PLANS.map((p, i) => {
            const lbl = price(p);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, ease: EOQ, delay: i * 0.07 }}
                style={{
                  padding: 28,
                  background: p.featured ? "var(--bsd-ink)" : "transparent",
                  color: p.featured ? "var(--bsd-paper)" : "var(--bsd-ink)",
                  borderRight: i < PLANS.length - 1 ? "1px solid var(--bsd-hairline)" : "none",
                  position: "relative",
                  display: "flex", flexDirection: "column", gap: 18,
                  minHeight: 460,
                }}
              >
                {p.featured ? (
                  <span
                    className="cf-mono"
                    style={{
                      position: "absolute", top: -10, left: 28,
                      background: "var(--bsd-red)", color: "var(--bsd-paper)",
                      padding: "3px 10px",
                      fontSize: 9.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 800,
                    }}
                  >
                    Most chosen
                  </span>
                ) : null}
                <span className="cf-mono" style={{ color: p.featured ? "var(--bsd-red)" : "var(--bsd-muted)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                  {p.name}
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1 }}>{lbl.big}</span>
                  <span style={{ fontSize: 13, color: p.featured ? "#bbb" : "var(--bsd-muted)" }}>{lbl.small}</span>
                </div>
                <div style={{ fontSize: 12.5, color: p.featured ? "#bbb" : "var(--bsd-muted)" }}>{p.hint}</div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: p.featured ? "#ddd" : "var(--bsd-body)", lineHeight: 1.5 }}>
                      <Check weight="bold" size={12} color={p.featured ? "var(--bsd-red)" : "var(--bsd-ink)"} style={{ marginTop: 4, flexShrink: 0 }} aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.id === "counsel" ? "/contact" : planHref}
                  className="bsd-btn cursor-pointer"
                  style={{
                    background: p.featured ? "var(--bsd-red)" : "var(--bsd-ink)",
                    borderColor: p.featured ? "var(--bsd-red)" : "var(--bsd-ink)",
                    color: "var(--bsd-paper)",
                  }}
                >
                  {p.cta} <ArrowRight weight="bold" size={11} />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>
    </PublicShell>
  );
}
