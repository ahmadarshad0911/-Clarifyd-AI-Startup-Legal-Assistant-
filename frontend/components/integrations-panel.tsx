"use client";

/**
 * IntegrationsPanel — workflow cross-cutting (§6.16).
 *
 * `divide-y` list, not card grid. Each row: name + tagline + toggle (or
 * "Configure"/"Request" for unsupported). Toggle = Radix Switch-style
 * (custom button so we don't pull a 4th dep). Empty state.
 */

import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";

export type IntegrationStatus = "off" | "on" | "configure" | "waitlist";

export type Integration = {
  id: string;
  name: string;
  tagline: string;
  status: IntegrationStatus;
  onToggle?: (next: boolean) => void;
  onConfigure?: () => void;
  onRequest?: () => void;
};

export function IntegrationsPanel({
  items: initial,
}: {
  items: Integration[];
}) {
  const [items, setItems] = useState(initial);

  if (!items.length) {
    return (
      <div
        style={{
          background: "var(--bg-elevated-1)",
          border: "1px solid var(--border-hairline)",
          borderRadius: "var(--r-md)",
          padding: 32,
          textAlign: "center",
          color: "var(--ink-muted)",
          fontStyle: "italic",
          fontSize: 14,
        }}
      >
        No integrations yet — start with Slack.
      </div>
    );
  }

  function toggle(id: string, next: boolean) {
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, status: next ? "on" : "off" } : it)));
    const target = items.find((it) => it.id === id);
    target?.onToggle?.(next);
  }

  return (
    <div
      style={{
        background: "var(--bg-elevated-1)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      {items.map((it, i) => (
        <div
          key={it.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "16px 20px",
            borderBottom: i < items.length - 1 ? "1px solid var(--border-hairline)" : "none",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-primary)" }}>
              {it.name}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 2 }}>
              {it.tagline}
            </div>
          </div>
          {it.status === "configure" ? (
            <button
              type="button"
              onClick={it.onConfigure}
              className="cursor-pointer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                color: "var(--ink-primary)",
                border: "1px solid var(--border-strong)",
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 500,
                borderRadius: "var(--r-sm)",
                transition: "border-color 200ms var(--ease-out)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--brand-500)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
            >
              Configure <ArrowRight weight="bold" size={12} />
            </button>
          ) : it.status === "waitlist" ? (
            <button
              type="button"
              onClick={it.onRequest}
              className="cursor-pointer cf-mono"
              style={{
                background: "transparent",
                color: "var(--brand-500)",
                border: "1px solid var(--brand-500)",
                padding: "7px 12px",
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 600,
                borderRadius: "var(--r-sm)",
              }}
            >
              Request
            </button>
          ) : (
            <Toggle
              checked={it.status === "on"}
              onChange={(v) => toggle(it.id, v)}
              ariaLabel={`Toggle ${it.name}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className="cursor-pointer"
      style={{
        position: "relative",
        width: 40,
        height: 22,
        background: checked ? "var(--brand-500)" : "var(--bg-elevated-2)",
        border: `1px solid ${checked ? "var(--brand-500)" : "var(--border-strong)"}`,
        borderRadius: 999,
        padding: 0,
        transition: "background 200ms var(--ease-out), border-color 200ms var(--ease-out)",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 20 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: checked ? "var(--ink-on-brand)" : "var(--ink-secondary)",
          transition: "left 220ms cubic-bezier(0.34, 1.56, 0.64, 1), background 200ms var(--ease-out)",
        }}
      />
    </button>
  );
}
