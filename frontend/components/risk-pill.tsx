"use client";

/**
 * RiskPill — severity badge + label + optional confidence chip.
 *
 * Spec: revamped-fronted.md §6.1
 *   - icon + label (color never sole signal)
 *   - phosphor duotone, weight 1.5, size 14
 *   - spring entrance (140/18), pulse ring on `critical`
 *   - confidence in mono small caps if provided
 */

import { motion } from "framer-motion";
import {
  WarningOctagon,
  Warning,
  CheckCircle,
  Info,
} from "@phosphor-icons/react";

export type Severity = "critical" | "high" | "medium" | "low" | "clean";

const ICONS = {
  critical: WarningOctagon,
  high: Warning,
  medium: Warning,
  low: CheckCircle,
  clean: CheckCircle,
} as const;

export function RiskPill({
  severity,
  label,
  confidence,
}: {
  severity: Severity;
  label: string;
  confidence?: number;
}) {
  const Icon = ICONS[severity] ?? Info;
  const sevVar = `var(--sev-${severity})`;
  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 18 }}
      className="inline-flex items-center gap-1.5 cf-mono"
      style={{
        position: "relative",
        padding: "4px 10px",
        borderRadius: "var(--r-sm)",
        background: `color-mix(in oklch, ${sevVar} 10%, transparent)`,
        border: `1px solid color-mix(in oklch, ${sevVar} 35%, transparent)`,
        color: sevVar,
        fontSize: "0.6875rem",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        lineHeight: 1,
      }}
    >
      {severity === "critical" ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: -1,
            borderRadius: "var(--r-sm)",
            animation: "cf-pulse 1.6s var(--ease-out) infinite",
            pointerEvents: "none",
          }}
        />
      ) : null}
      <Icon weight="duotone" size={14} aria-hidden />
      <span>{label}</span>
      {confidence != null ? (
        <span
          style={{ opacity: 0.7, fontSize: "0.625rem", marginLeft: 2 }}
          aria-label={`Confidence ${confidence.toFixed(2)}`}
        >
          {confidence.toFixed(2)}
        </span>
      ) : null}
    </motion.span>
  );
}
