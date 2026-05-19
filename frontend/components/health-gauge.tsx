"use client";

/**
 * HealthGauge — Contract Health Score 0–100 radial.
 *
 * Spec: revamped-fronted.md §6.3
 *   - Animated SVG arc; spring (stiffness 80, damping 18), no bounce
 *   - Color band shifts rose → amber → teal across the 0–100 range
 *   - Center: number in Geist Mono, label below in eyebrow caps
 *   - prefers-reduced-motion: jump to final state, no rAF tween
 */

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState } from "react";

type Props = {
  score: number;             // 0..100
  size?: number;             // px
  label?: string;            // small caption beneath
  duration?: number;         // ms; 1100 default
};

function colorForScore(s: number): string {
  if (s < 35) return "var(--sev-critical)";
  if (s < 65) return "var(--sev-high)";
  if (s < 85) return "var(--brand-500)";
  return "var(--sev-low)";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function HealthGauge({
  score,
  size = 168,
  label = "Contract health",
  duration = 1100,
}: Props) {
  const stroke = Math.max(8, Math.round(size / 22));
  const r = size / 2 - stroke;
  const circumference = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(100, score));

  const progress = useMotionValue(0);
  const dash = useTransform(progress, (v) => circumference * (1 - v / 100));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      progress.set(target);
      setShown(target);
      return;
    }
    const controls = animate(progress, target, {
      duration: duration / 1000,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return controls.stop;
  }, [target, duration, progress]);

  const color = colorForScore(target);

  return (
    <div
      className="inline-flex flex-col items-center"
      style={{ gap: 10 }}
      role="img"
      aria-label={`${label}: ${target} of 100`}
    >
      <div style={{ position: "relative", width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ display: "block", transform: "rotate(-90deg)" }}
          aria-hidden
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: dash }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ink-primary)",
          }}
        >
          <span
            className="cf-mono tabular-nums"
            style={{
              fontSize: Math.round(size / 4),
              fontWeight: 500,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {shown}
          </span>
          <span
            style={{
              fontFamily: "Geist Mono, monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--ink-muted)",
              marginTop: 4,
            }}
          >
            of 100
          </span>
        </div>
      </div>
      <span
        className="cf-eyebrow"
        style={{ color: "var(--ink-secondary)" }}
      >
        {label}
      </span>
    </div>
  );
}
