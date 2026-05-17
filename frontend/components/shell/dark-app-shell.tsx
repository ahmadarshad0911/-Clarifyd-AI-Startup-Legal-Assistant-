"use client";

/**
 * DarkAppShell — dark-editorial wrapper for Phase 2+ pages.
 *
 * Parallel to <AppShell> which keeps the existing crystal-glass aurora theme
 * for all routes not yet ported (Co-Pilot, Negotiate, Exports, Admin etc.).
 *
 * Responsibilities:
 *   - Auth gate (redirect to /login if no token)
 *   - Force dark canvas (overrides body's aurora gradient while mounted)
 *   - Sticky top nav with primary links + user avatar menu
 *   - Per-pathname active-link styling
 *
 * Children get a centered max-w-6xl container with breathing-room padding.
 * Pages can opt out of the container by passing `bare`.
 */

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "../../lib/auth";

type NavLink = { href: string; label: string; adminOnly?: boolean };

const NAV: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/findings", label: "Findings" },
  { href: "/copilot", label: "Co-Pilot" },
  { href: "/negotiation", label: "Negotiate" },
  { href: "/exports", label: "Audit" },
  { href: "/admin", label: "Admin", adminOnly: true },
];

export function DarkAppShell({
  children,
  bare = false,
}: {
  children: ReactNode;
  bare?: boolean;
}) {
  const { token, loading, me, role, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);

  // Override body's aurora gradient with dark canvas while DarkAppShell is mounted.
  useEffect(() => {
    const original = document.body.style.background;
    document.body.style.background = "#020617";
    return () => {
      document.body.style.background = original;
    };
  }, []);

  // Auth gate — kick to /login if not signed in.
  useEffect(() => {
    if (!loading && !token) router.replace("/login");
  }, [loading, token, router]);

  if (loading || !token) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "#020617",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div className="rounded-xl border border-white/10 bg-slate-900/60 px-8 py-6">
          <p className="text-slate-300">Loading workspace…</p>
        </div>
      </main>
    );
  }

  const items = NAV.filter((n) => !n.adminOnly || role === "admin");
  const initial = (me?.email ?? role ?? "U")[0].toUpperCase();

  return (
    <div
      className="min-h-screen text-slate-200"
      style={{
        background:
          "radial-gradient(ellipse 90% 30% at 50% 0%, rgba(99,102,241,0.07) 0%, transparent 60%), #020617",
        fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <header className="sticky top-0 inset-x-0 z-50 border-b border-white/5 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-7">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-slate-100 font-semibold tracking-tight cursor-pointer"
            >
              <span
                className="inline-block h-5 w-5 rounded-[6px]"
                style={{
                  background:
                    "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  boxShadow: "0 0 18px rgba(139,92,246,0.5)",
                }}
                aria-hidden
              />
              Clarifyd
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {items.map((it) => {
                const active = pathname === it.href || pathname.startsWith(it.href + "/");
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors duration-200 cursor-pointer ${
                      active
                        ? "text-white bg-white/10"
                        : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                    }`}
                  >
                    {it.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3 relative">
            <Link
              href="/"
              className="hidden md:inline text-xs text-slate-500 hover:text-slate-300 transition-colors duration-200 cursor-pointer"
            >
              ↗ landing
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-9 h-9 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-slate-100 text-sm font-semibold flex items-center justify-center transition-colors duration-200 cursor-pointer"
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              {initial}
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-12 min-w-[220px] rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md p-2 shadow-2xl z-50"
              >
                <div className="px-3 py-2 border-b border-white/5 mb-1">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    Signed in as
                  </div>
                  <div className="mt-0.5 text-sm text-slate-100 truncate">
                    {me?.email ?? "user"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">role: {role ?? "viewer"}</div>
                </div>
                <Link
                  href="/onboarding/profile"
                  className="block px-3 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  href="/feedback"
                  className="block px-3 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
                  onClick={() => setMenuOpen(false)}
                >
                  Feedback
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    router.replace("/login");
                  }}
                  className="block w-full text-left px-3 py-2 rounded-md text-sm text-rose-300 hover:text-rose-200 hover:bg-rose-950/30 cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className={bare ? "" : "mx-auto max-w-6xl px-6 py-10"}>
        {children}
      </main>
    </div>
  );
}
