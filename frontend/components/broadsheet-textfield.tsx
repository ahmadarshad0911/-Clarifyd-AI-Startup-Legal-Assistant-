"use client";

/**
 * BroadsheetTextField — editorial ledger-entry input.
 *
 * Inline mono label on the left, vertical hairline divider, ink underline
 * beneath the whole row. Focus: leading § slides in red, underline thickens
 * to red. Optional trailing slot (eye toggle, send button, hint icon).
 * Autofill chrome suppressed.
 *
 * Drop-in replacement for any boxed `<input>` in the site.
 */

import { forwardRef, ReactNode, useId, useState } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  minLength?: number;
  /** Right-side slot (icon button etc). */
  trailing?: ReactNode;
  /** Helper line under the field. */
  hint?: ReactNode;
  /** Error tone for the underline + label. */
  invalid?: boolean;
  /** Optional onKeyDown forward. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Optional autofocus. */
  autoFocus?: boolean;
  /** Optional id override. */
  id?: string;
};

export const BroadsheetTextField = forwardRef<HTMLInputElement, Props>(function BroadsheetTextField(
  { label, value, onChange, type = "text", placeholder, required, autoComplete, disabled, minLength, trailing, hint, invalid, onKeyDown, autoFocus, id },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? `bsd-tf-${generatedId}`;
  const [focused, setFocused] = useState(false);

  const accent = invalid ? "var(--bsd-sev-critical)" : "var(--bsd-red)";

  return (
    <div className="bsd-tf">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(120px, max-content) 1px 1fr auto",
          alignItems: "center",
          gap: 14,
          padding: "8px 0",
          borderBottom: `${focused ? 3 : 2}px solid ${focused ? accent : "var(--bsd-ink)"}`,
          transition: "border-color 200ms ease, border-width 100ms ease",
        }}
      >
        <label
          htmlFor={fieldId}
          className="cf-mono"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            color: focused ? accent : "var(--bsd-muted)",
            fontSize: 10.5, letterSpacing: "0.22em",
            textTransform: "uppercase", fontWeight: 800,
            paddingRight: 4,
            transition: "color 200ms ease",
            cursor: disabled ? "not-allowed" : "pointer",
            userSelect: "none",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              color: accent,
              opacity: focused ? 1 : 0,
              transform: focused ? "translateX(0)" : "translateX(-4px)",
              transition: "opacity 220ms ease, transform 220ms cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          >
            §
          </span>
          {label}
        </label>
        <span aria-hidden style={{ width: 1, alignSelf: "stretch", background: "var(--bsd-rule)" }} />
        <input
          ref={ref}
          id={fieldId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          minLength={minLength}
          autoFocus={autoFocus}
          className="bsd-tf__input"
          style={{
            minWidth: 0,
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            boxShadow: "none",
            padding: "10px 0",
            fontSize: 18,
            fontWeight: 500,
            color: "var(--bsd-ink)",
            fontFamily: "Geist, sans-serif",
            letterSpacing: "-0.005em",
          }}
        />
        {trailing ? <span style={{ display: "inline-flex", alignItems: "center", color: "var(--bsd-muted)" }}>{trailing}</span> : <span />}
      </div>
      {hint ? (
        <div className="cf-mono" style={{ marginTop: 6, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: invalid ? "var(--bsd-sev-critical)" : "var(--bsd-muted)", fontWeight: 700 }}>
          {hint}
        </div>
      ) : null}
      <style jsx global>{`
        .bsd-tf__input { outline: none !important; box-shadow: none !important; }
        .bsd-tf__input::placeholder { color: var(--bsd-soft); font-style: italic; font-weight: 400; }
        .bsd-tf__input:-webkit-autofill,
        .bsd-tf__input:-webkit-autofill:hover,
        .bsd-tf__input:-webkit-autofill:focus {
          -webkit-text-fill-color: var(--bsd-ink) !important;
          -webkit-box-shadow: 0 0 0px 1000px var(--bsd-paper) inset !important;
          box-shadow: 0 0 0px 1000px var(--bsd-paper) inset !important;
          transition: background-color 9999s ease-in-out 0s;
          caret-color: var(--bsd-ink);
        }
        .bsd-tf__input::-webkit-search-decoration,
        .bsd-tf__input::-webkit-search-cancel-button {
          display: none !important;
          -webkit-appearance: none !important;
        }
      `}</style>
    </div>
  );
});
