"use client";

/**
 * NoticeModal — Broadsheet-style alert dialog.
 *
 * Design: red double-rule, mono caption, editorial headline, body copy,
 * single primary action. Sharp edges, ivory paper, coffee-black ink.
 * Animation: 220ms ease-out scale-in + translateY; backdrop blur-fade.
 * Respects prefers-reduced-motion (opacity-only transition).
 */

import { ReactNode, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  X,
  WarningCircle,
  CheckCircle,
  Info,
  Prohibit,
} from "@phosphor-icons/react";

export type NoticeKind = "rejection" | "warning" | "info" | "success";

type KindTheme = {
  accent: string;       // main rule + button + icon color
  tint: string;         // subtle paper-tint wash for card background
  Icon: typeof Info;
};

const THEME: Record<NoticeKind, KindTheme> = {
  rejection: {
    accent: "var(--bsd-red, #b8260f)",
    tint: "color-mix(in oklch, var(--bsd-red, #b8260f) 6%, var(--bsd-paper, #f4ede1))",
    Icon: Prohibit,
  },
  warning: {
    accent: "var(--bsd-sev-high, #d97706)",
    tint: "color-mix(in oklch, var(--bsd-sev-high, #d97706) 7%, var(--bsd-paper, #f4ede1))",
    Icon: WarningCircle,
  },
  info: {
    accent: "var(--bsd-ink, #0c0a08)",
    tint: "var(--bsd-paper, #f4ede1)",
    Icon: Info,
  },
  success: {
    accent: "var(--bsd-sev-clean, #4f7d3f)",
    tint: "color-mix(in oklch, var(--bsd-sev-clean, #4f7d3f) 7%, var(--bsd-paper, #f4ede1))",
    Icon: CheckCircle,
  },
};

export type NoticeContent = {
  kind: NoticeKind;
  caption: string;     // tiny all-caps line above headline (e.g. "STOP PRESS · UPLOAD REFUSED")
  headline: string;    // big editorial line
  body: string;        // 1-3 short sentences
  hint?: string;       // optional dim follow-up line
  primaryLabel?: string;  // defaults to "Understood"
  onPrimary?: () => void | Promise<void>;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function NoticeModal({
  open,
  notice,
  onClose,
}: {
  open: boolean;
  notice: NoticeContent | null;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!notice) return null;

  const theme = THEME[notice.kind];
  const accent = theme.accent;
  const KindIcon = theme.Icon;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          onClick={onClose}
          aria-modal="true"
          role="dialog"
          aria-labelledby="notice-headline"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(12, 10, 8, 0.42)",
            backdropFilter: "blur(2px) saturate(120%)",
            WebkitBackdropFilter: "blur(2px) saturate(120%)",
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            padding: "24px",
          }}
        >
          <motion.article
            key="card"
            initial={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96, y: 12 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.97, y: 6 }
            }
            transition={{
              duration: reduced ? 0.16 : 0.24,
              ease: [0.23, 1, 0.32, 1],
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: 560,
              width: "100%",
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
              background: theme.tint,
              color: "var(--bsd-ink, #0c0a08)",
              borderRadius: 2,
              boxShadow:
                "0 1px 0 0 rgba(12,10,8,0.10), 0 18px 60px -16px rgba(12,10,8,0.32)",
              padding: "40px 44px 36px",
              fontFamily:
                "Geist, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
              minWidth: 0,
            }}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Dismiss"
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 32,
                height: 32,
                display: "grid",
                placeItems: "center",
                background: "transparent",
                border: "none",
                color: "var(--bsd-muted, #6c6356)",
                cursor: "pointer",
                transition: "color 140ms ease, transform 140ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--bsd-ink, #0c0a08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--bsd-muted, #6c6356)";
              }}
            >
              <X size={16} weight="bold" />
            </button>

            {/* Red double-rule: thick on top, hairline below, expands width
                on enter for a tiny editorial accent. */}
            <motion.div
              initial={reduced ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{
                duration: 0.32,
                delay: reduced ? 0 : 0.06,
                ease: [0.23, 1, 0.32, 1],
              }}
              style={{
                height: 6,
                background: accent,
                transformOrigin: "left center",
                marginBottom: 4,
              }}
              aria-hidden="true"
            />
            <div
              style={{
                height: 1,
                background: accent,
                opacity: 0.45,
                marginBottom: 28,
              }}
              aria-hidden="true"
            />

            <motion.div
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
              className="cf-mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "Geist Mono, ui-monospace, monospace",
                fontSize: 10.5,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: accent,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              <KindIcon weight="duotone" size={15} aria-hidden />
              {notice.caption}
            </motion.div>

            <motion.h2
              id="notice-headline"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.14, ease: [0.23, 1, 0.32, 1] }}
              style={{
                fontSize: 26,
                lineHeight: 1.18,
                letterSpacing: "-0.02em",
                fontWeight: 700,
                margin: 0,
                color: "var(--bsd-ink, #0c0a08)",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                hyphens: "auto",
              }}
            >
              {notice.headline}
            </motion.h2>

            <motion.p
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.18, ease: [0.23, 1, 0.32, 1] }}
              style={{
                marginTop: 18,
                marginBottom: 0,
                fontSize: 15,
                lineHeight: 1.55,
                color: "var(--bsd-body, #2b251f)",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
              }}
            >
              {notice.body}
            </motion.p>

            {notice.hint ? (
              <motion.p
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.22 }}
                className="cf-mono"
                style={{
                  marginTop: 16,
                  fontFamily: "Geist Mono, ui-monospace, monospace",
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: "var(--bsd-muted, #6c6356)",
                }}
              >
                {notice.hint}
              </motion.p>
            ) : null}

            <motion.div
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.24, ease: [0.23, 1, 0.32, 1] }}
              style={{
                marginTop: 32,
                display: "flex",
                gap: 12,
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              {notice.secondaryLabel ? (
                <button
                  type="button"
                  onClick={() => {
                    notice.onSecondary?.();
                    onClose();
                  }}
                  style={{
                    padding: "10px 18px",
                    background: "transparent",
                    border: "1px solid var(--bsd-rule, rgba(12,10,8,0.20))",
                    color: "var(--bsd-body, #2b251f)",
                    fontFamily: "Geist Mono, ui-monospace, monospace",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    cursor: "pointer",
                    borderRadius: 2,
                    transition:
                      "border-color 140ms ease, color 140ms ease, transform 100ms ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor =
                      "var(--bsd-rule-hi, rgba(12,10,8,0.35))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor =
                      "var(--bsd-rule, rgba(12,10,8,0.20))";
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = "scale(0.97)";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  {notice.secondaryLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const p = notice.onPrimary?.();
                  if (p && typeof (p as Promise<void>).then === "function") {
                    (p as Promise<void>).finally(() => onClose());
                  } else {
                    onClose();
                  }
                }}
                autoFocus
                style={{
                  padding: "11px 22px",
                  background: accent,
                  border: "1px solid " + accent,
                  color: "var(--bsd-paper, #f4ede1)",
                  fontFamily: "Geist Mono, ui-monospace, monospace",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  cursor: "pointer",
                  borderRadius: 2,
                  transition:
                    "background 140ms ease, transform 100ms ease, box-shadow 140ms ease",
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "scale(0.97)";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 0 0 4px rgba(184, 38, 15, 0.18)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {notice.primaryLabel ?? "Understood"}
              </button>
            </motion.div>
          </motion.article>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function NoticeIcon({ children }: { children: ReactNode }) {
  return <span aria-hidden="true">{children}</span>;
}
