"use client";

/** /contact — Broadsheet · v6 */

import Link from "next/link";
import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, WarningCircle, EnvelopeSimple, Clock, Lightning } from "@phosphor-icons/react";

import { PublicShell } from "../../components/public-shell";
import { ApiClient, ApiError } from "../../lib/api";

type Topic = "general" | "sales" | "support" | "press" | "legal";

const TOPICS: Array<{ v: Topic; label: string }> = [
  { v: "general", label: "General" },
  { v: "sales", label: "Sales" },
  { v: "support", label: "Support" },
  { v: "press", label: "Press" },
  { v: "legal", label: "Legal" },
];

const STORAGE_KEY = "clarifyd.contacts";
const EOQ = [0.23, 1, 0.32, 1] as const;

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState<Topic>("general");
  const [message, setMessage] = useState("");
  const [honey, setHoney] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (honey) return;
    setSubmitting(true);
    try {
      const c = new ApiClient(() => null);
      await c.submitContact({
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || undefined,
        topic,
        message: message.trim(),
      });
      setDone(true);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Couldn't send right now.";
      setError(msg);
      try {
        const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        list.push({ name, email, company, topic, message, at: new Date().toISOString() });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      } catch {}
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicShell>
      <section style={{ padding: "72px 32px 80px" }}>
        <div
          style={{
            maxWidth: 1280, margin: "0 auto",
            display: "grid", gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)", gap: 56,
          }}
          className="grid-cols-1 lg:grid-cols-[5fr_7fr]"
        >
          <motion.aside
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EOQ }}
            style={{ display: "flex", flexDirection: "column", gap: 32 }}
          >
            <div>
              <span className="bsd-kicker">§ Correspondence</span>
              <h1 style={{ margin: "12px 0 0", fontSize: "clamp(48px, 7vw, 96px)", lineHeight: 0.95, letterSpacing: "-0.04em", color: "var(--bsd-ink)", fontWeight: 700 }}>
                Talk to <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>us.</span>
              </h1>
              <p style={{ marginTop: 16, color: "var(--bsd-body)", fontSize: 15.5, lineHeight: 1.65, maxWidth: 380 }}>
                Most threads get a reply same day. You&rsquo;ll usually get the person who built the thing.
              </p>
            </div>

            <ul style={{ margin: 0, padding: 0, listStyle: "none", borderTop: "2px solid var(--bsd-ink)" }}>
              {[
                { Icon: EnvelopeSimple, label: "Email",    value: "hello@clarifyd.com", href: "mailto:hello@clarifyd.com" },
                { Icon: Clock,           label: "Hours",    value: "Mon–Fri · 9–5 PKT" },
                { Icon: Lightning,       label: "Response", value: "usually < 24h" },
              ].map((c) => (
                <li key={c.label} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: "1px solid var(--bsd-hairline)" }}>
                  <c.Icon weight="duotone" size={18} color="var(--bsd-red)" aria-hidden />
                  <div style={{ minWidth: 0 }}>
                    <div className="cf-eyebrow" style={{ color: "var(--bsd-muted)" }}>{c.label}</div>
                    {c.href ? (
                      <a href={c.href} className="bsd-link" style={{ display: "inline-block", marginTop: 2, fontSize: 15, color: "var(--bsd-ink)", fontWeight: 500 }}>
                        {c.value}
                      </a>
                    ) : (
                      <div style={{ marginTop: 2, fontSize: 15, color: "var(--bsd-ink)", fontWeight: 500 }}>{c.value}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </motion.aside>

          {done ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EOQ }}
              style={{ background: "var(--bsd-paper-deep)", border: "2px solid var(--bsd-ink)", padding: 40, textAlign: "center" }}
            >
              <CheckCircle weight="duotone" size={44} color="var(--bsd-red)" />
              <h2 style={{ marginTop: 14, fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--bsd-ink)" }}>Message sent.</h2>
              <p style={{ marginTop: 10, color: "var(--bsd-muted)", fontSize: 14.5, lineHeight: 1.55 }}>
                We&rsquo;ll reply to <span className="cf-mono" style={{ color: "var(--bsd-ink)", fontWeight: 700 }}>{email}</span> shortly.
              </p>
              <Link href="/" className="bsd-btn cursor-pointer" style={{ marginTop: 22 }}>
                Back to landing <ArrowRight weight="bold" size={11} />
              </Link>
            </motion.div>
          ) : (
            <motion.form
              onSubmit={onSubmit}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: EOQ, delay: 0.08 }}
              style={{ background: "var(--bsd-paper-deep)", border: "2px solid var(--bsd-ink)", padding: 32, display: "flex", flexDirection: "column", gap: 20 }}
            >
              <input type="text" value={honey} onChange={(e) => setHoney(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="grid-cols-1 sm:grid-cols-2">
                <Field label="Name" value={name} onChange={setName} required />
                <Field label="Email" type="email" value={email} onChange={setEmail} required />
              </div>
              <Field label="Company (optional)" value={company} onChange={setCompany} />
              <div>
                <Lbl>Topic</Lbl>
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TOPICS.map((t) => {
                    const active = topic === t.v;
                    return (
                      <button
                        key={t.v}
                        type="button"
                        onClick={() => setTopic(t.v)}
                        className={`bsd-chip cf-mono${active ? " is-active" : ""}`}
                        style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Lbl>Message</Lbl>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={6}
                  placeholder="What's on your mind?"
                  className="bsd-input"
                  style={{ marginTop: 10, resize: "vertical", lineHeight: 1.55 }}
                />
              </div>
              {error ? (
                <div style={{ background: "var(--bsd-red-soft)", border: "1.5px solid var(--bsd-red)", padding: "10px 12px", fontSize: 12.5, color: "var(--bsd-red)", display: "flex", alignItems: "center", gap: 8 }}>
                  <WarningCircle weight="duotone" size={14} /> {error} — saved locally; we&rsquo;ll retry on next visit.
                </div>
              ) : null}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <p className="cf-mono" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bsd-muted)", fontWeight: 700, margin: 0 }}>
                  Never shared · only used to reply.
                </p>
                <button
                  type="submit"
                  disabled={submitting || !name || !email || !message}
                  className="bsd-btn cursor-pointer"
                >
                  {submitting ? "Sending…" : "Send"} <ArrowRight weight="bold" size={11} />
                </button>
              </div>
            </motion.form>
          )}
        </div>
      </section>
    </PublicShell>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <label className="cf-eyebrow" style={{ color: "var(--bsd-muted)" }}>{children}</label>;
}

function Field({
  label, value, onChange, type = "text", required,
}: { label: string; value: string; onChange: (s: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="bsd-field">
      <Lbl>{label}</Lbl>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bsd-input"
        style={{ marginTop: 10 }}
      />
    </div>
  );
}
