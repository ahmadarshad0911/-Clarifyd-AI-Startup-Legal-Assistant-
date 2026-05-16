"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

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
        window.setTimeout(() => dismiss(id), 5000);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <div style={{ flex: 1 }}>
              <strong>{t.message}</strong>
              {t.detail ? (
                <div>
                  <small>{t.detail}</small>
                </div>
              ) : null}
            </div>
            <button
              className="ghost"
              type="button"
              onClick={() => dismiss(t.id)}
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.85rem" }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
