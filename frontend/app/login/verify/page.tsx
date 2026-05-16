"use client";

/**
 * /login/verify — post-signup OTP verification.
 *
 * Flow:
 *   1. /login (register mode) → POST /auth/register (no token issued)
 *   2. Bounce to /login/verify?email=<addr>
 *   3. User enters 6-digit code → POST /auth/verify-otp → token returned
 *   4. Stored to localStorage, redirected to /terms (new user) → /onboarding
 *
 * UX:
 *   - 6 segmented inputs, auto-advance on type, backspace jumps back.
 *   - Paste a 6-digit code into any cell → fills all six + auto-submits.
 *   - Resend button with 60s cooldown timer.
 *   - Clear "wrong code" + "expired" error states surfaced from backend.
 *   - All motion respects prefers-reduced-motion.
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

import { AuroraBackground } from "../../../components/common/aurora-background";
import { ApiClient, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useToast } from "../../../lib/toast";

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen">
          <AuroraBackground />
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
  const [cooldown, setCooldown] = useState(45); // first allowed resend
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  // Already signed in? Go straight to dashboard.
  useEffect(() => {
    if (token) router.replace("/dashboard");
  }, [token, router]);

  // Cooldown tick.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // Focus first cell on mount.
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
        // Clear the cells so user can retype.
        setDigits(["", "", "", "", "", ""]);
        window.setTimeout(() => inputs.current[0]?.focus(), 60);
      } finally {
        setSubmitting(false);
      }
    },
    [email, verifyOtp, router, push]
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
      if (full.length === 6) {
        // Defer to next tick so React state settles before submit.
        window.setTimeout(() => submit(full), 0);
      }
      return next;
    });
    if (i < 5) inputs.current[i + 1]?.focus();
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
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
        err instanceof ApiError
          ? err.message
          : "Couldn't resend the code right now.";
      setError(msg);
      if (err instanceof ApiError && err.status === 429) {
        // Backend told us exactly how long to wait — pull it out of the
        // human-readable message ("Please wait Ns before...").
        const m = msg.match(/wait\s+(\d+)\s*s/i);
        if (m) setCooldown(Number(m[1]));
      }
    }
  }

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 relative">
        <AuroraBackground />
        <div className="crystal-glass rounded-3xl p-8 max-w-md text-center relative z-10">
          <span className="material-symbols-outlined text-status-warn text-[48px] block mb-2">
            error
          </span>
          <h1 className="font-display-hero text-h2 text-onboarding-navy m-0">
            Missing email
          </h1>
          <p className="text-on-surface-variant mt-2">
            Open the verification link from your email, or start signup again.
          </p>
          <Link href="/login" className="btn-capsule btn-capsule-primary mt-6">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="aurora-bg">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
          <div className="blob blob-4" />
        </div>
      </div>

      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-[32px]">
              mark_email_unread
            </span>
            <h1 className="font-display-hero text-h1 text-onboarding-navy tracking-tight m-0">
              Check your email
            </h1>
          </div>
          <p className="text-on-surface-variant max-w-sm mx-auto">
            We sent a 6-digit code to{" "}
            <strong className="text-onboarding-navy break-all">{email}</strong>. Enter it
            below to finish signing up.
          </p>
        </header>

        <div className="crystal-glass w-full max-w-[460px] rounded-3xl p-7 md:p-9 relative z-10">
          <label className="font-label-caps text-label-caps uppercase text-on-surface-variant block text-center mb-4">
            Verification code
          </label>
          <div className="flex justify-center gap-2 sm:gap-3">
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
                className="otp-cell"
              />
            ))}
          </div>

          {error ? (
            <p className="text-status-danger text-body-sm text-center mt-5 m-0">
              <span className="material-symbols-outlined text-[16px] align-middle mr-1">
                error
              </span>
              {error}
            </p>
          ) : (
            <p className="text-on-surface-variant/70 text-[12px] text-center mt-5 m-0">
              Code expires in 10 minutes. Auto-submits when all 6 digits are entered.
            </p>
          )}

          <div className="mt-7 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={resend}
              disabled={cooldown > 0 || submitting}
              className="text-[12px] font-bold uppercase tracking-wider text-primary hover:text-accent-violet disabled:opacity-50 disabled:hover:text-primary transition-colors"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new code"}
            </button>
            <Link
              href="/login"
              className="text-[11px] text-on-surface-variant hover:text-primary transition-colors"
            >
              ← Use a different email
            </Link>
          </div>
        </div>

        <p className="text-[11px] text-on-surface-variant/70 mt-6 text-center max-w-sm">
          Can&rsquo;t find it? Check spam / promotions. The sender is{" "}
          <code>onboarding@clarifyd.com</code>.
        </p>
      </main>
    </div>
  );
}
