"use client";

/**
 * OrbitalLoader — cream + oxblood, library aesthetic.
 *
 * Built per emil-design-eng:
 *   - Rotation: linear 1100ms (constant motion = linear, not eased)
 *   - Cross-fade status: 220ms ease-out (0.23, 1, 0.32, 1)
 *   - Only animates `transform` + `opacity` (GPU path)
 *   - prefers-reduced-motion: spinner becomes static glyph, status pins
 *     to first line
 *   - No glow, no blur, no orbital fluff. Single thin oxblood arc, one
 *     ink-serif glyph at center, mono caption beneath.
 *
 * Public API unchanged so every existing caller keeps working.
 */

import { CSSProperties, useEffect, useState } from "react";

type Props = {
  fullscreen?: boolean;
  statusLines?: string[];
  label?: string;
};

const INK = "#1F0F0F";
const INK_MUTED = "#6F5C5C";
const CREAM = "#F7F1E8";
const RULE = "rgba(31, 15, 15, 0.14)";
const OXBLOOD = "#6B1F1F";
const SERIF = "'Fraunces', 'PP Editorial', Georgia, serif";
const MONO = "'IBM Plex Mono', 'JetBrains Mono', Menlo, monospace";
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

const DEFAULT_STATUS = ["Decrypting…", "Analyzing architecture…", "Mapping risk…"];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Cycles through `lines` every 2.2s with a 220ms cross-fade.
 *  Only ONE line in DOM at a time. */
function RotatingStatus({ lines }: { lines: string[] }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (lines.length <= 1) return;
    if (prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIdx((i) => (i + 1) % lines.length);
        setVisible(true);
      }, 220);
    }, 2200);
    return () => clearInterval(id);
  }, [lines.length]);

  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: INK_MUTED,
        fontWeight: 600,
        opacity: visible ? 1 : 0,
        transition: `opacity 220ms ${EASE_OUT}`,
        display: "inline-block",
      }}
    >
      {lines[idx] ?? ""}
    </span>
  );
}

export function OrbitalLoader({ fullscreen = true, statusLines, label }: Props) {
  const status = statusLines && statusLines.length > 0 ? statusLines : DEFAULT_STATUS;

  const wrap: CSSProperties = fullscreen
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(247, 241, 232, 0.92)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        fontFamily: SERIF,
      }
    : {
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: 12,
        fontFamily: SERIF,
      };

  return (
    <div style={wrap} role="status" aria-live="polite">
      <div className="flex flex-col items-center" style={{ gap: 18 }}>
        <Spinner />
        {label ? (
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: INK_MUTED,
              fontWeight: 600,
            }}
          >
            {label}
          </span>
        ) : (
          <RotatingStatus lines={status} />
        )}
      </div>

      {/* Inline keyframes — `transform: rotate` only (GPU path).
          Gated on prefers-reduced-motion: animation becomes none, glyph
          stays still. */}
      <style jsx>{`
        @keyframes ol-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.ol-arc) { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/** Thin oxblood arc rotating once every 1100ms (linear, per emil's
 *  "constant motion = linear" rule). Center holds a static serif glyph. */
function Spinner() {
  return (
    <div
      style={{
        position: "relative",
        width: 56,
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Background ring — full circle, very faint */}
      <svg
        viewBox="0 0 56 56"
        width={56}
        height={56}
        style={{ position: "absolute", inset: 0 }}
        aria-hidden
      >
        <circle
          cx={28}
          cy={28}
          r={24}
          fill="none"
          stroke={RULE}
          strokeWidth={1.5}
        />
      </svg>
      {/* Rotating arc — single quarter, oxblood */}
      <svg
        viewBox="0 0 56 56"
        width={56}
        height={56}
        className="ol-arc"
        style={{
          position: "absolute",
          inset: 0,
          animation: `ol-spin 1100ms linear infinite`,
          willChange: "transform",
        }}
        aria-hidden
      >
        <circle
          cx={28}
          cy={28}
          r={24}
          fill="none"
          stroke={OXBLOOD}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={`28 122`}
          transform="rotate(-90 28 28)"
        />
      </svg>
      {/* Static center glyph — serif ampersand for editorial feel */}
      <span
        aria-hidden
        style={{
          fontFamily: SERIF,
          fontSize: 22,
          color: INK,
          fontWeight: 500,
          lineHeight: 1,
        }}
      >
        &amp;
      </span>
    </div>
  );
}
