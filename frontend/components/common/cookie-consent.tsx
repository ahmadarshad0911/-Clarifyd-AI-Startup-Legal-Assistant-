"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "clarifyd.cookie-consent";

type Decision = {
  choice: "all" | "essential";
  prefs: { essential: true; analytics: boolean; marketing: boolean };
  decided_at: string;
};

type Mode = "hidden" | "banner" | "manage";

export function CookieConsent() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [exiting, setExiting] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    // Defer mount until after first paint so it doesn't fight the route reveal.
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) setMode("banner");
      } catch {
        setMode("banner");
      }
    }, 650);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  function persist(decision: Decision) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decision));
    } catch {
      // storage unavailable — non-fatal, popup closes anyway
    }
  }

  function dismiss(after: () => void) {
    setExiting(true);
    window.setTimeout(() => {
      after();
      setMode("hidden");
      setExiting(false);
    }, 380);
  }

  function acceptAll() {
    dismiss(() =>
      persist({
        choice: "all",
        prefs: { essential: true, analytics: true, marketing: true },
        decided_at: new Date().toISOString(),
      })
    );
  }

  function savePreferences() {
    dismiss(() =>
      persist({
        choice: analytics && marketing ? "all" : "essential",
        prefs: { essential: true, analytics, marketing },
        decided_at: new Date().toISOString(),
      })
    );
  }

  function rejectOptional() {
    dismiss(() =>
      persist({
        choice: "essential",
        prefs: { essential: true, analytics: false, marketing: false },
        decided_at: new Date().toISOString(),
      })
    );
  }

  if (mode === "hidden") return null;

  return (
    <div
      className={`fixed bottom-24 md:bottom-8 right-4 md:right-10 left-4 md:left-auto z-[120] md:w-[440px] ${
        exiting ? "cookie-popup-exit" : "cookie-popup-enter"
      }`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
    >
      <div
        className="crystal-glass rounded-[2rem] p-7 md:p-8 relative overflow-hidden border border-white/50 shadow-2xl"
        style={{ background: "rgba(255,255,255,0.92)" }}
      >
        {/* Luminous halo */}
        <div
          className="cookie-halo absolute -top-24 -left-24 w-56 h-56 bg-primary/15 rounded-full pointer-events-none"
          style={{ filter: "blur(60px)" }}
          aria-hidden
        />
        <div
          className="cookie-halo absolute -bottom-20 -right-20 w-48 h-48 bg-accent-violet/15 rounded-full pointer-events-none"
          style={{ filter: "blur(60px)", animationDelay: "-2s" }}
          aria-hidden
        />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined">cookie</span>
            </div>
            <h2 id="cookie-title" className="font-display-hero text-h3 text-onboarding-navy m-0">
              Cookie Intelligence
            </h2>
          </div>

          {mode === "banner" ? (
            <>
              <p className="text-body-sm text-on-surface-variant leading-relaxed mb-6">
                Essential cookies keep your legal workspace secure. Optional analytics help us
                refine our Kimi reasoning engine.{" "}
                <span className="font-semibold text-onboarding-navy">Privacy is our default.</span>
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={acceptAll}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-primary to-accent-violet text-white font-bold text-[11px] uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-primary/30 hover:scale-[1.02] transition-all duration-300 active:scale-95"
                >
                  Accept All
                </button>
                <button
                  type="button"
                  onClick={() => setMode("manage")}
                  className="w-full py-3.5 px-6 border border-white/60 text-onboarding-navy font-bold text-[11px] uppercase tracking-widest rounded-2xl hover:bg-white/70 hover:scale-[1.02] transition-all duration-300 active:scale-95 bg-white/80"
                >
                  Manage Preferences
                </button>
                <button
                  type="button"
                  onClick={rejectOptional}
                  className="text-[11px] text-on-surface-variant hover:text-primary underline-offset-2 hover:underline transition-colors mt-1"
                >
                  Essential only
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-body-sm text-on-surface-variant leading-relaxed mb-4">
                Choose what data Clarifyd may collect. Essential cookies cannot be disabled.
              </p>
              <div className="flex flex-col gap-3 mb-6">
                <PrefRow
                  title="Essential"
                  description="Authentication, security, session state."
                  enabled
                  locked
                  onToggle={() => {}}
                />
                <PrefRow
                  title="Analytics"
                  description="Anonymous usage to improve reasoning models."
                  enabled={analytics}
                  onToggle={() => setAnalytics((v) => !v)}
                />
                <PrefRow
                  title="Marketing"
                  description="Personalized offers across Clarifyd surfaces."
                  enabled={marketing}
                  onToggle={() => setMarketing((v) => !v)}
                />
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={savePreferences}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-primary to-accent-violet text-white font-bold text-[11px] uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-primary/30 hover:scale-[1.02] transition-all duration-300 active:scale-95"
                >
                  Save preferences
                </button>
                <button
                  type="button"
                  onClick={() => setMode("banner")}
                  className="text-[11px] text-on-surface-variant hover:text-primary transition-colors"
                >
                  ← Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PrefRow({
  title,
  description,
  enabled,
  locked,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  locked?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 p-3 rounded-xl bg-white/60 border border-white/70 transition-colors ${
        locked ? "" : "cursor-pointer hover:bg-white/80"
      }`}
    >
      <div className="min-w-0">
        <p className="font-bold text-body-sm text-onboarding-navy m-0 flex items-center gap-2">
          {title}
          {locked ? (
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-label-caps bg-black/5 px-1.5 py-0.5 rounded-full">
              Always on
            </span>
          ) : null}
        </p>
        <p className="text-[11px] text-on-surface-variant m-0">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        disabled={locked}
        onClick={(e) => {
          e.preventDefault();
          if (!locked) onToggle();
        }}
        className={`shrink-0 relative w-12 h-7 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors duration-300 ${
          enabled
            ? "bg-gradient-to-r from-primary to-accent-violet shadow-inner shadow-primary/30"
            : "bg-black/15"
        } ${locked ? "opacity-70 cursor-not-allowed" : "cursor-pointer active:scale-95"}`}
      >
        <span
          className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center"
          style={{
            transform: enabled ? "translateX(20px)" : "translateX(0)",
            transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <span
            className="material-symbols-outlined text-[14px] transition-colors"
            style={{ color: enabled ? "#3525cd" : "#777587" }}
          >
            {enabled ? "check" : "close"}
          </span>
        </span>
      </button>
    </label>
  );
}
