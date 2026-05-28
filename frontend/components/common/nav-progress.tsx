"use client";

/**
 * NavProgress — top route-transition bar (Broadsheet red).
 *
 * App Router has no navigation-start event, so we start the bar on
 * internal link clicks and complete it when the pathname resolves.
 */

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function NavProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const rampRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (rampRef.current) clearInterval(rampRef.current);
    if (hideRef.current) clearTimeout(hideRef.current);
    rampRef.current = null;
    hideRef.current = null;
  }, []);

  const start = useCallback(() => {
    clearTimers();
    setVisible(true);
    setWidth(10);
    rampRef.current = setInterval(() => {
      setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w));
    }, 180);
  }, [clearTimers]);

  const finish = useCallback(() => {
    clearTimers();
    setWidth(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 280);
  }, [clearTimers]);

  // Start on same-origin link clicks that change the path.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }
      start();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  // Complete when the route resolves.
  useEffect(() => {
    if (visible) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => clearTimers, [clearTimers]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${width}%`,
          background: "var(--bsd-red)",
          boxShadow: "0 0 8px var(--bsd-red)",
          transition: "width 180ms cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      />
    </div>
  );
}
