"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "../../lib/auth";

type NavItem = { href: string; label: string; adminOnly?: boolean };

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Analyze",
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/reviews", label: "Review queue" },
      { href: "/reasoning", label: "Reasoning" },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/simplify", label: "Simplify" },
      { href: "/negotiate", label: "Negotiate" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/search", label: "Search" },
      { href: "/comments", label: "Comments" },
      { href: "/exports", label: "Exports" },
      { href: "/feedback", label: "Feedback" },
    ],
  },
  {
    label: "Admin",
    items: [{ href: "/admin", label: "Admin", adminOnly: true }],
  },
];

export function SideNav() {
  const pathname = usePathname() ?? "/";
  const { me, role, logout } = useAuth();

  return (
    <aside className="side-nav glass">
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        <span>Clarifyd</span>
      </div>
      <p className="muted" style={{ marginTop: "-0.4rem" }}>
        Contract risk analyzer
      </p>

      <nav className="nav-list" aria-label="Primary">
        {NAV_SECTIONS.map((section) => {
          const visible = section.items.filter((n) => !n.adminOnly || role === "admin");
          if (!visible.length) return null;
          return (
            <div className="nav-section" key={section.label}>
              <div className="nav-section-title">{section.label}</div>
              {visible.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="nav-dot" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="user-card">
        <span className="role">{role ?? "guest"}</span>
        <span className="email">{me?.email ?? "—"}</span>
        <button type="button" className="ghost" onClick={logout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
