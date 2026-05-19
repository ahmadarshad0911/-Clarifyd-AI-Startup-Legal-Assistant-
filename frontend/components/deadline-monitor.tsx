"use client";

/**
 * DeadlineMonitor — workflow stage 9, P1 (§6.13).
 *
 * Vertical stack of date-sorted rows. Each row carries leading icon, title,
 * date, days-out, inline "Snooze 7d" / "Dismiss" actions. No modals.
 * Sort: most-imminent first. Empty: "All clear. Next deadline > 90 days out."
 */

import { useMemo, useState } from "react";
import {
  CalendarBlank,
  ShieldCheck,
  Scales,
  ClockClockwise,
  X,
} from "@phosphor-icons/react";

export type DeadlineKind = "vesting" | "ip" | "regulation" | "renewal" | "other";

export type Deadline = {
  id: string;
  kind: DeadlineKind;
  title: string;
  isoDate: string;     // when it happens
  severity?: "low" | "medium" | "high" | "critical";
  action?: { label: string; onAction: () => void };
};

const ICONS: Record<DeadlineKind, typeof CalendarBlank> = {
  vesting: CalendarBlank,
  ip: ShieldCheck,
  regulation: Scales,
  renewal: ClockClockwise,
  other: CalendarBlank,
};

function daysOut(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function DeadlineMonitor({ items: initial }: { items: Deadline[] }) {
  const [items, setItems] = useState(initial);
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});

  const visible = useMemo(() => {
    return items
      .filter((d) => !snoozed[d.id] || snoozed[d.id] < Date.now())
      .sort((a, b) => daysOut(a.isoDate) - daysOut(b.isoDate));
  }, [items, snoozed]);

  function snooze(id: string) {
    setSnoozed((s) => ({ ...s, [id]: Date.now() + 7 * 86400_000 }));
  }
  function dismiss(id: string) {
    setItems((arr) => arr.filter((d) => d.id !== id));
  }

  if (!visible.length) {
    return (
      <div
        style={{
          background: "var(--bg-elevated-1)",
          border: "1px solid var(--border-hairline)",
          borderRadius: "var(--r-md)",
          padding: 32,
          textAlign: "center",
          color: "var(--ink-muted)",
        }}
      >
        <CalendarBlank weight="duotone" size={28} color="var(--ink-muted)" />
        <p style={{ margin: "10px 0 0", fontSize: 14, fontStyle: "italic" }}>
          All clear. Next deadline &gt; 90 days out.
        </p>
      </div>
    );
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
      {visible.map((d, i) => {
        const Icon = ICONS[d.kind];
        const days = daysOut(d.isoDate);
        const sevColor =
          days < 7 ? "var(--sev-critical)" :
          days < 30 ? "var(--sev-high)" :
          days < 90 ? "var(--sev-medium)" :
                      "var(--ink-muted)";
        return (
          <div
            key={d.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 18px",
              borderBottom: i < visible.length - 1 ? "1px solid var(--border-hairline)" : "none",
            }}
          >
            <Icon weight="duotone" size={20} color={sevColor} aria-hidden />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, color: "var(--ink-primary)", fontWeight: 500 }}>
                {d.title}
              </div>
              <div className="cf-mono" style={{ fontSize: 11, letterSpacing: "0.10em", color: "var(--ink-muted)", marginTop: 2 }}>
                {d.isoDate}
              </div>
            </div>
            <span
              className="cf-mono"
              style={{
                fontSize: 11,
                color: sevColor,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 600,
                minWidth: 64,
                textAlign: "right",
              }}
            >
              {days > 0 ? `${days}d` : days === 0 ? "today" : `${Math.abs(days)}d ago`}
            </span>
            {d.action ? (
              <button
                type="button"
                onClick={d.action.onAction}
                className="cursor-pointer"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-strong)",
                  color: "var(--ink-primary)",
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: "var(--r-sm)",
                  transition: "border-color 200ms var(--ease-out)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--brand-500)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
              >
                {d.action.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => snooze(d.id)}
              className="cursor-pointer cf-mono"
              title="Snooze 7 days"
              aria-label="Snooze 7 days"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--ink-muted)",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 600,
                padding: "4px 8px",
                transition: "color 200ms var(--ease-out)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--brand-500)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-muted)")}
            >
              Snooze 7d
            </button>
            <button
              type="button"
              onClick={() => dismiss(d.id)}
              className="cursor-pointer"
              title="Dismiss"
              aria-label="Dismiss"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--ink-muted)",
                padding: 4,
                transition: "color 200ms var(--ease-out)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--sev-critical)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-muted)")}
            >
              <X weight="bold" size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
