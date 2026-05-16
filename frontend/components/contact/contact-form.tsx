"use client";

/**
 * ContactForm v2 — premium glass with floating labels, chip topic
 * selector, gradient progress meter, paper-airplane launch.
 *
 *   - Floating labels: label sits inside the field, lifts above on
 *     focus or when filled. No external uppercase caption.
 *   - Topic = chip group with icons + bubbly select state (no dropdown).
 *   - Progress meter at top tracks "required fields completed".
 *   - Send button = launchpad → plane fly-off → success card.
 *   - Honeypot field hidden off-screen.
 *   - Public endpoint (no token needed). Falls back to localStorage offline.
 */

import { FormEvent, useMemo, useState } from "react";

import { ApiClient, ApiError } from "../../lib/api";

type Topic = "general" | "sales" | "support" | "press" | "legal";

const TOPICS: Array<{ v: Topic; label: string; icon: string }> = [
  { v: "general", label: "General",  icon: "lightbulb" },
  { v: "sales",   label: "Sales",    icon: "savings" },
  { v: "support", label: "Support",  icon: "support_agent" },
  { v: "press",   label: "Press",    icon: "newspaper" },
  { v: "legal",   label: "Legal",    icon: "gavel" },
];

const STORAGE_KEY = "clarifyd.contacts";

type Props = {
  compact?: boolean;
  heading?: string | null;
  subheading?: string | null;
};

