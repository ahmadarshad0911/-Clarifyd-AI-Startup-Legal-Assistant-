"use client";

/**
 * /login/verify — post-signup OTP verification. Dark editorial.
 * All original logic preserved (segmented inputs, paste, resend cooldown).
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardEvent,
  KeyboardEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ApiClient, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useToast } from "../../../lib/toast";

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#020617" }}
        >
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}

function VerifyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { verifyOtp, token } = useAuth();
  const { push } = useToast();

  const email = useMemo(() => params.get("email") ?? "", [params]);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(45);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  // Override body bg
  useEffect(() => {
    const orig = document.body.style.background;
    document.body.style.background = "#020617";
    return () => {
      document.body.style.background = orig;
    };
  }, []);

  useEffect(() => {
    if (token) router.replace("/dashboard");
  }, [token, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const submit = useCallback(
    async (code: string) => {
      if (code.length !== 6) return;
      setSubmitting(true);
      setError(null);
      try {
        await verifyOtp(email, code);
        push("Verified", "success", "Welcome to Clarifyd.");
        router.replace("/terms?next=/onboarding/profile");
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Couldn't verify the code. Try again.";
        setError(msg);
        setDigits(["", "", "", "", "", ""]);
        window.setTimeout(() => inputs.current[0]?.focus(), 60);
      } finally {
        setSubmitting(false);
      }
    },
    [email, verifyOtp, router, push],
  );

  function onCellInput(i: number, raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 1);
    if (!v) {
      setDigits((d) => {
        const next = [...d];
        next[i] = "";
        return next;
      });
      return;
    }
    setDigits((d) => {
      const next = [...d];
      next[i] = v;
      const full = next.join("");
      if (full.length === 6) window.setTimeout(() => submit(full), 0);
      return next;
    });
    if (i < 5) inputs.current[i + 1]?.focus();
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) inputs.current[i + 1]?.focus();
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length < 6) return;
    e.preventDefault();
    const chars = text.split("");
    setDigits(chars);
    inputs.current[5]?.focus();
    window.setTimeout(() => submit(text), 0);
  }

  async function resend() {
    if (cooldown > 0 || submitting) return;
    setError(null);
    try {
      const res = await new ApiClient(() => null).resendOtp({ email });
      setCooldown(60);
      push("New code sent", "success", `Expires in ${Math.round(res.expires_in / 60)} min.`);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Couldn't resend the code right now.";
      setError(msg);
      if (err instanceof ApiError && err.status === 429) {
        const m = msg.match(/wait\s+(\d+)\s*s/i);
        if (m) setCooldown(Number(m[1]));
      }
    }
  }

  const wrapper = {
    background:
      "radial-gradient(ellipse 90% 50% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 50%), #020617",
    fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
  } as const;

  if (!email) {
    return (
      <div
        className="min-h-screen text-slate-200 flex items-center justify-center px-6"
        style={wrapper}
      >
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm p-8 text-center">
          <div className="text-3xl text-amber-400 mb-2">⚠</div>
          <h1 className="text-xl text-white font-semibold tracking-tight">
            Missing email
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Open the verification link from your email, or start signup again.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex rounded-lg bg-white text-slate-950 px-4 py-2 text-sm font-semibold hover:bg-slate-200 cursor-pointer"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-slate-200 relative overflow-x-hidden"
      style={wrapper}
    >
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

      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <header className="mb-8 text-center max-w-md">
          <div className="text-4xl mb-3">✉</div>
          <h1 className="text-2xl text-white font-semibold tracking-tight">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            We sent a 6-digit code to{" "}
            <span
              className="text-slate-100 font-semibold break-all"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {email}
            </span>
            . Enter it below to finish signing up.
          </p>
        </header>

        <div className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm shadow-2xl p-7 md:p-9">
          <div
            className="text-[10px] uppercase tracking-[0.14em] text-slate-500 text-center mb-4"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            verification code
          </div>
          <div className="flex justify-center gap-2 sm:gap-2.5">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="\d*"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={d}
                onChange={(e) => onCellInput(i, e.target.value)}
                onKeyDown={(e) => onKey(i, e)}
                onPaste={onPaste}
                aria-label={`Digit ${i + 1} of 6`}
                disabled={submitting}
                className="w-11 h-12 sm:w-12 sm:h-14 rounded-lg border border-white/10 bg-slate-950/60 text-center text-xl font-semibold text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all disabled:opacity-60"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
              />
            ))}
          </div>

          {error ? (
            <div className="mt-5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-300 text-center">
              ⚠ {error}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center mt-5">
              Code expires in 10 minutes. Auto-submits when all 6 digits are entered.
            </p>
          )}

          <div className="mt-7 flex flex-col items-center gap-2.5">
            <button
              type="button"
              onClick={resend}
              disabled={cooldown > 0 || submitting}
              className="text-[11px] uppercase tracking-wider text-indigo-300 hover:text-indigo-200 font-semibold disabled:opacity-40 disabled:hover:text-indigo-300 cursor-pointer transition-colors duration-200"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new code"}
            </button>
            <Link
              href="/login"
              className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer transition-colors duration-200"
            >
              ← Use a different email
            </Link>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-6 text-center max-w-sm">
          Can&rsquo;t find it? Check spam / promotions. Sender:{" "}
          <code
            className="text-slate-300"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            onboarding@clarifyd.com
          </code>
        </p>
      </main>
    </div>
  );
}
