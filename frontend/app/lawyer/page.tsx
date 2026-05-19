"use client";

/**
 * /lawyer — Broadsheet "Article forthcoming" placeholder.
 *
 * Editorial "go to press" plate. Rubber-stamp IN DEVELOPMENT, large
 * forthcoming headline, email-me-when-ready ribbon, related routes
 * footer.
 */

import Link from "next/link";
import { FormEvent, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Scales, Hammer, Quotes } from "@phosphor-icons/react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { useToast } from "../../lib/toast";

const EOQ = [0.23, 1, 0.32, 1] as const;
const STORAGE_KEY = "clarifyd.lawyer-waitlist";

export default function LawyerPage() {
  const { push } = useToast();
  const reduce = useReducedMotion() ?? false;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      const list = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      list.push({ email: email.trim(), at: new Date().toISOString() });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
    setSent(true);
    push("On the list", "success", "We'll write when this column ships.");
  }

  return (
    <AppShell bare>
      <main style={{ background: "var(--bsd-paper)", color: "var(--bsd-body)", minHeight: "100dvh", position: "relative", overflow: "hidden" }}>
        {/* Plate */}
        <section style={{ padding: "112px 48px 96px", borderBottom: "1.5px solid var(--bsd-ink)", position: "relative" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
            <motion.div
              initial={{ opacity: 0, y: reduce ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: EOQ }}
              style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, borderBottom: "1px solid var(--bsd-hairline)" }}
            >
              <Scales weight="duotone" size={22} color="var(--bsd-red)" aria-hidden />
              <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                § Article forthcoming · No. XII
              </span>
              <span style={{ flex: 1, height: 1, background: "var(--bsd-hairline)" }} />
              <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700 }}>
                Galley proof · v0
              </span>
            </motion.div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)", gap: 64, alignItems: "start", marginTop: 48 }} className="grid-cols-1 lg:grid-cols-[7fr_5fr]">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: reduce ? 0 : 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EOQ, delay: 0.05 }}
                  style={{
                    margin: 0,
                    fontSize: "clamp(48px, 7vw, 108px)",
                    lineHeight: 0.95,
                    letterSpacing: "-0.04em",
                    color: "var(--bsd-ink)",
                    fontWeight: 700,
                  }}
                >
                  The Lawyer<br />
                  Escape Hatch is{" "}
                  <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>
                    still in galleys.
                  </span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EOQ, delay: 0.18 }}
                  style={{ marginTop: 26, fontSize: 19, color: "var(--bsd-body)", lineHeight: 1.55, maxWidth: 560, fontWeight: 500 }}
                >
                  We&rsquo;re vetting startup lawyers, signing flat-fee agreements,
                  and wiring the secure scan handoff. This column goes to press
                  once we can guarantee a 24-hour first reply.
                </motion.p>

                <motion.ul
                  initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EOQ, delay: 0.26 }}
                  style={{ margin: "36px 0 0", padding: 0, listStyle: "none", borderTop: "2px solid var(--bsd-ink)", borderBottom: "2px solid var(--bsd-ink)" }}
                >
                  {[
                    { label: "Lawyer vetting",        status: "In progress" },
                    { label: "Flat-fee agreements",   status: "Negotiating" },
                    { label: "Secure scan handoff",   status: "In design" },
                    { label: "24-hour reply SLA",     status: "Pending pilot" },
                  ].map((row, i, arr) => (
                    <li
                      key={row.label}
                      style={{
                        display: "grid", gridTemplateColumns: "48px 1fr auto", gap: 24, alignItems: "center",
                        padding: "18px 0",
                        borderBottom: i < arr.length - 1 ? "1px dotted var(--bsd-hairline)" : "none",
                      }}
                    >
                      <span className="cf-mono" style={{ color: "var(--bsd-soft)", fontSize: 13, letterSpacing: "0.14em", fontWeight: 800 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{ fontSize: 16, color: "var(--bsd-ink)", fontWeight: 500 }}>{row.label}</span>
                      <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 800 }}>
                        {row.status}
                      </span>
                    </li>
                  ))}
                </motion.ul>
              </div>

              {/* Rubber stamp + waitlist */}
              <div style={{ display: "flex", flexDirection: "column", gap: 32, marginTop: 16 }}>
                <motion.div
                  initial={{ opacity: 0, scale: reduce ? 1 : 0.92, rotate: reduce ? 0 : -2 }}
                  animate={{ opacity: 1, scale: 1, rotate: -6 }}
                  transition={{ duration: 0.6, ease: EOQ, delay: 0.12 }}
                  style={{
                    alignSelf: "flex-start",
                    display: "inline-flex", alignItems: "center", gap: 10,
                    padding: "14px 22px",
                    border: "3px solid var(--bsd-red)",
                    color: "var(--bsd-red)",
                    fontFamily: "Geist Mono, monospace",
                    fontSize: 13, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800,
                    background: "rgba(184, 38, 15, 0.06)",
                    transformOrigin: "center",
                  }}
                >
                  <Hammer weight="duotone" size={16} /> In development
                </motion.div>

                <motion.form
                  onSubmit={onSubmit}
                  initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EOQ, delay: 0.22 }}
                  style={{
                    background: "var(--bsd-paper-deep)",
                    border: "2px solid var(--bsd-ink)",
                    padding: 26,
                    display: "flex", flexDirection: "column", gap: 14,
                  }}
                >
                  <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                    § Notify by post
                  </span>
                  <p style={{ margin: 0, fontSize: 14.5, color: "var(--bsd-body)", lineHeight: 1.55 }}>
                    Drop your address. We&rsquo;ll write when the column ships, with the first 50 readers getting flat-fee first-review pricing.
                  </p>
                  {sent ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--bsd-hairline)" }}>
                      <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800 }}>
                        ✓ On the list
                      </span>
                      <span style={{ fontSize: 13, color: "var(--bsd-muted)" }}>
                        We&rsquo;ll write to <span className="cf-mono" style={{ color: "var(--bsd-ink)", fontWeight: 700 }}>{email}</span>.
                      </span>
                    </div>
                  ) : (
                    <div className="bsd-field" style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 6 }}>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@startup.com"
                        className="bsd-input"
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="bsd-btn cursor-pointer" style={{ flexShrink: 0 }}>
                        Tell me <ArrowRight weight="bold" size={11} />
                      </button>
                    </div>
                  )}
                </motion.form>

                <motion.blockquote
                  initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EOQ, delay: 0.34 }}
                  style={{
                    margin: 0,
                    padding: "14px 0 14px 18px",
                    borderLeft: "2px solid var(--bsd-red)",
                    fontStyle: "italic",
                    fontSize: 15.5,
                    lineHeight: 1.5,
                    color: "var(--bsd-ink)",
                  }}
                >
                  <Quotes weight="duotone" size={16} color="var(--bsd-red)" style={{ verticalAlign: "top", marginRight: 4 }} aria-hidden />
                  Until then, the scanner and the founder-friendly rewrites in
                  Findings cover the first read. A human escalation is reserved
                  for what actually needs counsel.
                </motion.blockquote>
              </div>
            </div>
          </div>
        </section>

        {/* Related */}
        <section style={{ padding: "72px 48px", borderBottom: "1.5px solid var(--bsd-ink)" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 14, borderBottom: "1px solid var(--bsd-hairline)" }}>
              <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                § In the meantime
              </span>
              <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700 }}>
                Three rooms over
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0, marginTop: 32, borderTop: "2px solid var(--bsd-ink)", borderBottom: "2px solid var(--bsd-ink)" }} className="grid-cols-1 md:grid-cols-3">
              {[
                { href: "/findings", n: "I",   title: "Findings", body: "The verdict on your last scan, every clause sorted by severity." },
                { href: "/copilot",  n: "II",  title: "Co-Pilot", body: "Ask the AI a question scoped to a clause. Cited reasoning, no hallucinations." },
                { href: "/monitor",  n: "III", title: "Monitor",  body: "Vesting cliffs, IP assignments, auto-renewals — surfaced before they bite." },
              ].map((c, i, arr) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="cursor-pointer bsd-row"
                  style={{
                    display: "flex", flexDirection: "column", gap: 12,
                    padding: 28,
                    textDecoration: "none",
                    color: "var(--bsd-ink)",
                    borderRight: i < arr.length - 1 ? "1px solid var(--bsd-hairline)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 12, letterSpacing: "0.20em", fontWeight: 800 }}>{c.n}</span>
                    <ArrowRight className="bsd-row__caret" weight="bold" size={14} color="var(--bsd-soft)" aria-hidden />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>{c.title}</div>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--bsd-body)", lineHeight: 1.55 }}>{c.body}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
