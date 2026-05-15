"use client";

import Link from "next/link";
import { useState } from "react";

export type ArcNavItem = {
  href: string;
  label: string;
  icon: string;
  active: boolean;
};

type Props = { items: ArcNavItem[] };

/**
 * "Adaptive Arc" mobile navigation (Stitch — Navigation - Adaptive Arc).
 * Floating bottom-right FAB; tap fans the nav items out along a quarter-arc
 * with a bubbly spring motion. Mobile only — desktop/tablet nav untouched.
 */
export function ArcMobileNav({ items }: Props) {
  const [open, setOpen] = useState(false);

  const n = items.length;
  // Fan from straight-up (-90deg) round to straight-left (180deg).
  const startDeg = -90;
  const endDeg = -185;
  const radius = n > 4 ? 168 : 150;

  function posFor(i: number) {
    const t = n === 1 ? 0 : i / (n - 1);
    const deg = startDeg + (endDeg - startDeg) * t;
    const rad = (deg * Math.PI) / 180;
    return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
  }

  return (
    <nav className="lg:hidden" aria-label="Mobile and tablet navigation">
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`arc-backdrop fixed inset-0 z-[55] bg-onboarding-navy/15 ${
          open
            ? "opacity-100 backdrop-blur-sm pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        aria-hidden
      />

      <div className="fixed bottom-8 right-6 z-[60]">
        {/* Arc bubbles */}
        {items.map((item, i) => {
          const { x, y } = posFor(i);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-label={item.label}
              tabIndex={open ? 0 : -1}
              className={`arc-bubble absolute bottom-2 right-2 w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-lg ${
                item.active
                  ? "bg-primary text-white"
                  : "crystal-glass text-on-surface-variant"
              }`}
              style={{
                transform: open
                  ? `translate(${x}px, ${y}px) scale(1)`
                  : "translate(0px, 0px) scale(0.2)",
                opacity: open ? 1 : 0,
                transitionDelay: open ? `${i * 45}ms` : `${(n - 1 - i) * 30}ms`,
              }}
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={item.active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className="font-label-caps text-[9px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}

        {/* FAB trigger */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className={`arc-fab relative z-20 w-16 h-16 rounded-full bg-onboarding-navy text-white shadow-2xl flex items-center justify-center active:scale-95 ${
            open ? "rotate-90" : "rotate-0"
          }`}
        >
          <span
            className="arc-fab-icon material-symbols-outlined text-[32px] absolute"
            style={{ opacity: open ? 0 : 1, transform: open ? "scale(0.4)" : "scale(1)" }}
          >
            menu
          </span>
          <span
            className="arc-fab-icon material-symbols-outlined text-[32px] absolute"
            style={{ opacity: open ? 1 : 0, transform: open ? "scale(1)" : "scale(0.4)" }}
          >
            close
          </span>
        </button>
      </div>
    </nav>
  );
}