export function ContactForm({
  compact = false,
  heading = "Send us a message",
  subheading = "Real humans on the other end — usually replying within 6 business hours.",
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState<Topic>("general");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const messageOk = message.trim().length >= 8;
  const canSubmit = emailOk && messageOk;

  // Required fields completed = progress bar fill.
  const progress = useMemo(() => {
    let n = 0;
    if (emailOk) n++;
    if (messageOk) n++;
    if (topic) n++;
    return (n / 3) * 100;
  }, [emailOk, messageOk, topic]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    setSending(true);
    const client = new ApiClient(() => null);
    try {
      try {
        await client.submitContact({
          name: name.trim() || null,
          email: email.trim(),
          company: company.trim() || null,
          topic,
          message: message.trim(),
          page_path: typeof window !== "undefined" ? window.location.pathname : null,
          website: website || null,
        });
      } catch (err) {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          const list = raw ? JSON.parse(raw) : [];
          list.unshift({
            id: crypto.randomUUID(),
            name, email, company, topic, message,
            submitted_at: new Date().toISOString(),
          });
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
        } catch { /* ignore */ }
        setError(
          err instanceof ApiError
            ? `${err.message} (saved locally)`
            : "Saved locally — backend unreachable."
        );
      }
    } finally {
      window.setTimeout(() => {
        setSent(true);
        setSending(false);
      }, 900);
    }
  }

  function reset() {
    setSent(false);
    setError(null);
    setName("");
    setEmail("");
    setCompany("");
    setTopic("general");
    setMessage("");
  }

  if (sent) {
    return (
      <div className="contact-success-card text-center py-6">
        <span
          className="material-symbols-outlined text-status-success text-[64px] block"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          check_circle
        </span>
        <h2 className="font-display-hero text-h2 text-onboarding-navy m-0 mt-2">
          Got it{name ? `, ${name}` : ""}.
        </h2>
        <p className="text-on-surface-variant max-w-md mx-auto mt-2">
          We&rsquo;ll reply to <strong>{email}</strong> within 6 business hours.
        </p>
        {error ? (
          <p className="text-[12px] text-on-surface-variant/70 mt-2">{error}</p>
        ) : null}
        <button type="button" onClick={reset} className="btn-capsule btn-capsule-primary mt-6">
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="premium-form flex flex-col gap-5">
      {heading ? (
        <div>
          <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">
            Contact
          </span>
          <h3 className="font-display-hero text-h2 text-onboarding-navy m-0 mt-1 leading-tight">
            {heading}
          </h3>
          {subheading ? (
            <p className="text-on-surface-variant text-body-sm mt-2 m-0">{subheading}</p>
          ) : null}
        </div>
      ) : null}

      {/* Progress meter — fills as required fields validate */}
      <div className="premium-progress" aria-hidden>
        <span
          className="premium-progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Name + email */}
      <div className="grid sm:grid-cols-2 gap-4">
        <FloatField
          label="Your name"
          value={name}
          onChange={setName}
          autoComplete="name"
          icon="badge"
          maxLength={80}
        />
        <FloatField
          label="Email"
          required
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
          icon="alternate_email"
          maxLength={120}
          valid={email.length > 0 ? emailOk : null}
        />
      </div>

      {/* Company (only in non-compact mode) */}
      {compact ? null : (
        <FloatField
          label="Company (optional)"
          value={company}
          onChange={setCompany}
          autoComplete="organization"
          icon="business"
          maxLength={80}
        />
      )}

      {/* Topic chip group */}
      <div>
        <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-2">
          What&rsquo;s on your mind?
        </span>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => {
            const selected = topic === t.v;
            return (
              <button
                key={t.v}
                type="button"
                onClick={() => setTopic(t.v)}
                aria-pressed={selected}
                className="topic-chip"
                data-selected={selected}
              >
                <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Message — hero field */}
      <FloatTextarea
        label="How can we help?"
        required
        value={message}
        onChange={setMessage}
        rows={compact ? 4 : 5}
        maxLength={2000}
        valid={message.length > 0 ? messageOk : null}
      />

      {/* Honeypot */}
      <label
        aria-hidden
        style={{
          position: "absolute",
          left: "-10000px",
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        Website
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </label>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        <p className="text-[11px] text-on-surface-variant/70 m-0 max-w-sm">
          By submitting you agree to be contacted regarding this enquiry. No marketing, no sharing.
        </p>
        <button
          type="submit"
          disabled={sending || !canSubmit}
          className={`send-btn relative inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white bg-gradient-to-r from-primary to-accent-violet shadow-lg shadow-primary/40 disabled:opacity-50 disabled:shadow-none ${
            sending ? "is-sending" : ""
          }`}
        >
          <span className="send-btn-label inline-flex items-center gap-2">
            Send message
            <span className="material-symbols-outlined text-[18px]">send</span>
          </span>
          <span className="send-btn-plane" aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </span>
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Reusable floating-label fields                                      */
/* ------------------------------------------------------------------ */

type FloatProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  icon?: string;
  maxLength?: number;
  valid?: boolean | null;
};

function FloatField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  autoComplete,
  icon,
  maxLength,
  valid,
}: FloatProps) {
  const filled = value.length > 0;
  return (
    <label
      className="float-field"
      data-filled={filled}
      data-valid={valid === false ? "false" : valid === true ? "true" : ""}
    >
      {icon ? (
        <span className="float-field-icon material-symbols-outlined text-[18px]">
          {icon}
        </span>
      ) : null}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder=" "
      />
      <span className="float-field-label">
        {label}
        {required ? <span className="text-status-danger ml-0.5">*</span> : null}
      </span>
      {valid === true ? (
        <span
          className="float-field-status material-symbols-outlined text-status-success text-[18px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          check_circle
        </span>
      ) : valid === false ? (
        <span className="float-field-status material-symbols-outlined text-status-warn text-[18px]">
          error
        </span>
      ) : null}
    </label>
  );
}

function FloatTextarea({
  label,
  value,
  onChange,
  required = false,
  rows = 5,
  maxLength,
  valid,
}: Omit<FloatProps, "type" | "autoComplete" | "icon"> & { rows?: number }) {
  const filled = value.length > 0;
  return (
    <label
      className="float-field float-field-area"
      data-filled={filled}
      data-valid={valid === false ? "false" : valid === true ? "true" : ""}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        rows={rows}
        maxLength={maxLength}
        placeholder=" "
      />
      <span className="float-field-label">
        {label}
        {required ? <span className="text-status-danger ml-0.5">*</span> : null}
      </span>
      {maxLength ? (
        <span className="float-field-counter">
          {value.length}/{maxLength}
        </span>
      ) : null}
    </label>
  );
}
