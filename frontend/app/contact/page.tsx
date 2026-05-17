"use client";

/** Contact — dark editorial. Public route, no auth gate. */

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

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

  useEffect(() => {
    const orig = document.body.style.background;
    document.body.style.background = "#020617";
    return () => {
      document.body.style.background = orig;
    };
  }, []);

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
    <div
      className="min-h-screen text-slate-200"
      style={{
        background:
          "radial-gradient(ellipse 90% 50% at 50% -10%, rgba(99,102,241,0.10) 0%, transparent 50%), #020617",
        fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-100 font-semibold tracking-tight cursor-pointer">
            <span
              className="inline-block h-5 w-5 rounded-[6px]"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
              aria-hidden
            />
            Clarifyd
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/pricing" className="text-slate-400 hover:text-slate-100 cursor-pointer">Pricing</Link>
            <Link href="/faq" className="text-slate-400 hover:text-slate-100 cursor-pointer">FAQ</Link>
          </div>
        </div>
      </nav>

      <main className="pt-28 pb-20">
        <div className="mx-auto max-w-5xl px-6 grid lg:grid-cols-[1fr_1.4fr] gap-10">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.18em] text-violet-400"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              ↳ contact
            </div>
            <h1 className="mt-3 text-4xl text-white font-semibold tracking-tight">
              Talk to us.
            </h1>
            <p className="mt-4 text-slate-400 max-w-md">
              Most threads get a reply same day. We're a small team — you'll get
              the person who built the thing, not a ticket queue.
            </p>

            <div className="mt-8 space-y-3">
              {[
                { label: "Email", value: "hello@clarifyd.com", href: "mailto:hello@clarifyd.com" },
                { label: "Hours", value: "Mon–Fri · 9–5 PKT" },
                { label: "Response", value: "usually < 24h" },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3">
                  <div
                    className="text-[10px] uppercase tracking-[0.14em] text-slate-500"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {c.label}
                  </div>
                  {c.href ? (
                    <a
                      href={c.href}
                      className="mt-0.5 inline-block text-sm text-slate-100 hover:text-indigo-200 cursor-pointer"
                    >
                      {c.value} →
                    </a>
                  ) : (
                    <div className="mt-0.5 text-sm text-slate-100">{c.value}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {done ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-10 text-center flex flex-col justify-center">
              <div className="text-5xl mb-3">✓</div>
              <h2 className="text-2xl text-white font-semibold tracking-tight">Message sent</h2>
              <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">
                We'll reply to <span className="text-slate-200 font-semibold">{email}</span> shortly.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-100 px-4 py-2 text-sm cursor-pointer transition-colors duration-200 mx-auto"
              >
                ← Back to landing
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="rounded-xl border border-white/10 bg-slate-900/50 p-7 space-y-4">
              {/* honeypot */}
              <input type="text" value={honey} onChange={(e) => setHoney(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Name" value={name} onChange={setName} required />
                <Field label="Email" type="email" value={email} onChange={setEmail} required />
              </div>
              <Field label="Company (optional)" value={company} onChange={setCompany} />

              <div>
                <Lbl>Topic</Lbl>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {TOPICS.map((t) => (
                    <button
                      key={t.v}
                      type="button"
                      onClick={() => setTopic(t.v)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors duration-200 cursor-pointer ${
                        topic === t.v
                          ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-200"
                          : "border-white/10 bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Lbl>Message</Lbl>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={6}
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all resize-y"
                  placeholder="What's on your mind?"
                />
              </div>

              {error ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
                  ⚠ {error} — saved locally; we'll retry on next visit.
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-4">
                <p
                  className="text-[11px] text-slate-500"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  ↳ never shared. only used to reply.
                </p>
                <button
                  type="submit"
                  disabled={submitting || !name || !email || !message}
                  className="rounded-lg bg-white text-slate-950 px-5 py-2.5 text-sm font-semibold hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
                >
                  {submitting ? "Sending…" : "Send →"}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      <footer className="border-t border-white/5 bg-slate-950/90">
        <div
          className="mx-auto max-w-6xl px-6 py-6 text-xs text-slate-500 flex flex-col md:flex-row justify-between gap-2"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          <span>© 2026 Clarifyd. Not legal advice.</span>
          <Link href="/" className="hover:text-slate-300 cursor-pointer">← landing</Link>
        </div>
      </footer>
    </div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="text-[10px] uppercase tracking-[0.14em] text-slate-500"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Lbl>{label}</Lbl>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
      />
    </div>
  );
}
