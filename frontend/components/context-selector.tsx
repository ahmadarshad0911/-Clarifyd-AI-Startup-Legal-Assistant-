"use client";

/**
 * ContextSelector — jurisdiction + stage + role chip rows.
 *
 * Spec: revamped-fronted.md §6.5
 *   - Three radiogroups stacked, each aria-labeled
 *   - Country chips use code text + tinted dot (NO flag emoji — §6.5 ban)
 *   - Selecting any chip fires onChange — hero card morphs via layoutId
 *     in the parent. Source of truth lives in the parent.
 */

import { useId } from "react";

export type Jurisdiction = "US" | "UK" | "EU" | "IN" | "SG";
export type Stage = "pre-seed";
export type Role = "founder" | "gc" | "investor" | "vendor";

export type ContextValue = {
  jurisdiction: Jurisdiction;
  stage: Stage;
  role: Role;
};

const JURI: Array<{ v: Jurisdiction; dot: string }> = [
  { v: "US", dot: "var(--brand-500)" },
  { v: "UK", dot: "var(--sev-low)" },
  { v: "EU", dot: "var(--sev-clean)" },
  { v: "IN", dot: "var(--sev-medium)" },
  { v: "SG", dot: "var(--sev-high)" },
];


const ROLES: Array<{ v: Role; label: string }> = [
  { v: "founder", label: "Founder" },
  { v: "gc", label: "GC" },
  { v: "investor", label: "Investor" },
  { v: "vendor", label: "Vendor" },
];

export function ContextSelector({
  value,
  onChange,
}: {
  value: ContextValue;
  onChange: (v: ContextValue) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Row
        label="Jurisdiction"
        items={JURI.map((j) => ({
          key: j.v,
          render: <JurisChip code={j.v} dot={j.dot} active={value.jurisdiction === j.v} />,
        }))}
        active={value.jurisdiction}
        onPick={(k) => onChange({ ...value, jurisdiction: k as Jurisdiction })}
      />
      <Row
        label="Role"
        items={ROLES.map((r) => ({
          key: r.v,
          render: <TextChip label={r.label} active={value.role === r.v} />,
        }))}
        active={value.role}
        onPick={(k) => onChange({ ...value, role: k as Role })}
      />
    </div>
  );
}

function Row({
  label,
  items,
  active,
  onPick,
}: {
  label: string;
  items: Array<{ key: string; render: React.ReactNode }>;
  active: string;
  onPick: (k: string) => void;
}) {
  const groupId = useId();
  return (
    <div role="radiogroup" aria-label={label} aria-labelledby={groupId}>
      <div
        id={groupId}
        className="cf-eyebrow mb-2"
        style={{ color: "var(--ink-muted)" }}
      >
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => {
          const isActive = it.key === active;
          return (
            <button
              key={it.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onPick(it.key)}
              className="cursor-pointer"
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
              }}
            >
              {it.render}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 14px",
        border: `1px solid ${active ? "var(--brand-500)" : "var(--border-strong)"}`,
        background: active
          ? "color-mix(in oklch, var(--brand-500) 12%, transparent)"
          : "var(--bg-elevated-1)",
        color: active ? "var(--brand-300)" : "var(--ink-secondary)",
        borderRadius: "var(--r-sm)",
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: "0.005em",
        transition: "background 200ms var(--ease-out), border-color 200ms var(--ease-out), color 200ms var(--ease-out)",
        minHeight: 36,
      }}
    >
      {label}
    </span>
  );
}

function JurisChip({
  code,
  dot,
  active,
}: {
  code: string;
  dot: string;
  active: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        border: `1px solid ${active ? "var(--brand-500)" : "var(--border-strong)"}`,
        background: active
          ? "color-mix(in oklch, var(--brand-500) 12%, transparent)"
          : "var(--bg-elevated-1)",
        color: active ? "var(--brand-300)" : "var(--ink-secondary)",
        borderRadius: "var(--r-sm)",
        fontFamily: "Geist Mono, monospace",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.06em",
        transition: "background 200ms var(--ease-out), border-color 200ms var(--ease-out), color 200ms var(--ease-out)",
        minHeight: 36,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dot,
          boxShadow: active ? `0 0 0 3px color-mix(in oklch, ${dot} 25%, transparent)` : "none",
          transition: "box-shadow 240ms var(--ease-out)",
        }}
      />
      {code}
    </span>
  );
}
