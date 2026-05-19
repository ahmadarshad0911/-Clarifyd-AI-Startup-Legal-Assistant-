"use client";

/**
 * AutoClassifyChip — workflow stage 2, P0.
 *
 * Spec: revamped-fronted.md §6.11
 *   - Renders predicted contract type w/ confidence
 *   - Click to open dropdown of 12 supported types for override
 *   - 8-second auto-lock timer if user does nothing
 *   - confidence < 0.6 → "Tell us the type", dropdown auto-open
 */

import { CaretDown, Check, MagicWand } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

export type DocType =
  | "SAFE"
  | "NDA"
  | "MSA"
  | "Term Sheet"
  | "Employment"
  | "Founders Agreement"
  | "Vendor MSA"
  | "DPA"
  | "SaaS Subscription"
  | "Equity Grant"
  | "Convertible Note"
  | "IP Assignment";

const TYPES: DocType[] = [
  "SAFE",
  "NDA",
  "MSA",
  "Term Sheet",
  "Employment",
  "Founders Agreement",
  "Vendor MSA",
  "DPA",
  "SaaS Subscription",
  "Equity Grant",
  "Convertible Note",
  "IP Assignment",
];

type Props = {
  predicted: DocType;
  confidence: number;        // 0..1
  autoLockSec?: number;      // default 8
  onConfirm: (t: DocType) => void;
};

export function AutoClassifyChip({
  predicted,
  confidence,
  autoLockSec = 8,
  onConfirm,
}: Props) {
  const lowConf = confidence < 0.6;
  const [chosen, setChosen] = useState<DocType>(predicted);
  const [open, setOpen] = useState(lowConf);
  const [secs, setSecs] = useState(autoLockSec);
  const [locked, setLocked] = useState(false);
  const interactedRef = useRef(false);

  useEffect(() => {
    if (locked || interactedRef.current || lowConf) return;
    if (secs <= 0) {
      setLocked(true);
      onConfirm(chosen);
      return;
    }
    const id = window.setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secs, chosen, locked, lowConf, onConfirm]);

  function pick(t: DocType) {
    interactedRef.current = true;
    setChosen(t);
    setOpen(false);
    setLocked(true);
    onConfirm(t);
  }

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
      }}
    >
      <button
        type="button"
        onClick={() => {
          interactedRef.current = true;
          setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="cursor-pointer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: locked
            ? "color-mix(in oklch, var(--brand-500) 10%, transparent)"
            : "var(--bg-elevated-2)",
          border: `1px solid ${locked ? "var(--brand-500)" : "var(--border-strong)"}`,
          borderRadius: "var(--r-sm)",
          color: "var(--ink-primary)",
          fontSize: 13,
          fontWeight: 500,
          transition: "background 200ms var(--ease-out), border-color 200ms var(--ease-out)",
          minHeight: 40,
        }}
      >
        <MagicWand weight="duotone" size={14} color="var(--brand-500)" aria-hidden />
        <span>
          {lowConf ? (
            <span style={{ color: "var(--ink-secondary)" }}>Tell us the type</span>
          ) : (
            <>
              <span style={{ color: "var(--ink-primary)" }}>{chosen}</span>
              <span
                className="cf-mono"
                style={{
                  marginLeft: 8,
                  color: "var(--ink-muted)",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                }}
              >
                {Math.round(confidence * 100)}%
              </span>
            </>
          )}
        </span>
        {!locked && !lowConf ? (
          <span
            className="cf-mono"
            style={{
              fontSize: 10,
              color: "var(--ink-muted)",
              borderLeft: "1px solid var(--border-hairline)",
              paddingLeft: 8,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
            aria-live="polite"
          >
            {secs}s
          </span>
        ) : null}
        <CaretDown size={11} weight="bold" color="var(--ink-muted)" aria-hidden />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Override contract type"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 40,
            minWidth: 240,
            maxHeight: 320,
            overflowY: "auto",
            background: "var(--bg-elevated-2)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--r-sm)",
            padding: 4,
            margin: 0,
            listStyle: "none",
            boxShadow: "0 14px 40px -16px oklch(0 0 0 / 0.6)",
          }}
        >
          {TYPES.map((t) => {
            const isPicked = t === chosen;
            return (
              <li key={t}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isPicked}
                  onClick={() => pick(t)}
                  className="cursor-pointer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "8px 10px",
                    background: isPicked
                      ? "color-mix(in oklch, var(--brand-500) 8%, transparent)"
                      : "transparent",
                    border: "none",
                    color: "var(--ink-primary)",
                    fontSize: 13,
                    textAlign: "left",
                    borderRadius: 6,
                    transition: "background 160ms var(--ease-out)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "color-mix(in oklch, var(--brand-500) 8%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isPicked
                      ? "color-mix(in oklch, var(--brand-500) 8%, transparent)"
                      : "transparent";
                  }}
                >
                  <span>{t}</span>
                  {isPicked ? (
                    <Check size={13} weight="bold" color="var(--brand-500)" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
