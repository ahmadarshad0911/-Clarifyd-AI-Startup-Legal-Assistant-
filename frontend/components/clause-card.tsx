"use client";

/**
 * ClauseCard — Bento atom for findings + negotiation lab.
 *
 * Spec: revamped-fronted.md §6.2
 *   - Collapsed: severity pill + clause title + score chip
 *   - Expanded: two-pane diff (red strike → green underline), accept/
 *     reject/edit, confidence top-right
 *   - Transition: framer-motion `layout` for smooth re-flow
 *   - Never nested in another card
 */

import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  ArrowsClockwise,
  Check,
  X,
  CaretDown,
} from "@phosphor-icons/react";
import { useState } from "react";

import { RiskPill, Severity } from "./risk-pill";

export type ClauseData = {
  id: string;
  title: string;
  severity: Severity;
  confidence?: number;
  original: string;
  suggested: string;
  rationale?: string;
  scoreImpact?: number;       // -100..+100 (negative = worsens, positive = improves)
};

type Props = {
  clause: ClauseData;
  initialOpen?: boolean;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  accepted?: boolean;
};

export function ClauseCard({
  clause,
  initialOpen = false,
  onAccept,
  onReject,
  accepted,
}: Props) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <LayoutGroup>
      <motion.article
        layout
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        style={{
          background: "var(--bg-elevated-1)",
          border: `1px solid ${accepted ? "var(--sev-low)" : "var(--border-strong)"}`,
          borderRadius: "var(--r-md)",
          overflow: "hidden",
        }}
      >
        {/* Header — always visible */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="cursor-pointer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            width: "100%",
            padding: "16px 18px",
            background: "transparent",
            border: "none",
            color: "var(--ink-primary)",
            textAlign: "left",
          }}
        >
          <RiskPill
            severity={clause.severity}
            label={clause.severity}
            confidence={clause.confidence}
          />
          <h3
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            {clause.title}
          </h3>
          {clause.scoreImpact != null ? (
            <span
              className="cf-mono"
              style={{
                color:
                  clause.scoreImpact >= 0
                    ? "var(--sev-low)"
                    : "var(--sev-critical)",
                fontSize: 11,
                letterSpacing: "0.06em",
              }}
            >
              {clause.scoreImpact >= 0 ? "+" : ""}
              {clause.scoreImpact} pts
            </span>
          ) : null}
          {accepted ? (
            <span
              style={{
                fontFamily: "Geist Mono, monospace",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--sev-low)",
              }}
            >
              ✓ accepted
            </span>
          ) : null}
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            style={{ color: "var(--ink-muted)", display: "inline-flex" }}
          >
            <CaretDown weight="bold" size={14} aria-hidden />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="body"
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 32px 1fr",
                  gap: 0,
                  padding: "0 18px 18px",
                  borderTop: "1px solid var(--border-hairline)",
                  paddingTop: 18,
                  alignItems: "stretch",
                }}
              >
                <div>
                  <div
                    className="cf-eyebrow"
                    style={{ color: "var(--sev-critical)", marginBottom: 8 }}
                  >
                    Original
                  </div>
                  <p
                    style={{
                      fontSize: 13.5,
                      color: "var(--ink-secondary)",
                      margin: 0,
                      lineHeight: 1.6,
                      textDecoration: "line-through",
                      textDecorationColor:
                        "color-mix(in oklch, var(--sev-critical) 50%, transparent)",
                    }}
                  >
                    {clause.original}
                  </p>
                </div>
                <div
                  aria-hidden
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ArrowsClockwise
                    size={16}
                    color="var(--brand-500)"
                    weight="duotone"
                  />
                </div>
                <div>
                  <div
                    className="cf-eyebrow"
                    style={{ color: "var(--sev-low)", marginBottom: 8 }}
                  >
                    Suggested
                  </div>
                  <p
                    style={{
                      fontSize: 13.5,
                      color: "var(--ink-primary)",
                      margin: 0,
                      lineHeight: 1.6,
                      textDecoration: "underline",
                      textDecorationColor:
                        "color-mix(in oklch, var(--sev-low) 60%, transparent)",
                      textUnderlineOffset: 3,
                    }}
                  >
                    {clause.suggested}
                  </p>
                </div>
              </div>

              {clause.rationale ? (
                <div
                  style={{
                    padding: "0 18px 16px",
                    fontSize: 12.5,
                    color: "var(--ink-muted)",
                    lineHeight: 1.55,
                  }}
                >
                  <span style={{ color: "var(--ink-secondary)", fontWeight: 500 }}>
                    Why:
                  </span>{" "}
                  {clause.rationale}
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "0 18px 18px",
                  justifyContent: "flex-end",
                }}
              >
                <ActionBtn
                  kind="reject"
                  label="Reject"
                  onClick={() => onReject?.(clause.id)}
                />
                <ActionBtn
                  kind="accept"
                  label={accepted ? "Accepted" : "Accept"}
                  onClick={() => onAccept?.(clause.id)}
                  active={accepted}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.article>
    </LayoutGroup>
  );
}

function ActionBtn({
  kind,
  label,
  onClick,
  active,
}: {
  kind: "accept" | "reject";
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const isAccept = kind === "accept";
  const bg = active
    ? "var(--sev-low)"
    : isAccept
      ? "var(--brand-500)"
      : "transparent";
  const color = active
    ? "var(--ink-on-brand)"
    : isAccept
      ? "var(--ink-on-brand)"
      : "var(--ink-secondary)";
  const border = active
    ? "var(--sev-low)"
    : isAccept
      ? "var(--brand-500)"
      : "var(--border-strong)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        background: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: "var(--r-sm)",
        fontSize: 12.5,
        fontWeight: 500,
        letterSpacing: "0.01em",
        minHeight: 36,
        transition:
          "background 200ms var(--ease-out), color 200ms var(--ease-out), border-color 200ms var(--ease-out), transform 140ms var(--ease-out)",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(1px) scale(0.98)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "translateY(0) scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0) scale(1)")}
    >
      {isAccept ? <Check size={13} weight="bold" /> : <X size={13} weight="bold" />}
      <span>{label}</span>
    </button>
  );
}
