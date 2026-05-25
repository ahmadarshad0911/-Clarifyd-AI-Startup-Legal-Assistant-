"use client";

/**
 * Broadsheet toast — same visual language as NoticeModal but compact,
 * stack-based, auto-dismissing. Red double-rule accent, mono caption,
 * editorial headline, sharp edges, ivory paper.
 *
 * Animation: slide-in from bottom-right with scale 0.96 → 1, exit reverses;
 * stacked toasts use staggered timing.
 */

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle, WarningCircle, Info } from "@phosphor-icons/react";

export type ToastKind = "info" | "success" | "error";
export type Toast = {
  id: number;
  message: string;
  kind: ToastKind;
  detail?: string;
};

type Ctx = {
  toasts: Toast[];
  push: (message: string, kind?: ToastKind, detail?: string) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<Ctx | null>(null);

let nextId = 1;

const EOQ = [0.23, 1, 0.32, 1] as const;

function caption(kind: ToastKind): string {
  if (kind === "success") return "Notice · Update";
  if (kind === "error") return "Notice · Issue";
  return "Notice";
}

function accentColor(kind: ToastKind): string {
  if (kind === "success") return "var(--bsd-sev-medium, #a98b2a)";
  if (kind === "error") return "var(--bsd-red, #b8260f)";
  return "var(--bsd-ink, #0c0a08)";
}

function kindIcon(kind: ToastKind) {
  if (kind === "success") return <CheckCircle weight="duotone" size={14} />;
  if (kind === "error") return <WarningCircle weight="duotone" size={14} />;
  return <Info weight="duotone" size={14} />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = "info", detail?: string) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, kind, detail }]);
      if (typeof window !== "undefined") {
        window.setTimeout(() => dismiss(id), 5200);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxWidth: 380,
          pointerEvents: "none",
        }}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const accent = accentColor(t.kind);
            return (
              <motion.article
                key={t.id}
                initial={{ opacity: 0, x: 18, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 18, scale: 0.97 }}
                transition={{ duration: 0.22, ease: EOQ }}
                layout
                style={{
                  pointerEvents: "auto",
                  position: "relative",
                  background: "var(--bsd-paper, #f4ede1)",
                  color: "var(--bsd-ink, #0c0a08)",
                  borderRadius: 2,
                  padding: "16px 18px 14px 18px",
                  boxShadow:
                    "0 1px 0 rgba(12,10,8,0.08), 0 12px 36px -10px rgba(12,10,8,0.30)",
                  fontFamily:
                    "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif",
                  overflow: "hidden",
                }}
              >
                {/* Red double-rule */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: accent,
                  }}
                  aria-hidden="true"
                />
                <div
                  style={{
                    position: "absolute",
                    top: 5,
                    left: 0,
                    right: 0,
                    height: 1,
                    background: accent,
                    opacity: 0.4,
                  }}
                  aria-hidden="true"
                />

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    paddingTop: 8,
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      color: accent,
                      marginTop: 2,
                      flexShrink: 0,
                    }}
                  >
                    {kindIcon(t.kind)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="cf-mono"
                      style={{
                        fontFamily: "Geist Mono, ui-monospace, monospace",
                        fontSize: 9.5,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: accent,
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      {caption(t.kind)}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: 1.4,
                        fontWeight: 600,
                        color: "var(--bsd-ink, #0c0a08)",
                        letterSpacing: "-0.01em",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                      }}
                    >
                      {t.message}
                    </div>
                    {t.detail ? (
                      <div
                        className="cf-mono"
                        style={{
                          marginTop: 6,
                          fontFamily:
                            "Geist Mono, ui-monospace, monospace",
                          fontSize: 11,
                          lineHeight: 1.5,
                          color: "var(--bsd-muted, #6c6356)",
                          wordBreak: "break-word",
                        }}
                      >
                        {t.detail}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss notice"
                    onClick={() => dismiss(t.id)}
                    style={{
                      flexShrink: 0,
                      width: 22,
                      height: 22,
                      display: "grid",
                      placeItems: "center",
                      background: "transparent",
                      border: "none",
                      color: "var(--bsd-muted, #6c6356)",
                      cursor: "pointer",
                      transition: "color 140ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color =
                        "var(--bsd-ink, #0c0a08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color =
                        "var(--bsd-muted, #6c6356)";
                    }}
                  >
                    <X size={13} weight="bold" />
                  </button>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
