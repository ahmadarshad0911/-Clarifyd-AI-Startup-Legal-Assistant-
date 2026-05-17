"use client";

/**
 * Login + Register — dark editorial. Preserves all original auth logic
 * (password generator, strength meter, OAuth, error handling).
 */

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedPw, setSuggestedPw] = useState<string | null>(null);
  const [copiedHint, setCopiedHint] = useState(false);
  const justRegistered = useRef(false);

  // Override aurora body bg with dark canvas while mounted.
  useEffect(() => {
    const orig = document.body.style.background;
    document.body.style.background = "#020617";
    return () => {
      document.body.style.background = orig;
    };
  }, []);

  function generateStrongPassword(): string {
    const lowers = "abcdefghijkmnopqrstuvwxyz";
    const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const digits = "23456789";
    const symbols = "!@#$%^&*?-_+=";
    const all = lowers + uppers + digits + symbols;
    const pick = (set: string) => {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return set[buf[0] % set.length];
    };
    const required = [pick(lowers), pick(uppers), pick(digits), pick(symbols)];
    const rest = Array.from({ length: 12 }, () => pick(all));
    const chars = [...required, ...rest];
    for (let i = chars.length - 1; i > 0; i--) {
      const r = new Uint32Array(1);
      window.crypto.getRandomValues(r);
      const j = r[0] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
  }

  function scorePassword(pw: string): {
    score: 0 | 1 | 2 | 3 | 4;
    label: string;
    tone: string;
  } {
    if (!pw) return { score: 0, label: "Empty", tone: "bg-slate-700" };
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
    const map = [
      { label: "Too short", tone: "bg-rose-500" },
      { label: "Weak", tone: "bg-rose-500" },
      { label: "Fair", tone: "bg-amber-400" },
      { label: "Good", tone: "bg-sky-400" },
      { label: "Strong", tone: "bg-emerald-400" },
    ] as const;
    return { score: s as 0 | 1 | 2 | 3 | 4, ...map[s] };
  }

  function useSuggestion() {
    const pw = generateStrongPassword();
    setSuggestedPw(pw);
    setPassword(pw);
    setShowPw(true);
    setCopiedHint(false);
    try {
      navigator.clipboard?.writeText(pw).then(
        () => {
          setCopiedHint(true);
          window.setTimeout(() => setCopiedHint(false), 2200);
        },
        () => {},
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
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "register") {
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
        setError(
          `Cannot reach backend at ${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}. Is the FastAPI server running?`,
        );
      } else {
        setError(err instanceof Error ? err.message : "Authentication failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function oauthSignIn(provider: "google" | "facebook") {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    window.location.href = `${base}/auth/oauth/${provider}/authorize`;
  }

  const strength = scorePassword(password);

  return (
    <div
      className="min-h-screen text-slate-200 relative overflow-x-hidden"
      style={{
        background:
          "radial-gradient(ellipse 90% 50% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 50%), #020617",
        fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, #000 30%, transparent 100%)",
        }}
        aria-hidden
      />

      <main className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-12">
        <header className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-100 font-semibold tracking-tight cursor-pointer"
          >
            <span
              className="inline-block h-5 w-5 rounded-[6px]"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                boxShadow: "0 0 18px rgba(139,92,246,0.5)",
              }}
              aria-hidden
            />
            <span className="text-lg">Clarifyd</span>
          </Link>
          <p className="mt-3 text-sm text-slate-400 max-w-xs mx-auto">
            Contract analysis for founders. Sign in to your workspace.
          </p>
        </header>

        <div className="w-full max-w-[440px] rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm shadow-2xl p-8 md:p-9 relative z-10">
          {/* Mode toggle */}
          <div className="relative mb-7 grid grid-cols-2 rounded-full bg-slate-950/60 border border-white/10 p-1">
            {(["signin", "register"] as Mode[]).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`relative z-10 py-2 text-xs font-semibold uppercase tracking-wider rounded-full transition-colors duration-200 cursor-pointer ${
                    active ? "text-slate-950" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {m === "signin" ? "Sign in" : "Create account"}
                </button>
              );
            })}
            <div
              className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white transition-transform duration-300"
              style={{
                transform: mode === "signin" ? "translateX(0)" : "translateX(100%)",
              }}
              aria-hidden
            />
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                className="text-[10px] uppercase tracking-[0.14em] text-slate-500"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                htmlFor="lp-email"
              >
                {mode === "register" ? "Work email" : "Email"}
              </label>
              <input
                id="lp-email"
                type="email"
                autoComplete={mode === "register" ? "email" : "username"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@startup.com"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  className="text-[10px] uppercase tracking-[0.14em] text-slate-500"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  htmlFor="lp-pw"
                >
                  {mode === "register" ? "Password (≥ 6)" : "Password"}
                </label>
                {mode === "register" ? (
                  <button
                    type="button"
                    onClick={useSuggestion}
                    className="text-[10px] uppercase tracking-wider text-indigo-300 hover:text-indigo-200 font-semibold cursor-pointer"
                  >
                    ✨ Suggest strong
                  </button>
                ) : null}
              </div>
              <div className="relative mt-1.5">
                <input
                  id="lp-pw"
                  type={showPw ? "text" : "password"}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                  minLength={mode === "register" ? 6 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3.5 py-2.5 pr-12 text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 text-xs font-semibold cursor-pointer"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? "hide" : "show"}
                </button>
              </div>

              {mode === "register" ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex gap-1">
                      {[1, 2, 3, 4].map((seg) => (
                        <span
                          key={seg}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            seg <= strength.score ? strength.tone : "bg-slate-800"
                          }`}
                        />
                      ))}
                    </div>
                    <span
                      className="text-[10px] uppercase tracking-wider text-slate-500 min-w-[52px] text-right"
                      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {password ? strength.label : ""}
                    </span>
                  </div>
                  {suggestedPw ? (
                    <div className="flex items-center gap-2 rounded-lg bg-indigo-950/40 border border-indigo-500/20 px-3 py-2">
                      <span className="text-indigo-300 text-xs">🔑</span>
                      <code
                        className="flex-1 text-xs text-slate-100 truncate"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
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
                        className="text-[10px] uppercase tracking-wider text-indigo-300 hover:text-indigo-200 font-semibold cursor-pointer"
                      >
                        {copiedHint ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {mode === "signin" ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Use your registered email + password.</span>
                <button
                  type="button"
                  onClick={() => push("Password reset coming soon", "info")}
                  className="text-indigo-300 hover:text-indigo-200 font-semibold cursor-pointer"
                >
                  Forgot?
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                New accounts get the <span className="text-slate-300 font-semibold">reviewer</span> role —
                upload + analyze contracts.
              </p>
            )}

            {error ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-white text-slate-950 px-4 py-2.5 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
            >
              {submitting
                ? mode === "register"
                  ? "Creating…"
                  : "Signing in…"
                : mode === "register"
                  ? "Create account →"
                  : "Sign in →"}
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-white/5" />
              <span
                className="flex-shrink mx-3 text-[10px] uppercase tracking-[0.14em] text-slate-600"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              >
                or
              </span>
              <div className="flex-grow border-t border-white/5" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => oauthSignIn("google")}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/10 bg-slate-950/60 hover:bg-slate-900 text-slate-200 text-sm transition-colors duration-200 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
              <button
                type="button"
                onClick={() => oauthSignIn("facebook")}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/10 bg-slate-950/60 hover:bg-slate-900 text-slate-200 text-sm transition-colors duration-200 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
                  <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.43c0-3.01 1.79-4.68 4.53-4.68 1.31 0 2.69.24 2.69.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
                </svg>
                Facebook
              </button>
            </div>
          </form>
        </div>

        <footer className="mt-8 text-center space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors duration-200 cursor-pointer"
          >
            ← Back to landing
          </Link>
          <div
            className="flex items-center justify-center gap-5 text-[10px] uppercase tracking-[0.14em] text-slate-600"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            <Link href="/terms" className="hover:text-slate-400 cursor-pointer">
              Terms
            </Link>
            <Link href="/contact" className="hover:text-slate-400 cursor-pointer">
              Contact
            </Link>
            <span>not legal advice</span>
          </div>
        </footer>

        <div
          className="fixed bottom-6 right-6 hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5"
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"
            aria-hidden
          />
          <span
            className="text-[10px] uppercase tracking-[0.14em] text-slate-400"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            AES-256 · JWT · audit-chained
          </span>
        </div>
      </main>
    </div>
  );
}
