"use client";

/**
 * PremiumCursor — bespoke cursor for the landing page.
 *
 *   - Small solid dot follows the pointer 1:1.
 *   - Larger soft ring trails with eased lerp.
 *   - Ring scales + glows on hoverable targets (a, button, [data-cursor],
 *     input, textarea).
 *   - Click squishes the ring.
 *   - Auto-disabled on touch / coarse pointers + on `prefers-reduced-motion`.
 *   - Native cursor is hidden on the landing root only — restored elsewhere.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function PremiumCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  // Portal target — only set after mount so SSR doesn't try to read `document`.
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (coarse || reduced) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    // Add a class to the landing root so we can hide the native cursor
    // without affecting the rest of the app.
    document.body.classList.add("premium-cursor-on");

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let raf = 0;

    function loop() {
      // Lerp factor — ring trails behind the dot.
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      dot!.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      ring!.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    function onMove(e: MouseEvent) {
      mx = e.clientX;
      my = e.clientY;
    }
    function onDown() { ring!.classList.add("is-down"); }
    function onUp()   { ring!.classList.remove("is-down"); }

    // Identify interactive targets and expand the ring while hovering them.
    const HOVER_SELECTOR =
      'a, button, [role="button"], [data-cursor], input, textarea, select, label';
    function onOver(e: MouseEvent) {
      const t = e.target as Element | null;
      if (!t) return;
      if (t.closest(HOVER_SELECTOR)) {
        ring!.classList.add("is-hover");
      }
    }
    function onOut(e: MouseEvent) {
      const t = e.target as Element | null;
      if (!t) return;
      if (t.closest(HOVER_SELECTOR)) {
        ring!.classList.remove("is-hover");
      }
    }
    // Hide both when the pointer leaves the window.
    function onWinLeave() {
      dot!.style.opacity = "0";
      ring!.style.opacity = "0";
    }
    function onWinEnter() {
      dot!.style.opacity = "";
      ring!.style.opacity = "";
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mouseover", onOver);
    window.addEventListener("mouseout", onOut);
    document.addEventListener("mouseleave", onWinLeave);
    document.addEventListener("mouseenter", onWinEnter);

    return () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove("premium-cursor-on");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mouseout", onOut);
      document.removeEventListener("mouseleave", onWinLeave);
      document.removeEventListener("mouseenter", onWinEnter);
    };
    // Re-run after portal mounts so dotRef / ringRef are populated.
  }, [portalEl]);

  if (!portalEl) return null;
  // Portal to <body> so `position: fixed` is anchored to the viewport, not
  // any ancestor that establishes a containing block (the landing root
  // uses `perspective`, which captures fixed children — that's why the
  // cursor was stuck at the hero before).
  return createPortal(
    <>
      <div ref={ringRef} className="premium-cursor-ring" aria-hidden />
      <div ref={dotRef} className="premium-cursor-dot" aria-hidden />
    </>,
    portalEl
  );
}
