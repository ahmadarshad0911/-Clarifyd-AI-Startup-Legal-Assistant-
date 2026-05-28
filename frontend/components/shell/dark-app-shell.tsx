"use client";

/**
 * AppShell — Broadsheet · v6
 *
 * Export name kept (DarkAppShell) so all prior callers keep working.
 * Sidebar removed. Top masthead nav with primary + tools dropdown.
 * Inline-flow main area, no fixed chrome eating viewport.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { CaretDown, CaretRight, List, SignOut, User, X } from "@phosphor-icons/react";

import { useAuth } from "../../lib/auth";
import { useIsMobile } from "../../lib/use-is-mobile";

type NavItem = { href: string; label: string };

const NAV_PRIMARY: NavItem[] = [
  { href: "/dashboard",   label: "Dashboard" },
  { href: "/findings",    label: "Findings" },
  { href: "/copilot",     label: "Co-Pilot" },
  { href: "/negotiation", label: "Negotiate" },
];
const NAV_TOOLS: NavItem[] = [
  { href: "/reasoning",    label: "Reasoning" },
  { href: "/lawyer",       label: "Lawyer" },
  { href: "/library",      label: "Library" },
  { href: "/integrations", label: "Integrations" },
  { href: "/exports",      label: "Audit" },
  { href: "/feedback",     label: "Feedback" },
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
  const isMobile = useIsMobile();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const acctRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !token) router.replace("/login");
  }, [loading, token, router]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false);
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcctOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setToolsOpen(false);
    setAcctOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !token) {
    return (
      <main style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bsd-paper)" }}>
        <div style={{ padding: "22px 28px", border: "1.5px solid var(--bsd-ink)" }}>
          <div className="cf-eyebrow" style={{ color: "var(--bsd-red)" }}>Loading workspace</div>
          <div style={{ marginTop: 6, fontSize: 17, color: "var(--bsd-ink)", fontWeight: 600, letterSpacing: "-0.01em" }}>
            One moment.
          </div>
        </div>
      </main>
    );
  }

  const initial = (me?.email ?? role ?? "U")[0].toUpperCase();
  const adminItems = role === "admin" ? [{ href: "/admin", label: "Admin" }] : [];

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bsd-paper)", color: "var(--bsd-body)" }}>
      {/* ===== Masthead ===== */}
      <header
        style={
          isMobile
            ? {
                borderBottom: "3px double var(--bsd-ink)",
                padding: "12px 18px 10px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }
            : {
                borderBottom: "3px double var(--bsd-ink)",
                padding: "14px 28px 10px",
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                alignItems: "center",
                gap: 22,
              }
        }
      >
        <Link href="/dashboard" className="cursor-pointer" style={{ textDecoration: "none", display: "inline-flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: "Geist, sans-serif", fontWeight: 800, fontSize: 22, color: "var(--bsd-ink)", letterSpacing: "-0.04em", lineHeight: 1 }}>
            Clarifyd
          </span>
          <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700 }}>
            Workspace
          </span>
        </Link>

        {isMobile ? (
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="Menu"
            className="cursor-pointer"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40,
              background: mobileOpen ? "var(--bsd-ink)" : "transparent",
              color: mobileOpen ? "var(--bsd-paper)" : "var(--bsd-ink)",
              border: "1.5px solid var(--bsd-ink)",
              cursor: "pointer",
            }}
          >
            {mobileOpen ? <X weight="bold" size={18} /> : <List weight="bold" size={18} />}
          </button>
        ) : null}

        {/* Primary nav (desktop) */}
        {isMobile ? null : (
        <nav style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, flexWrap: "wrap" }}>
          {NAV_PRIMARY.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return <NavLink key={n.href} href={n.href} label={n.label} active={active} />;
          })}
          {/* Tools dropdown */}
          <div ref={toolsRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setToolsOpen((v) => !v)}
              aria-expanded={toolsOpen}
              className="cursor-pointer cf-mono"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "transparent", border: "none",
                color: NAV_TOOLS.some((n) => pathname.startsWith(n.href)) ? "var(--bsd-red)" : "var(--bsd-ink)",
                fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
                padding: "6px 0",
              }}
            >
              Tools <CaretDown weight="bold" size={10} style={{ transform: toolsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms var(--ease-out)" }} />
            </button>
            {toolsOpen ? (
              <div
                role="menu"
                style={{
                  position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
                  minWidth: 200,
                  background: "var(--bsd-paper)",
                  border: "1.5px solid var(--bsd-ink)",
                  padding: 4, zIndex: 60,
                  boxShadow: "0 12px 36px -12px rgba(12, 10, 8, 0.18)",
                }}
              >
                {[...NAV_TOOLS, ...adminItems].map((n) => {
                  const active = pathname === n.href || pathname.startsWith(n.href + "/");
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className="cursor-pointer cf-mono"
                      style={{
                        display: "block", padding: "8px 12px",
                        textDecoration: "none",
                        color: active ? "var(--bsd-red)" : "var(--bsd-ink)",
                        background: active ? "var(--bsd-paper-deep)" : "transparent",
                        fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700,
                        transition: "background var(--dur-base) ease, color var(--dur-base) ease",
                      }}
                      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "var(--bsd-paper-deep)"; e.currentTarget.style.color = "var(--bsd-red)"; } }}
                      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--bsd-ink)"; } }}
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </nav>
        )}

        {/* Account (desktop) */}
        {isMobile ? null : (
        <div ref={acctRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setAcctOpen((v) => !v)}
            aria-expanded={acctOpen}
            className="cursor-pointer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent", border: "1.5px solid var(--bsd-ink)",
              padding: "6px 10px 6px 6px",
              cursor: "pointer",
              transition: "background var(--dur-base) ease, color var(--dur-base) ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bsd-ink)"; e.currentTarget.style.color = "var(--bsd-paper)"; (e.currentTarget.querySelector(".acct-avatar") as HTMLElement).style.background = "var(--bsd-red)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--bsd-ink)"; (e.currentTarget.querySelector(".acct-avatar") as HTMLElement).style.background = "var(--bsd-ink)"; }}
          >
            <span
              className="acct-avatar cf-mono"
              style={{
                width: 26, height: 26,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "var(--bsd-ink)", color: "var(--bsd-paper)",
                fontSize: 11, fontWeight: 800,
                transition: "background var(--dur-base) ease",
              }}
            >
              {initial}
            </span>
            <span className="cf-mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
              {role ?? "viewer"}
            </span>
            <CaretDown weight="bold" size={9} style={{ transform: acctOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms var(--ease-out)" }} />
          </button>
          {acctOpen ? (
            <div
              role="menu"
              style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0,
                minWidth: 220,
                background: "var(--bsd-paper)",
                border: "1.5px solid var(--bsd-ink)",
                padding: 4, zIndex: 60,
                boxShadow: "0 12px 36px -12px rgba(12, 10, 8, 0.18)",
              }}
            >
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--bsd-hairline)" }}>
                <div style={{ fontSize: 13, color: "var(--bsd-ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {me?.email ?? "user"}
                </div>
                <div className="cf-mono" style={{ marginTop: 3, fontSize: 9.5, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                  {role ?? "viewer"}
                </div>
              </div>
              <MenuLink href="/profile" label="Profile" Icon={User} />
              {role === "admin" ? (
                <MenuLink href="/admin" label="Admin console" />
              ) : null}
              <MenuLink href="/" label="Landing" />
              <button
                type="button"
                onClick={() => {
                  setAcctOpen(false);
                  logout();
                  router.replace("/login");
                }}
                className="cursor-pointer cf-mono"
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px",
                  background: "transparent", border: "none",
                  color: "var(--bsd-red)",
                  fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700,
                  borderTop: "1px solid var(--bsd-hairline)", marginTop: 4,
                  cursor: "pointer",
                  transition: "background var(--dur-base) ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bsd-red-soft)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <SignOut weight="bold" size={11} /> Sign out
              </button>
            </div>
          ) : null}
        </div>
        )}

        {/* Mobile menu panel */}
        {isMobile && mobileOpen ? (
          <nav
            style={{
              width: "100%",
              flexBasis: "100%",
              marginTop: 14,
              display: "flex", flexDirection: "column", gap: 18,
            }}
          >
            {/* Account card */}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px",
                background: "var(--bsd-ink)", color: "var(--bsd-paper)",
              }}
            >
              <span
                className="cf-mono"
                style={{
                  width: 40, height: 40, flexShrink: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: "var(--bsd-red)", color: "var(--bsd-paper)",
                  fontSize: 16, fontWeight: 800,
                }}
              >
                {initial}
              </span>
              <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {me?.email ?? "user"}
                </span>
                <span className="cf-mono" style={{ fontSize: 9.5, color: "var(--bsd-faint)", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
                  {role ?? "viewer"} · workspace
                </span>
              </span>
            </div>

            <MobileNavGroup label="Navigate" items={NAV_PRIMARY} pathname={pathname} />
            <MobileNavGroup
              label="Tools"
              items={[...NAV_TOOLS, ...adminItems, { href: "/profile", label: "Profile" }]}
              pathname={pathname}
            />

            <button
              type="button"
              onClick={() => { setMobileOpen(false); logout(); router.replace("/login"); }}
              className="cursor-pointer cf-mono"
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                minHeight: 50, padding: "0 16px",
                background: "transparent", border: "1.5px solid var(--bsd-red)",
                color: "var(--bsd-red)",
                fontSize: 11.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800,
                cursor: "pointer",
              }}
            >
              <SignOut weight="bold" size={14} /> Sign out
            </button>
          </nav>
        ) : null}
      </header>

      {/* ===== Disclaimer dateline strip ===== */}
      <div
        style={{
          borderBottom: "1px solid var(--bsd-hairline)",
          padding: isMobile ? "8px 18px" : "8px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          fontFamily: "Geist Mono, monospace",
          fontSize: 9.5, color: "var(--bsd-muted)", letterSpacing: "0.18em",
          textTransform: "uppercase", fontWeight: 600,
        }}
      >
        <span>Pre-seed founders workspace</span>
        <span>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
      </div>

      {/* ===== Main pane ===== */}
      <main style={{ minWidth: 0 }}>
        {bare ? children : (
          <div style={{ padding: isMobile ? "24px 18px 56px" : "36px 28px 64px", maxWidth: 1280, margin: "0 auto" }}>
            {children}
          </div>
        )}
      </main>
    </div>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="cursor-pointer cf-mono"
      style={{
        position: "relative",
        textDecoration: "none",
        color: active ? "var(--bsd-red)" : "var(--bsd-ink)",
        fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
        padding: "6px 0",
        transition: "color var(--dur-base) ease",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--bsd-red)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--bsd-ink)"; }}
    >
      {label}
      {active ? (
        <span
          aria-hidden
          style={{
            position: "absolute", left: 0, right: 0, bottom: -3,
            height: 2, background: "var(--bsd-red)",
          }}
        />
      ) : null}
    </Link>
  );
}

function MobileNavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        className="cf-mono"
        style={{ color: "var(--bsd-red)", fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 800, paddingLeft: 2 }}
      >
        {label}
      </span>
      <div style={{ border: "1.5px solid var(--bsd-ink)" }}>
        {items.map((n, i) => {
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link
              key={n.href}
              href={n.href}
              className="cursor-pointer cf-mono"
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                minHeight: 50, padding: "0 16px",
                textDecoration: "none",
                color: active ? "var(--bsd-red)" : "var(--bsd-ink)",
                background: active ? "var(--bsd-paper-deep)" : "transparent",
                borderBottom: i < items.length - 1 ? "1px solid var(--bsd-hairline)" : "none",
                fontSize: 12.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700,
              }}
            >
              {n.label}
              <CaretRight weight="bold" size={13} color={active ? "var(--bsd-red)" : "var(--bsd-faint)"} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function MenuLink({ href, label, Icon }: { href: string; label: string; Icon?: typeof User }) {
  return (
    <Link
      href={href}
      className="cursor-pointer cf-mono"
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px",
        textDecoration: "none",
        color: "var(--bsd-ink)",
        fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700,
        transition: "background var(--dur-base) ease, color var(--dur-base) ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bsd-paper-deep)"; e.currentTarget.style.color = "var(--bsd-red)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--bsd-ink)"; }}
    >
      {Icon ? <Icon weight="duotone" size={12} /> : null}
      {label}
    </Link>
  );
}
