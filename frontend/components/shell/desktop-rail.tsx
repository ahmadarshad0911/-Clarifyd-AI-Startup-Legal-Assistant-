"use client";

/**
 * DesktopRail — collapsible glass side menu, desktop only (lg:+).
 *
 *   Default state: COLLAPSED. The narrow 56-px rail sits in the page's
 *   left margin gutter (max-w-container-max mx-auto leaves room) and
 *   does not overlap any content. The user can expand to 248 px on
 *   demand; while expanded it overlays content briefly (acceptable for
 *   active interaction) — collapse re-hides it.
 *
 *   Two completely separate render branches for COLLAPSED vs EXPANDED so
 *   hidden labels never steal layout space (which was breaking the badge
 *   alignment in collapsed mode).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../lib/auth";

type RailItem = { href: string; label: string; icon: string; adminOnly?: boolean };

// Only ship-ready pages. Trimmed Reviews, Reasoning, Simplify, Compare,
// Compliance, Audit — those routes exist as scaffolds but aren't part of
// the user-facing flow yet.
const RAIL_NAV: RailItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/findings",  label: "Findings",  icon: "description" },
  { href: "/copilot",   label: "Co-Pilot",  icon: "auto_awesome" },
  { href: "/negotiate", label: "Negotiate", icon: "handshake" },
  { href: "/feedback",  label: "Feedback",  icon: "rate_review" },
  { href: "/admin",     label: "Admin",     icon: "shield", adminOnly: true },
];

type Plan = {
  name: string;
  badge: string;
  tone: "free" | "pro" | "enterprise";
  blurb: string;
  cta: { label: string; href: string } | null;
};

function planFor(role: string | null): Plan {
  if (role === "admin") {
    return {
      name: "Enterprise",
      badge: "ENT",
      tone: "enterprise",
      blurb: "Unlimited drafts · SSO · dedicated reviewer",
      cta: null,
    };
  }
  if (role === "reviewer") {
    return {
      name: "Pro",
      badge: "PRO",
      tone: "pro",
      blurb: "50 drafts/mo · Kimi K2.6 · PDF export",
      cta: { label: "Manage plan", href: "/pricing" },
    };
  }
  return {
    name: "Free",
    badge: "FREE",
    tone: "free",
    blurb: "3 drafts/mo · rules-only fallback",
    cta: { label: "Upgrade", href: "/pricing" },
  };
}

const STORAGE_KEY = "clarifyd.rail.collapsed";
const W_COLLAPSED = 56;
const W_EXPANDED = 248;

export function DesktopRail() {
  const pathname = usePathname() ?? "/";
  const { role, me } = useAuth();
  // Default collapsed so the rail tucks into the page's left margin and
  // never disturbs the main grid on first paint.
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // Only flip off the default if the user explicitly set "0".
      if (raw === "0") setCollapsed(false);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const items = useMemo(
    () => RAIL_NAV.filter((n) => !n.adminOnly || role === "admin"),
    [role]
  );

  const plan = useMemo<Plan>(() => {
    try {
      const raw = window?.localStorage?.getItem("clarifyd.plan");
      if (raw) {
        const p = JSON.parse(raw) as Partial<Plan>;
        if (p?.name && p?.tone) return { ...planFor(role), ...p } as Plan;
      }
    } catch {
      /* ignore */
    }
    return planFor(role);
  }, [role, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  const planBg =
    plan.tone === "enterprise"
      ? "linear-gradient(135deg, #1E3A8A 0%, #3525cd 100%)"
      : plan.tone === "pro"
        ? "linear-gradient(135deg, #3525cd 0%, #7c3aed 100%)"
        : "linear-gradient(135deg, #3525cd, #7c3aed)";
  const planFg = plan.tone === "free" ? "#1E3A8A" : "#fff";

  return (
    <aside
      className={`hidden lg:flex flex-col fixed left-2 z-40 top-[120px] bottom-4 rail-glass rounded-2xl ${collapsed ? "rail-ghost" : ""}`}
      style={{
        width: `${collapsed ? W_COLLAPSED : W_EXPANDED}px`,
        padding: collapsed ? "10px 6px" : "12px",
        gap: collapsed ? "10px" : "8px",
        transition:
          "width 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), padding 0.4s ease, opacity 0.3s ease, background 0.3s ease, box-shadow 0.3s ease, backdrop-filter 0.3s ease",
      }}
      aria-label="Workspace navigation"
    >
      {collapsed ? (
        /* ============ COLLAPSED LAYOUT ============ */
        <>
          {/* Plan badge — square chip, centered, no extra flex children */}
          <Link
            href={plan.cta?.href ?? "#"}
            title={`${plan.name} plan`}
            className="self-center inline-flex items-center justify-center w-11 h-11 rounded-xl font-bold text-[10px] uppercase tracking-wider text-white plan-badge-pulse"
            style={{
              background: planBg,
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 18px -8px rgba(124,58,237,0.55)",
            }}
          >
            {plan.badge}
          </Link>

          <span className="h-px mx-2 bg-on-surface-variant/15" aria-hidden />

          {/* Icon-only nav */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar">
            <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
              {items.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href} className="flex justify-center">
                    <Link
                      href={item.href}
                      title={item.label}
                      aria-label={item.label}
                      className={`rail-icon-btn ${active ? "is-active" : ""}`}
                    >
                      <span
                        className="material-symbols-outlined text-[22px]"
                        style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        {item.icon}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer: user avatar + expand toggle, both centered */}
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-on-surface-variant/15">
            <span
              className="inline-flex items-center justify-center w-9 h-9 rounded-full font-bold text-onboarding-navy bg-white/80 border border-white/85"
              title={me?.email ?? role ?? "guest"}
            >
              {(me?.email ?? role ?? "U")[0]?.toUpperCase()}
            </span>
            <button
              type="button"
              onClick={toggle}
              aria-label="Expand menu"
              aria-pressed
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/70 border border-white/80 hover:bg-white transition-colors text-on-surface-variant"
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{
                  transform: "rotate(180deg)",
                  transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              >
                chevron_left
              </span>
            </button>
          </div>
        </>
      ) : (
        /* ============ EXPANDED LAYOUT ============ */
        <>
          {/* Plan card — full row */}
          <Link
            href={plan.cta?.href ?? "#"}
            className={`group flex items-center gap-3 rounded-xl p-2 plan-card-${plan.tone}`}
            style={{
              background:
                plan.tone === "free"
                  ? "rgba(255,255,255,0.55)"
                  : planBg,
              boxShadow:
                plan.tone === "free"
                  ? "inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 6px -2px rgba(15,23,42,0.08)"
                  : "0 6px 22px -10px rgba(124,58,237,0.6), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            <span
              className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl font-bold text-[10px] uppercase tracking-wider text-white"
              style={{
                background:
                  plan.tone === "free"
                    ? "linear-gradient(135deg, #3525cd, #7c3aed)"
                    : "rgba(255,255,255,0.18)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
              }}
            >
              {plan.badge}
            </span>
            <span className="min-w-0 flex-1 overflow-hidden">
              <span
                className="block font-display-hero text-[15px] leading-tight"
                style={{ color: planFg }}
              >
                {plan.name} plan
              </span>
              <span
                className="block text-[10px] mt-0.5 truncate"
                style={{
                  color: plan.tone === "free" ? "rgba(70,69,85,0.85)" : "rgba(255,255,255,0.85)",
                }}
              >
                {plan.blurb}
              </span>
            </span>
            {plan.cta ? (
              <span
                className="material-symbols-outlined text-[18px] shrink-0 group-hover:translate-x-0.5 transition-transform"
                style={{ color: planFg }}
              >
                arrow_forward
              </span>
            ) : null}
          </Link>

          <span className="h-px mx-2 bg-on-surface-variant/15" aria-hidden />

          {/* Full nav list */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar -mx-1 px-1">
            <ul className="flex flex-col gap-1 m-0 p-0 list-none">
              {items.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`rail-item ${active ? "is-active" : ""}`}
                    >
                      <span className="rail-item-glow" aria-hidden />
                      <span
                        className="material-symbols-outlined rail-item-icon"
                        style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        {item.icon}
                      </span>
                      <span className="rail-item-label">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer: user chip + collapse toggle */}
          <div className="flex items-center gap-2 pt-3 mt-1 border-t border-on-surface-variant/15">
            <span
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full font-bold text-onboarding-navy bg-white/70 border border-white/80"
              title={me?.email ?? role ?? "guest"}
            >
              {(me?.email ?? role ?? "U")[0]?.toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 overflow-hidden">
              <span className="block text-[11px] font-bold text-on-surface truncate">
                {me?.email ?? "Guest"}
              </span>
              <span className="block text-[9px] uppercase tracking-widest text-on-surface-variant">
                {role ?? "viewer"}
              </span>
            </span>
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse menu"
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/60 border border-white/70 hover:bg-white/90 transition-colors text-on-surface-variant"
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
              >
                chevron_left
              </span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
