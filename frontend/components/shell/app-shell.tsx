"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "../../lib/auth";
import { AuroraBackground } from "../common/aurora-background";
import { RevealChildren } from "../common/reveal-children";
import { DisclaimerGate } from "../disclaimer/disclaimer-banner";
import { ArcMobileNav } from "./arc-mobile-nav";
import { AuditChainBadge } from "./audit-chain-badge";

type Props = { children: ReactNode };

type NavLink = { href: string; label: string; icon: string; adminOnly?: boolean };

const PRIMARY_NAV: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/findings", label: "Findings", icon: "description" },
  { href: "/copilot", label: "Co-Pilot", icon: "auto_awesome" },
  // Was pointing to /negotiation (an older command-center page). The
  // user-facing risky-clauses + collaborator-document workflow lives at
  // /negotiate, so route the top-nav there.
  { href: "/negotiate", label: "Negotiate", icon: "handshake" },
  { href: "/feedback", label: "Feedback", icon: "rate_review" },
  { href: "/exports", label: "Audit", icon: "history_edu" },
  { href: "/admin", label: "Admin", icon: "shield", adminOnly: true },
];

export function AppShell({ children }: Props) {
  const { token, loading, me, role, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !token) router.replace("/login");
  }, [loading, token, router]);

  if (loading || !token) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <AuroraBackground />
        <div className="crystal-glass rounded-3xl px-8 py-6">
          <p className="text-on-surface-variant">Loading workspace…</p>
        </div>
      </main>
    );
  }

  const navItems = PRIMARY_NAV.filter((n) => !n.adminOnly || role === "admin");

  return (
    <DisclaimerGate>
      <AuroraBackground />
      <div className="min-h-screen text-on-surface font-body-lg pb-24">
        <header className="crystal-nav text-on-surface flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 w-full z-50 sticky top-0">
          <Link href="/dashboard" className="flex items-center gap-3 no-underline">
            <span className="material-symbols-outlined text-primary text-h2">gavel</span>
            <h1 className="font-display-hero text-h2 text-onboarding-navy m-0">Clarifyd</h1>
          </Link>
          <nav className="hidden lg:flex gap-6 items-center">
            {navItems.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-label-caps text-label-caps uppercase transition-colors ${
                    active ? "text-primary font-bold" : "text-on-surface-variant hover:text-primary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden lg:block">
              <AuditChainBadge />
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-10 h-10 rounded-full bg-primary-container/20 border border-glass-border flex items-center justify-center text-onboarding-navy font-bold hover:scale-105 transition-transform"
              aria-label="User menu"
            >
              {(me?.email ?? role ?? "U")[0].toUpperCase()}
            </button>
          </div>
          {menuOpen ? (
            <div className="absolute right-4 top-16 mt-2 crystal-glass rounded-2xl p-4 min-w-[220px] z-50 shadow-xl">
              <p className="text-label-caps font-label-caps text-on-surface-variant uppercase mb-1">
                {role ?? "guest"}
              </p>
              <p className="font-semibold text-on-surface text-body-sm break-all mb-3">
                {me?.email ?? "—"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="w-full px-3 py-2 rounded-lg border border-glass-border bg-white/60 text-body-sm font-semibold hover:bg-white/80 transition-all"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </header>

        <div
          className="sticky top-16 z-40 bg-[#78350f]/70 backdrop-blur-md py-2 px-margin-mobile text-white text-center text-body-sm font-semibold border-b border-white/20"
          role="note"
        >
          <span className="material-symbols-outlined text-[16px] align-middle mr-2">warning</span>
          Decision-support only — AI findings are informational. Consult legal counsel for binding advice.
        </div>

        <main className="max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop py-8 md:py-12 flex flex-col gap-8 min-w-0">
          <RevealChildren>{children}</RevealChildren>
        </main>

        <ArcMobileNav
          items={navItems.map((item) => ({
            href: item.href,
            label: item.label,
            icon: item.icon,
            active:
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href),
          }))}
        />
      </div>
    </DisclaimerGate>
  );
}
