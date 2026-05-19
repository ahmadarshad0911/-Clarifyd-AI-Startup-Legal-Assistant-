"use client";

/** Login + Register — Broadsheet · v6
 *  All auth logic preserved (password generator, strength meter, OAuth,
 *  ApiError envelope, useAuth). */

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight, ArrowUpRight, Check, Eye, EyeSlash, Sparkle, ShieldCheck,
} from "@phosphor-icons/react";

import { ApiError, resolveApiBaseUrl } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";

type Mode = "signin" | "register";
const EOQ = [0.23, 1, 0.32, 1] as const;

export default function LoginPage() {
  const { login, register, token } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const apiBaseUrl = resolveApiBaseUrl();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedPw, setSuggestedPw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const justRegistered = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (justRegistered.current) router.replace("/terms?next=/onboarding/profile");
    else router.replace("/dashboard");
  }, [token, router]);

  function generatePassword(): string {
    const lo = "abcdefghijkmnopqrstuvwxyz";
    const up = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const dg = "23456789";
    const sy = "!@#$%^&*?-_+=";
    const all = lo + up + dg + sy;
    const pick = (set: string) => {
      const b = new Uint32Array(1);
      window.crypto.getRandomValues(b);
      return set[b[0] % set.length];
    };
    const req = [pick(lo), pick(up), pick(dg), pick(sy)];
    const rest = Array.from({ length: 12 }, () => pick(all));
    const chars = [...req, ...rest];
    for (let i = chars.length - 1; i > 0; i--) {
      const r = new Uint32Array(1);
      window.crypto.getRandomValues(r);
      const j = r[0] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
  }

  function score(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
    if (!pw) return { score: 0, label: "Empty", color: "var(--bsd-rule)" };
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
    const m = [
      { label: "Too short", color: "var(--bsd-sev-critical)" },
      { label: "Weak",      color: "var(--bsd-sev-critical)" },
      { label: "Fair",      color: "var(--bsd-sev-high)" },
      { label: "Good",      color: "var(--bsd-sev-medium)" },
      { label: "Strong",    color: "var(--bsd-sev-low)" },
    ] as const;
    return { score: s as 0 | 1 | 2 | 3 | 4, ...m[s] };
  }

  function suggest() {
    const pw = generatePassword();
    setSuggestedPw(pw);
    setPassword(pw);
    setShowPw(true);
    setCopied(false);
    try {
      navigator.clipboard?.writeText(pw).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      }).catch(() => {});
    } catch {}
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSuggestedPw(null);
    setShowPw(false);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "register") {
        if (password.length < 12) {
          setError("Password must be at least 12 characters.");
          return;
        }
        justRegistered.current = true;
        await register(email.trim(), password);
        push("Account created", "success", "Set up your founder profile.");
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const rid = err.requestId ? ` (request ${err.requestId})` : "";
        setError(`${err.message} [${err.status} ${err.code}]${rid}`);
      } else if (err instanceof TypeError) {
        setError(`Cannot reach backend at ${apiBaseUrl}. Is the server running?`);
      } else {
        setError(err instanceof Error ? err.message : "Authentication failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function oauth(provider: "google" | "facebook") {
    window.location.href = `${apiBaseUrl}/auth/oauth/${provider}/authorize`;
  }

  const st = score(password);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bsd-paper)", color: "var(--bsd-body)" }}>
      {/* Masthead */}
      <header
        style={{
          borderBottom: "3px double var(--bsd-ink)",
          padding: "16px 32px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}
      >
        <Link href="/" className="cursor-pointer" style={{ textDecoration: "none", display: "inline-flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: "Geist, sans-serif", fontWeight: 800, fontSize: 22, color: "var(--bsd-ink)", letterSpacing: "-0.04em", lineHeight: 1 }}>
            Clarifyd
          </span>
          <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700 }}>
            Sign in
          </span>
        </Link>
        <Link href="/contact" className="bsd-link cf-mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
          Need help <ArrowUpRight weight="bold" size={11} style={{ verticalAlign: "middle" }} />
        </Link>
      </header>

      <main
        style={{
          padding: "56px 32px 80px",
          maxWidth: 1280, margin: "0 auto",
          display: "grid", gridTemplateColumns: "minmax(0, 6fr) minmax(0, 6fr)", gap: 64, alignItems: "start",
        }}
        className="grid-cols-1 lg:grid-cols-2"
      >
        {/* Left editorial column */}
        <motion.aside
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EOQ }}
          style={{ display: "flex", flexDirection: "column", gap: 28 }}
        >
          <span className="bsd-kicker">
            {mode === "signin" ? "§ Welcome back" : "§ Open a reading room"}
          </span>
          <h1 style={{ margin: 0, fontSize: "clamp(48px, 7vw, 96px)", lineHeight: 0.95, letterSpacing: "-0.04em", color: "var(--bsd-ink)", fontWeight: 700 }}>
            {mode === "signin" ? (
              <>Sign in to your <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>workspace.</span></>
            ) : (
              <>Open a <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>founder account.</span></>
            )}
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: "var(--bsd-body)", lineHeight: 1.6, maxWidth: 440 }}>
            {mode === "signin"
              ? "Resume your contract reviews. Findings, drafts, and the audit chain are exactly where you left them."
              : "Three contracts a month, free forever. Drop your first SAFE in under sixty seconds after sign-up."}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 14, borderTop: "1px solid var(--bsd-hairline)" }}>
            <Bullet label="AES-256 at rest · TLS 1.3 in transit" />
            <Bullet label="JWT auth · bcrypt-12 password hashing" />
            <Bullet label="Hash-chained audit log on every action" />
          </div>
        </motion.aside>

        {/* Form panel */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EOQ, delay: 0.08 }}
          style={{ background: "var(--bsd-paper-deep)", border: "2px solid var(--bsd-ink)", padding: 32, display: "flex", flexDirection: "column", gap: 0 }}
        >
          {/* Tabs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1.5px solid var(--bsd-ink)", marginBottom: 26 }}>
            {(["signin", "register"] as Mode[]).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className="cursor-pointer cf-mono"
                  style={{
                    background: "transparent", border: "none",
                    paddingBottom: 12, marginBottom: -1.5,
                    borderBottom: active ? "3px solid var(--bsd-red)" : "3px solid transparent",
                    fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 800,
                    color: active ? "var(--bsd-ink)" : "var(--bsd-muted)",
                    transition: "color var(--dur-base) ease, border-color var(--dur-base) ease",
                  }}
                >
                  {m === "signin" ? "Sign in" : "Create"}
                </button>
              );
            })}
          </div>

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Field label={mode === "register" ? "Work email" : "Email"} htmlFor="lp-email">
              <input
                id="lp-email"
                type="email"
                autoComplete={mode === "register" ? "email" : "username"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@startup.com"
                className="bsd-input"
              />
            </Field>

            <Field label="Password" htmlFor="lp-pw">
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  id="lp-pw"
                  type={showPw ? "text" : "password"}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                  minLength={mode === "register" ? 12 : 1}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setSuggestedPw(null); }}
                  placeholder={mode === "register" ? "12+ characters" : "Your password"}
                  className="bsd-input"
                  style={{ paddingRight: 32 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="cursor-pointer"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  style={{ position: "absolute", right: 0, background: "transparent", border: "none", color: "var(--bsd-muted)", padding: 4 }}
                >
                  {showPw ? <EyeSlash weight="duotone" size={16} /> : <Eye weight="duotone" size={16} />}
                </button>
              </div>
              {mode === "register" ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                    <span style={{ display: "flex", gap: 3, flex: 1 }}>
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          style={{
                            height: 3, flex: 1,
                            background: i < st.score ? st.color : "var(--bsd-hairline)",
                            transition: "background 200ms ease",
                          }}
                        />
                      ))}
                    </span>
                    <span className="cf-mono" style={{ fontSize: 9.5, color: st.color, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800 }}>
                      {st.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={suggest}
                    className="cursor-pointer cf-mono"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "transparent", border: "none",
                      color: "var(--bsd-red)",
                      fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700,
                      padding: 0,
                    }}
                  >
                    <Sparkle weight="duotone" size={11} /> {suggestedPw ? (copied ? "Copied ✓" : "Generate again") : "Suggest a strong one"}
                  </button>
                </div>
              ) : null}
            </Field>

            {error ? (
              <div style={{ background: "var(--bsd-red-soft)", border: "1.5px solid var(--bsd-red)", padding: "10px 12px", fontSize: 12.5, color: "var(--bsd-red)", lineHeight: 1.55 }}>
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={submitting} className="bsd-btn bsd-btn--lg cursor-pointer" style={{ justifyContent: "center", position: "relative" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {mode === "signin" ? "Sign in" : "Create account"}
                {submitting ? (
                  <span aria-hidden style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "currentColor", animation: "bsd-pulse 0.9s ease-in-out infinite" }} />
                ) : (
                  <ArrowRight weight="bold" size={11} />
                )}
              </span>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--bsd-muted)" }}>
              <span style={{ flex: 1, height: 1, background: "var(--bsd-hairline)" }} />
              <span className="cf-mono" style={{ fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>or</span>
              <span style={{ flex: 1, height: 1, background: "var(--bsd-hairline)" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button type="button" onClick={() => oauth("google")} className="bsd-btn bsd-btn--ghost cursor-pointer">Google</button>
              <button type="button" onClick={() => oauth("facebook")} className="bsd-btn bsd-btn--ghost cursor-pointer">Facebook</button>
            </div>

            <p className="cf-mono" style={{ margin: "4px 0 0", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bsd-muted)", fontWeight: 600, textAlign: "center" }}>
              <ShieldCheck weight="duotone" size={11} color="var(--bsd-red)" style={{ verticalAlign: "middle", marginRight: 4 }} />
              AES-256 · JWT · audit-chained
            </p>
          </form>
        </motion.section>
      </main>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="bsd-field">
      <label htmlFor={htmlFor} className="cf-eyebrow" style={{ color: "var(--bsd-muted)", display: "block", marginBottom: 6 }}>
        {label}
      </label>
      {children}
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
