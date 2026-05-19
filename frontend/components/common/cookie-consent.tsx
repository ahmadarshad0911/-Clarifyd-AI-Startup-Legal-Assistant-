"use client";

/**
 * CookieConsent — Broadsheet · v6
 *
 * Slim ribbon bottom-center. Ink-on-paper. No glass, no rounded.
 */

import { useEffect, useState } from "react";
import { Cookie, Check, X, GearSix } from "@phosphor-icons/react";

type Pref = "all" | "essential" | "custom";
type Stored = { pref: Pref; analytics: boolean; marketing: boolean; at: string };
const STORAGE_KEY = "clarifyd.cookie-consent";

export function CookieConsent() {
  const [shown, setShown] = useState(false);
  const [manage, setManage] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (!v) setShown(true);
    } catch {
      setShown(true);
    }
  }, []);

  function persist(s: Stored) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
    setShown(false);
  }

  if (!shown) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      style={{
        position: "fixed", bottom: 18, left: 18, right: 18,
        zIndex: 80,
        display: "flex", justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          maxWidth: 880, width: "100%",
          background: "var(--bsd-paper)",
          border: "1.5px solid var(--bsd-ink)",
          padding: manage ? 22 : 14,
          boxShadow: "0 18px 44px -18px rgba(12, 10, 8, 0.30)",
        }}
      >
        {manage ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Cookie weight="duotone" size={18} color="var(--bsd-red)" />
              <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800 }}>
                Manage cookies
              </span>
            </div>
            <Row label="Essential" desc="Auth, CSRF, session state. Cannot be disabled." disabled checked />
            <Row label="Analytics" desc="Anonymous usage signals to find slow surfaces." checked={analytics} onChange={setAnalytics} />
            <Row label="Marketing" desc="Optional personalization. Off by default." checked={marketing} onChange={setMarketing} />
            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="bsd-btn bsd-btn--ghost bsd-btn--sm" onClick={() => setManage(false)}>Cancel</button>
              <button
                type="button"
                className="bsd-btn bsd-btn--sm"
                onClick={() => persist({ pref: "custom", analytics, marketing, at: new Date().toISOString() })}
              >
                <Check weight="bold" size={11} /> Save
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
              <Cookie weight="duotone" size={18} color="var(--bsd-red)" aria-hidden />
              <p style={{ margin: 0, fontSize: 13, color: "var(--bsd-body)", lineHeight: 1.45 }}>
                Essential cookies run Clarifyd. Optional analytics help us find slow surfaces. No marketing cookies unless asked.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="bsd-btn bsd-btn--ghost bsd-btn--sm" onClick={() => setManage(true)}>
                <GearSix weight="duotone" size={11} /> Manage
              </button>
              <button
                type="button"
                className="bsd-btn bsd-btn--ghost bsd-btn--sm"
                onClick={() => persist({ pref: "essential", analytics: false, marketing: false, at: new Date().toISOString() })}
              >
                <X weight="bold" size={11} /> Essential
              </button>
              <button
                type="button"
                className="bsd-btn bsd-btn--sm"
                onClick={() => persist({ pref: "all", analytics: true, marketing: true, at: new Date().toISOString() })}
              >
                <Check weight="bold" size={11} /> Accept all
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label, desc, checked, onChange, disabled,
}: { label: string; desc: string; checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label
      className={disabled ? "" : "cursor-pointer"}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--bsd-hairline)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        style={{ marginTop: 3, width: 14, height: 14, accentColor: "var(--bsd-red)", cursor: disabled ? "not-allowed" : "pointer" }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--bsd-ink)", fontWeight: 600 }}>
          {label}{disabled ? <span className="cf-mono" style={{ marginLeft: 8, fontSize: 9.5, color: "var(--bsd-muted)", letterSpacing: "0.16em", fontWeight: 700 }}>· required</span> : null}
        </div>
        <div style={{ fontSize: 12, color: "var(--bsd-muted)", marginTop: 2, lineHeight: 1.45 }}>{desc}</div>
      </div>
    </label>
  );
}
