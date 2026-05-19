"use client";

/** /login/verify — Broadsheet · v6. Six-cell OTP. Logic preserved. */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardEvent, KeyboardEvent, Suspense,
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { motion } from "framer-motion";
import { Envelope, WarningOctagon, ArrowLeft } from "@phosphor-icons/react";

import { ApiClient, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useToast } from "../../../lib/toast";

const EOQ = [0.23, 1, 0.32, 1] as const;

export default function VerifyPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Inner />
    </Suspense>
  );
}

function Loading() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bsd-paper)", color: "var(--bsd-muted)" }}>
      Loading…
    </div>
  );
}

function Inner() {
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

  useEffect(() => { if (token) router.replace("/dashboard"); }, [token, router]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);
  useEffect(() => { inputs.current[0]?.focus(); }, []);

  const submit = useCallback(async (code: string) => {
    if (code.length !== 6) return;
    setSubmitting(true);
    setError(null);
    try {
      await verifyOtp(email, code);
      push("Verified", "success", "Welcome to Clarifyd.");
      router.replace("/terms?next=/onboarding/profile");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Couldn't verify the code. Try again.";
      setError(msg);
      setDigits(["", "", "", "", "", ""]);
      window.setTimeout(() => inputs.current[0]?.focus(), 60);
    } finally {
      setSubmitting(false);
    }
  }, [email, verifyOtp, router, push]);

  function onCellInput(i: number, raw: string) {
    const v = raw.replace(/\D/g, "").slice(0, 1);
    if (!v) {
      setDigits((d) => { const n = [...d]; n[i] = ""; return n; });
      return;
    }
    setDigits((d) => {
      const n = [...d]; n[i] = v;
      const full = n.join("");
      if (full.length === 6) window.setTimeout(() => submit(full), 0);
      return n;
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
    setDigits(text.split(""));
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
      const msg = err instanceof ApiError ? err.message : "Couldn't resend.";
      setError(msg);
      if (err instanceof ApiError && err.status === 429) {
        const m = msg.match(/wait\s+(\d+)\s*s/i);
        if (m) setCooldown(Number(m[1]));
      }
    }
  }

  if (!email) {
    return (
      <Shell>
        <div style={{ background: "var(--bsd-paper-deep)", border: "2px solid var(--bsd-ink)", padding: 36, textAlign: "center", maxWidth: 440 }}>
          <WarningOctagon weight="duotone" size={36} color="var(--bsd-red)" />
          <h1 style={{ marginTop: 14, fontSize: 26, fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.02em" }}>Missing email</h1>
          <p style={{ marginTop: 10, color: "var(--bsd-muted)", fontSize: 14, lineHeight: 1.55 }}>
            Open the verification link from your email, or start sign-up again.
          </p>
          <Link href="/login" className="bsd-btn cursor-pointer" style={{ marginTop: 22 }}>
            <ArrowLeft weight="bold" size={11} /> Back to sign in
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EOQ }}
        style={{ textAlign: "center", marginBottom: 28, maxWidth: 540 }}
      >
        <span className="bsd-kicker">§ Verification</span>
        <h1 style={{ marginTop: 14, fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.035em", lineHeight: 1 }}>
          Check your <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>inbox.</span>
        </h1>
        <p style={{ marginTop: 14, color: "var(--bsd-body)", fontSize: 15, lineHeight: 1.6 }}>
          Six-digit code sent to{" "}
          <span className="cf-mono" style={{ color: "var(--bsd-ink)", fontSize: 13, fontWeight: 700 }}>{email}</span>.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EOQ, delay: 0.08 }}
        style={{ width: "100%", maxWidth: 520, background: "var(--bsd-paper-deep)", border: "2px solid var(--bsd-ink)", padding: 32 }}
      >
        <div className="cf-eyebrow" style={{ color: "var(--bsd-muted)", textAlign: "center", marginBottom: 18 }}>
          Verification code
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
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
              style={{
                width: 48, height: 56,
                background: "var(--bsd-paper)",
                border: "1.5px solid var(--bsd-rule)",
                textAlign: "center",
                fontFamily: "Geist Mono, monospace", fontSize: 24,
                color: "var(--bsd-ink)", fontWeight: 700,
                outline: "none",
                opacity: submitting ? 0.6 : 1,
                transition: "border-color 200ms ease",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--bsd-red)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--bsd-rule)")}
            />
          ))}
        </div>

        {error ? (
          <div style={{ marginTop: 18, background: "var(--bsd-red-soft)", border: "1.5px solid var(--bsd-red)", padding: "10px 12px", fontSize: 12.5, color: "var(--bsd-red)", textAlign: "center" }}>
            {error}
          </div>
        ) : (
          <p style={{ marginTop: 18, fontSize: 12, color: "var(--bsd-muted)", textAlign: "center", lineHeight: 1.55 }}>
            Code expires in 10 minutes. Auto-submits when all 6 digits land.
          </p>
        )}

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0 || submitting}
            className="cursor-pointer cf-mono"
            style={{
              background: "transparent", border: "none",
              color: cooldown > 0 ? "var(--bsd-muted)" : "var(--bsd-red)",
              fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
              opacity: cooldown > 0 ? 0.5 : 1,
              cursor: cooldown > 0 ? "not-allowed" : "pointer",
            }}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new code"}
          </button>
          <Link href="/login" className="bsd-link cf-mono" style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
            ← Use a different email
          </Link>
        </div>
      </motion.div>

      <p style={{ marginTop: 24, textAlign: "center", maxWidth: 420, fontSize: 12, color: "var(--bsd-muted)", lineHeight: 1.55 }}>
        Can&rsquo;t find it? Check spam or promotions. Sender:{" "}
        <code className="cf-mono" style={{ color: "var(--bsd-ink)", fontWeight: 700 }}>onboarding@clarifyd.com</code>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bsd-paper)", color: "var(--bsd-body)", display: "flex", flexDirection: "column" }}>
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
            Verify
          </span>
        </Link>
        <Link href="/contact" className="bsd-link cf-mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
          Need help
        </Link>
      </header>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 24px" }}>
        {children}
      </main>
    </div>
  );
}
