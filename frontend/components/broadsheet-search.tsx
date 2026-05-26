"use client";

/**
 * BroadsheetSearch — editorial "index entry" search box.
 *
 * Heavy bottom rule (no boxed input), red kicker label, italic mono
 * placeholder, blinking caret on focus, right-side match count. Matches
 * the broadsheet/newspaper aesthetic of the rest of the site.
 */

import { useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";

type Props = {
  label?: string;          // kicker, defaults to "Index"
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  /** Optional right-side meta, e.g. "13 entries" or "3 of 13". */
  meta?: string;
  /** Optional auto-focus on mount. */
  autoFocus?: boolean;
};

export function BroadsheetSearch({
  label = "Index",
  placeholder = "Type a term…",
  value,
  onChange,
  meta,
  autoFocus,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);

  function focus() {
    inputRef.current?.focus();
  }

  return (
    <div style={{ width: "100%" }}>
      <label
        className="cf-mono"
        style={{
          display: "flex", alignItems: "baseline", gap: 8,
          color: "var(--bsd-muted)",
          fontSize: 10.5, letterSpacing: "0.22em",
          textTransform: "uppercase", fontWeight: 700,
          marginBottom: 6,
        }}
      >
        <MagnifyingGlass weight="duotone" size={13} color="var(--bsd-red)" aria-hidden />
        {label}
        <span style={{ flex: 1, height: 1, background: "var(--bsd-hairline)", margin: "0 8px", transform: "translateY(-3px)" }} />
        {meta ? <span style={{ color: "var(--bsd-muted)" }}>{meta}</span> : null}
      </label>
      <div
        onClick={focus}
        className="cursor-pointer"
        style={{
          display: "flex", alignItems: "baseline", gap: 12,
          padding: "10px 4px",
          borderBottom: `${focused ? 3 : 2}px solid ${focused ? "var(--bsd-red)" : "var(--bsd-ink)"}`,
          transition: "border-color 200ms ease, border-width 100ms ease",
        }}
      >
        <span
          aria-hidden
          style={{
            fontFamily: "Geist Mono, monospace", fontSize: 18,
            color: focused ? "var(--bsd-red)" : "var(--bsd-ink)", fontWeight: 800,
            transition: "color 200ms ease",
            transform: "translateY(2px)",
            userSelect: "none",
          }}
        >
          ⌕
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="bsd-search-input"
          style={{
            flex: 1, minWidth: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            boxShadow: "none",
            WebkitAppearance: "none",
            appearance: "none",
            padding: "2px 0",
            fontSize: 19, fontWeight: 500, color: "var(--bsd-ink)",
            fontFamily: "Geist, sans-serif",
            letterSpacing: "-0.005em",
          }}
        />
        {value ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); focus(); }}
            className="cursor-pointer cf-mono"
            aria-label="Clear search"
            style={{
              background: "transparent", border: "none",
              color: "var(--bsd-muted)",
              fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
              padding: "4px 8px",
              transition: "color 200ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bsd-red)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--bsd-muted)")}
          >
            Clear ✕
          </button>
        ) : null}
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 8, height: 18,
            background: focused ? "var(--bsd-red)" : "transparent",
            animation: focused ? "bsd-caret 1.05s steps(2) infinite" : "none",
            transform: "translateY(3px)",
            transition: "background 120ms ease",
          }}
        />
      </div>
      <style jsx global>{`
        @keyframes bsd-caret {
          50% { opacity: 0; }
        }
        .bsd-search-input { outline: none !important; box-shadow: none !important; }
        .bsd-search-input:focus,
        .bsd-search-input:focus-visible,
        .bsd-search-input:focus-within {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
        }
        .bsd-search-input::-webkit-search-decoration,
        .bsd-search-input::-webkit-search-cancel-button,
        .bsd-search-input::-webkit-search-results-button,
        .bsd-search-input::-webkit-search-results-decoration {
          display: none !important;
          -webkit-appearance: none !important;
        }
        .bsd-search-input::placeholder {
          color: var(--bsd-soft);
          font-style: italic;
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes bsd-caret { 50% { opacity: 1; } }
        }
      `}</style>
    </div>
  );
}

/** Italic-placeholder helper. Kept exported for future inline uses. */
export const broadsheetSearchInputCss = `
  .bsd-search input::placeholder {
    color: var(--bsd-soft);
    font-style: italic;
  }
`;
