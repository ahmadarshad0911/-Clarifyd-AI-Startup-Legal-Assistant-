"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";

type Mode = "signin" | "register";

export default function LoginPage() {
  const { login, register, token } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("admin");
  const [password, setPassword] = useState("123");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedPw, setSuggestedPw] = useState<string | null>(null);
  const [copiedHint, setCopiedHint] = useState(false);
  const justRegistered = useRef(false);

  // Generate a 16-char strong password using crypto.getRandomValues.
  // Guarantees ≥1 lower, ≥1 upper, ≥1 digit, ≥1 symbol.
  function generateStrongPassword(): string {
    const lowers = "abcdefghijkmnopqrstuvwxyz"; // no l
    const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O
    const digits = "23456789"; // no 0/1
    const symbols = "!@#$%^&*?-_+=";
    const all = lowers + uppers + digits + symbols;
    const pick = (set: string) => {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return set[buf[0] % set.length];
    };
    const required = [pick(lowers), pick(uppers), pick(digits), pick(symbols)];
    const len = 16;
    const rest = Array.from({ length: len - required.length }, () => pick(all));
    const chars = [...required, ...rest];
    // Fisher–Yates shuffle with crypto randomness
    for (let i = chars.length - 1; i > 0; i--) {
      const r = new Uint32Array(1);
      window.crypto.getRandomValues(r);
      const j = r[0] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
  }

  // 0..4 strength score with label + tailwind class
  function scorePassword(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; tone: string } {
    if (!pw) return { score: 0, label: "Empty", tone: "bg-on-surface-variant/30" };
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
    const map = [
      { label: "Too short", tone: "bg-status-danger" },
      { label: "Weak", tone: "bg-status-danger" },
      { label: "Fair", tone: "bg-status-warn" },
      { label: "Good", tone: "bg-status-info" },
      { label: "Strong", tone: "bg-status-success" },
    ] as const;
    return { score: s as 0 | 1 | 2 | 3 | 4, ...map[s] };
  }

  function useSuggestion() {
    const pw = generateStrongPassword();
    setSuggestedPw(pw);
    setPassword(pw);
    setShowPw(true);
    setCopiedHint(false);
    // Attempt clipboard copy — silently ignore if blocked.
    try {
      navigator.clipboard?.writeText(pw).then(
        () => {
          setCopiedHint(true);
          window.setTimeout(() => setCopiedHint(false), 2200);
        },
        () => {}
      );
    } catch {}
  }

  useEffect(() => {
    if (!token) return;
    if (justRegistered.current) {
      router.replace("/terms?next=/onboarding/profile");
    } else {
      router.replace("/dashboard");
    }
  }, [token, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSuggestedPw(null);
    setCopiedHint(false);
    setShowPw(false);
    if (next === "register") {
      setEmail("");
      setPassword("");
    } else {
      setEmail("admin");
      setPassword("123");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "register") {
        await register(email.trim(), password);
        push(
          "Check your email",
          "success",
          "We sent a 6-digit code to " + email.trim()
        );
        // Bounce to OTP entry — no token yet until they verify.
        router.replace(
          `/login/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`
        );
        return;
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const rid = err.requestId ? ` (request ${err.requestId})` : "";
        setError(`${err.message} [${err.status} ${err.code}]${rid}`);
      } else if (err instanceof TypeError) {
        setError(
          `Cannot reach backend at ${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}. Is the FastAPI server running?`
        );
      } else {
        setError(err instanceof Error ? err.message : "Authentication failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function oauthSignIn(provider: "google" | "facebook") {
    const base =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    window.location.href = `${base}/auth/oauth/${provider}/authorize`;
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Aurora background */}
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="aurora-bg">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
          <div className="blob blob-4" />
        </div>
      </div>

      <main className="min-h-screen w-full flex flex-col items-center justify-center px-margin-mobile md:px-margin-desktop py-12">
        <header className="mb-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-[32px]">gavel</span>
            <h1 className="font-display-hero text-h1 text-onboarding-navy tracking-tight">Clarifyd</h1>
          </div>
          <p className="text-on-surface-variant max-w-xs mx-auto">
            Foundational security for forward-thinking founders.
          </p>
        </header>

        <div className="crystal-glass w-full max-w-[440px] rounded-3xl p-8 md:p-10 relative z-10">
          {/* Mode toggle */}
          <div className="relative bg-white/40 p-1.5 rounded-full mb-8 flex border border-white/60">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className={`flex-1 py-2 font-label-caps text-label-caps uppercase rounded-full z-10 transition-colors ${
                mode === "signin" ? "text-white" : "text-on-surface-variant"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`flex-1 py-2 font-label-caps text-label-caps uppercase rounded-full z-10 transition-colors ${
                mode === "register" ? "text-white" : "text-on-surface-variant"
              }`}
            >
              Create account
            </button>
            <div
              className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-gradient-to-r from-primary to-accent-violet rounded-full shadow-sm transition-all duration-300"
              style={{ left: mode === "signin" ? "6px" : "calc(50% + 0px)" }}
              aria-hidden
            />
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <label className="flex flex-col gap-1">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                {mode === "register" ? "Work email address" : "Username or email"}
              </span>
              <input
                type={mode === "register" ? "email" : "text"}
                autoComplete={mode === "register" ? "email" : "username"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/70 border border-white/70 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              />
            </label>

            <label className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                  {mode === "register" ? "Secure password (min 6 chars)" : "Password"}
                </span>
                {mode === "register" ? (
                  <button
                    type="button"
                    onClick={useSuggestion}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary hover:text-accent-violet transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                    Suggest strong password
                  </button>
                ) : null}
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                  minLength={mode === "register" ? 6 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/70 border border-white/70 rounded-xl px-4 py-3 pr-12 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPw ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>

              {mode === "register" ? (
                <div className="mt-2 space-y-2">
                  {/* Strength meter — 4 segment bars */}
                  {(() => {
                    const s = scorePassword(password);
                    return (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex gap-1">
                          {[1, 2, 3, 4].map((seg) => (
                            <span
                              key={seg}
                              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                seg <= s.score ? s.tone : "bg-white/50"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant min-w-[60px] text-right">
                          {password ? s.label : ""}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Suggested password chip — appears after click */}
                  {suggestedPw ? (
                    <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2">
                      <span className="material-symbols-outlined text-primary text-[16px]">key</span>
                      <code className="flex-1 text-[12px] font-mono text-onboarding-navy truncate">
                        {suggestedPw}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            navigator.clipboard?.writeText(suggestedPw);
                            setCopiedHint(true);
                            window.setTimeout(() => setCopiedHint(false), 2200);
                          } catch {}
                        }}
                        className="text-[11px] font-semibold uppercase tracking-wider text-primary hover:text-accent-violet"
                      >
                        {copiedHint ? "Copied" : "Copy"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-on-surface-variant/80 leading-snug">
                      Tip: mix upper, lower, digits, symbols — or tap{" "}
                      <span className="text-primary font-semibold">Suggest strong password</span> for
                      a 16-char one-time secret.
                    </p>
                  )}
                </div>
              ) : null}
            </label>

            {mode === "signin" ? (
              <div className="flex items-center justify-between">
                <span className="text-body-sm text-on-surface-variant">
                  Demo: <code>admin</code> / <code>123</code>
                </span>
                <button
                  type="button"
                  onClick={() => push("Password reset coming soon", "info")}
                  className="text-body-sm text-primary font-semibold hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            ) : (
              <p className="text-body-sm text-on-surface-variant">
                New accounts get the <strong>reviewer</strong> role — upload and analyze contracts.
              </p>
            )}

            {error ? <p className="error">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="btn-capsule btn-capsule-primary w-full text-body-lg"
            >
              {submitting
                ? mode === "register"
                  ? "Creating…"
                  : "Signing in…"
                : mode === "register"
                ? "Create account"
                : "Access dashboard"}
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-white/50" />
              <span className="flex-shrink mx-4 font-label-caps text-label-caps uppercase text-on-surface-variant/60">
                Or secure auth
              </span>
              <div className="flex-grow border-t border-white/50" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => oauthSignIn("google")}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/40 border border-white/60 hover:bg-white/60 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-status-warn">public</span>
                <span className="font-label-caps text-label-caps">Google</span>
              </button>
              <button
                type="button"
                onClick={() => oauthSignIn("facebook")}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/40 border border-white/60 hover:bg-white/60 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
                  <path
                    fill="#1877F2"
                    d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.014 1.792-4.678 4.533-4.678 1.313 0 2.686.235 2.686.235v2.964h-1.513c-1.491 0-1.956.93-1.956 1.886v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073Z"
                  />
                </svg>
                <span className="font-label-caps text-label-caps">Facebook</span>
              </button>
            </div>
          </form>
        </div>

        <footer className="mt-10 text-center space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-body-sm text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to overview
          </Link>
          <div className="flex items-center justify-center gap-6">
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant/60">
              Privacy
            </span>
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant/60">
              Legal terms
            </span>
            <span className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant/60">
              Decision-support only — not legal advice
            </span>
          </div>
        </footer>
      </main>

      <div className="fixed bottom-6 right-6 hidden md:flex items-center gap-3 crystal-glass px-4 py-2 rounded-full">
        <div className="w-2 h-2 bg-status-success rounded-full animate-pulse" />
        <span className="font-label-caps text-[10px] uppercase tracking-wider text-on-surface">
          AES-256 encrypted environment
        </span>
      </div>
    </div>
  );
}
