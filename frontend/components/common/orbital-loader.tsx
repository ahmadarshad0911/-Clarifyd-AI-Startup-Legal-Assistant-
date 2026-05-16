"use client";

import { useEffect, useState } from "react";

type Props = {
  /** Cover the whole viewport with a fixed overlay. Default true. */
  fullscreen?: boolean;
  /** Optional override for the rotating status lines. */
  statusLines?: string[];
  /** Single static label instead of the cycling lines. */
  label?: string;
};

const DEFAULT_STATUS = ["Decrypting…", "Analyzing architecture…", "Mapping risk…"];

/** Cycles through `lines` every 2.2s with a soft cross-fade.
 *  Only ONE line is in the DOM at a time — no stacking / overlap possible. */
function RotatingStatus({ lines }: { lines: string[] }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (lines.length <= 1) return;
    // Respect prefers-reduced-motion: pin to first line, no rotation.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(() => {
      // Fade out, swap text, fade in.
      setVisible(false);
      window.setTimeout(() => {
        setIdx((p) => (p + 1) % lines.length);
        setVisible(true);
      }, 250);
    }, 2200);
    return () => clearInterval(id);
  }, [lines]);

  return (
    <p
      className="font-display-hero text-h3 text-onboarding-navy italic tracking-wide m-0"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
    >
      {lines[idx]}
    </p>
  );
}

export function OrbitalLoader({ fullscreen = true, statusLines, label }: Props) {
  const lines = statusLines ?? DEFAULT_STATUS;
  const wrapper = fullscreen
    ? "fixed inset-0 z-[200] flex flex-col items-center justify-center aurora-bg"
    : "relative flex flex-col items-center justify-center py-12";

  return (
    <div className={wrapper} role="status" aria-live="polite">
      {fullscreen ? (
        <div className="absolute inset-0 bg-on-surface/5 backdrop-blur-[2px] pointer-events-none" />
      ) : null}

      <div className="relative flex items-center justify-center w-64 h-64 md:w-80 md:h-80">
        <div className="absolute inset-0 bg-accent-violet/10 blur-[80px] rounded-full" />
        <div className="absolute w-60 h-60 md:w-72 md:h-72 rounded-full border border-primary/20 orbital-ring-1" />
        <div className="absolute w-48 h-48 md:w-60 md:h-60 rounded-full border-[3px] border-transparent border-t-accent-violet/60 border-l-primary/40 orbital-ring-2" />
        <div className="absolute w-36 h-36 md:w-44 md:h-44 rounded-full border-[4px] border-transparent border-t-primary border-b-accent-indigo orbital-ring-3" />
        <div className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full scanning-beam z-30 pointer-events-none" />
        <div className="absolute w-28 h-28 md:w-32 md:h-32 rounded-full bg-white/70 backdrop-blur-2xl border border-white/60 shadow-2xl z-40 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[#22d3ee]/5 blur-xl" />
          <div className="pulse-soft relative">
            <span
              className="material-symbols-outlined text-5xl text-onboarding-navy"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              security
            </span>
          </div>
        </div>
      </div>

      <div className="mt-10 text-center z-50">
        <div className="h-8 flex items-center justify-center">
          {label ? (
            <p className="font-display-hero text-h3 text-onboarding-navy italic tracking-wide m-0">
              {label}
            </p>
          ) : (
            <RotatingStatus lines={lines} />
          )}
        </div>
        <p className="mt-6 text-body-sm text-on-surface-variant max-w-xs mx-auto opacity-80">
          Your documents are encrypted with banking-grade security and processed for analysis.
        </p>
      </div>
    </div>
  );
}
