"use client";

/**
 * /admin — Broadsheet · v6
 *
 * Editor-in-chief console. Role-guarded to admin only. Shows:
 *   - The Desk: top-line counts (users, drafts, feedback, signups 7d)
 *   - The Roster: full user table with role chip, draft count, joined date,
 *     verified state, delete action.
 *
 * Design follows the rest of the site: red double-rule plate, ink-on-ivory,
 * mono captions, sharp edges. Motion is opacity + Y, ease-out, reduced
 * for prefers-reduced-motion. Delete confirms through the themed
 * NoticeModal.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowsClockwise,
  Buildings,
  Crown,
  Files,
  GearSix,
  PaperPlaneTilt,
  ShieldStar,
  Trash,
  UsersThree,
} from "@phosphor-icons/react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { useIsMobile } from "../../lib/use-is-mobile";
import { NoticeModal, type NoticeContent } from "../../components/notice-modal";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import { Skeleton } from "../../components/common/skeleton";

const EOQ = [0.23, 1, 0.32, 1] as const;

type Row = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  email_verified: boolean;
  drafts: number;
};

type Stats = {
  users_total: number;
  users_last_7d: number;
  drafts_total: number;
  drafts_last_7d: number;
  feedback_total: number;
  admins: number;
};

export default function AdminPage() {
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const { client, role, token, loading } = useAuth();
  const { push } = useToast();

  const isMobile = useIsMobile();

  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeContent | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (role !== "admin") {
      router.replace("/dashboard");
    }
  }, [loading, role, token, router]);

  useEffect(() => {
    if (role !== "admin") return;
    let cancelled = false;
    setBusy(true);
    Promise.all([client.adminStats(), client.adminListUsers()])
      .then(([s, u]) => {
        if (cancelled) return;
        setStats(s);
        setRows(u.items);
      })
      .catch((err) => {
        if (cancelled) return;
        push(
          err instanceof ApiError ? err.message : "Could not load admin data.",
          "error"
        );
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, role, push, refreshKey]);

  const visibleRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.email.toLowerCase().includes(q) || r.role.toLowerCase().includes(q)
    );
  }, [rows, filter]);

  function askDelete(r: Row) {
    setNotice({
      kind: "rejection",
      caption: "STOP PRESS · DELETE USER",
      headline: `Remove ${r.email}?`,
      body: "This hard-deletes the user, every contract they own, and every analysis attached to those contracts. The action can't be undone.",
      hint: r.drafts > 0 ? `${r.drafts} contract${r.drafts === 1 ? "" : "s"} will be dropped.` : undefined,
      primaryLabel: "Delete user",
      secondaryLabel: "Cancel",
      onPrimary: async () => {
        try {
          await client.adminDeleteUser(r.id);
          setRows((prev) => prev.filter((x) => x.id !== r.id));
          push("User removed", "success", r.email);
          setRefreshKey((k) => k + 1);
        } catch (err) {
          push(
            err instanceof ApiError ? err.message : "Delete failed.",
            "error"
          );
        }
      },
    });
  }

  if (role !== "admin") return null;

  return (
    <AppShell>
      {/* Header */}
      <section style={{ paddingBottom: 22, borderBottom: "1px solid var(--bsd-hairline)" }}>
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EOQ }}
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <span
              className="bsd-kicker"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Crown weight="duotone" size={14} aria-hidden />
              Editor-in-chief
            </span>
            <h1
              style={{
                margin: "10px 0 0",
                fontSize: "clamp(36px, 5vw, 60px)",
                fontWeight: 700,
                color: "var(--bsd-ink)",
                letterSpacing: "-0.03em",
                lineHeight: 1.02,
              }}
            >
              Admin{" "}
              <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>
                console.
              </span>
            </h1>
            <p
              style={{
                margin: "12px 0 0",
                color: "var(--bsd-body)",
                fontSize: 15,
                lineHeight: 1.6,
                maxWidth: 560,
              }}
            >
              Live counts and the roster of every founder using Clarifyd. Delete
              with care — purges every contract owned by that account.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={busy}
            className="cursor-pointer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              background: "transparent",
              border: "1px solid var(--bsd-ink)",
              color: "var(--bsd-ink)",
              fontFamily: "Geist Mono, monospace",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontWeight: 700,
              borderRadius: 2,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.6 : 1,
              outline: "none",
              transition: "background 160ms ease, color 160ms ease, transform 100ms ease",
            }}
            onMouseEnter={(e) => {
              if (busy) return;
              e.currentTarget.style.background = "var(--bsd-ink)";
              e.currentTarget.style.color = "var(--bsd-paper)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--bsd-ink)";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.97)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <ArrowsClockwise weight="bold" size={12} />
            {busy ? "Reading…" : "Refresh"}
          </button>
        </motion.div>
      </section>

      <div style={{ maxWidth: 1100, margin: "32px auto 80px", display: "grid", gap: 28 }}>
        {/* The Desk (stats) */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: EOQ, delay: 0.05 }}
          style={{
            position: "relative",
            background: "var(--bsd-paper)",
            border: "1px solid var(--bsd-rule)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Rule />
          <div style={{ padding: "20px 32px 12px" }}>
            <div className="cf-mono" style={KICKER}>
              <Files weight="duotone" size={12} aria-hidden /> The desk · live counts
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))",
              borderTop: "1px solid var(--bsd-hairline)",
            }}
          >
            <Stat
              Icon={UsersThree}
              label="Total users"
              value={stats ? pad(stats.users_total) : "—"}
              footnote={stats ? `${stats.users_last_7d} joined this week` : ""}
            />
            <Stat
              Icon={Buildings}
              label="Contracts"
              value={stats ? pad(stats.drafts_total) : "—"}
              footnote={stats ? `${stats.drafts_last_7d} this week` : ""}
              divider
            />
            <Stat
              Icon={PaperPlaneTilt}
              label="Feedback filed"
              value={stats ? pad(stats.feedback_total) : "—"}
              divider
            />
            <Stat
              Icon={ShieldStar}
              label="Admins"
              value={stats ? pad(stats.admins) : "—"}
              divider
            />
          </div>
        </motion.section>

        {/* The Roster */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: EOQ, delay: 0.12 }}
          style={{
            background: "var(--bsd-paper)",
            border: "1px solid var(--bsd-rule)",
            borderRadius: 2,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <Rule />
          <div
            style={{
              padding: "20px 32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div className="cf-mono" style={KICKER}>
              <GearSix weight="duotone" size={12} aria-hidden /> The roster · {rows.length} accounts
            </div>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by email or role…"
              style={{
                width: 280,
                background: "var(--bsd-paper-low, var(--bsd-paper))",
                border: "1px solid var(--bsd-rule)",
                borderRadius: 2,
                padding: "8px 12px",
                fontSize: 13,
                color: "var(--bsd-ink)",
                outline: "none",
                fontFamily: "Geist Mono, monospace",
                transition: "border-color 160ms ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--bsd-red)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--bsd-rule)";
              }}
            />
          </div>

          <div style={{ borderTop: "1px solid var(--bsd-hairline)" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr auto" : "minmax(0, 3fr) 110px 110px 130px 60px",
                gap: 16,
                padding: isMobile ? "10px 18px" : "10px 32px",
                background: "var(--bsd-paper-low, var(--bsd-paper))",
                borderBottom: "1px solid var(--bsd-hairline)",
              }}
              className="cf-mono"
            >
              <Th>Email</Th>
              {!isMobile && <Th>Role</Th>}
              {!isMobile && <Th>Drafts</Th>}
              {!isMobile && <Th>Joined</Th>}
              <Th align="right">Action</Th>
            </div>
            {visibleRows.length === 0 ? (
              busy ? (
                <div style={{ padding: "12px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                        <Skeleton width="42%" height={14} />
                        <Skeleton width="22%" height={9} />
                      </div>
                      <Skeleton width={70} height={22} />
                      <Skeleton width={28} height={28} />
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: "36px 32px",
                    textAlign: "center",
                    color: "var(--bsd-muted)",
                    fontStyle: "italic",
                  }}
                >
                  No accounts match.
                </div>
              )
            ) : (
              visibleRows.map((r, i) => (
                <UserRow
                  key={r.id}
                  row={r}
                  zebra={i % 2 === 1}
                  isMobile={isMobile}
                  onDelete={() => askDelete(r)}
                />
              ))
            )}
          </div>
        </motion.section>
      </div>

      <NoticeModal open={notice !== null} notice={notice} onClose={() => setNotice(null)} />
    </AppShell>
  );
}

const KICKER = {
  display: "inline-flex" as const,
  alignItems: "center" as const,
  gap: 8,
  fontFamily: "Geist Mono, ui-monospace, monospace",
  fontSize: 10.5,
  letterSpacing: "0.20em",
  textTransform: "uppercase" as const,
  color: "var(--bsd-red)",
  fontWeight: 800,
};

function Rule() {
  return (
    <>
      <div
        aria-hidden
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "var(--bsd-red)" }}
      />
      <div
        aria-hidden
        style={{ position: "absolute", top: 5, left: 0, right: 0, height: 1, background: "var(--bsd-red)", opacity: 0.4 }}
      />
    </>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function Stat({
  Icon,
  label,
  value,
  footnote,
  divider,
}: {
  Icon: typeof UsersThree;
  label: string;
  value: string;
  footnote?: string;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        padding: "22px 24px 24px",
        borderLeft: divider ? "1px dotted var(--bsd-hairline)" : "none",
      }}
    >
      <div
        className="cf-mono"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "Geist Mono, monospace",
          fontSize: 9.5,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--bsd-muted)",
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        <Icon weight="duotone" size={12} color="var(--bsd-red)" aria-hidden />
        {label}
      </div>
      <div
        className="tabular-nums"
        style={{
          fontFamily: "Geist Mono, monospace",
          fontSize: 30,
          fontWeight: 600,
          color: "var(--bsd-ink)",
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {footnote ? (
        <div
          className="cf-mono"
          style={{
            marginTop: 8,
            fontFamily: "Geist Mono, monospace",
            fontSize: 10,
            letterSpacing: "0.04em",
            color: "var(--bsd-muted)",
          }}
        >
          {footnote}
        </div>
      ) : null}
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <span
      style={{
        fontFamily: "Geist Mono, monospace",
        fontSize: 9.5,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "var(--bsd-muted)",
        fontWeight: 700,
        textAlign: align ?? "left",
      }}
    >
      {children}
    </span>
  );
}

function UserRow({
  row,
  zebra,
  isMobile,
  onDelete,
}: {
  row: Row;
  zebra: boolean;
  isMobile: boolean;
  onDelete: () => void;
}) {
  const dateStr = useMemo(() => {
    try {
      return new Date(row.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  }, [row.created_at]);

  const isAdmin = row.role === "admin";

  const deleteBtn = (
    <button
      type="button"
      onClick={onDelete}
      aria-label={`Delete ${row.email}`}
      className="cursor-pointer"
      disabled={isAdmin}
      title={isAdmin ? "Cannot delete admin" : "Delete user + all their contracts"}
      style={{
        display: "grid",
        placeItems: "center",
        width: 30,
        height: 30,
        background: "transparent",
        border: `1px solid ${isAdmin ? "var(--bsd-rule)" : "var(--bsd-red)"}`,
        color: isAdmin ? "var(--bsd-rule)" : "var(--bsd-red)",
        borderRadius: 2,
        cursor: isAdmin ? "not-allowed" : "pointer",
        outline: "none",
        transition: "background 140ms ease, color 140ms ease, transform 100ms ease",
        opacity: isAdmin ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (isAdmin) return;
        e.currentTarget.style.background = "var(--bsd-red)";
        e.currentTarget.style.color = "var(--bsd-paper)";
      }}
      onMouseLeave={(e) => {
        if (isAdmin) return;
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--bsd-red)";
      }}
      onMouseDown={(e) => {
        if (isAdmin) return;
        e.currentTarget.style.transform = "scale(0.94)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <Trash weight="bold" size={12} />
    </button>
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr auto" : "minmax(0, 3fr) 110px 110px 130px 60px",
        gap: 16,
        padding: isMobile ? "14px 18px" : "14px 32px",
        alignItems: "center",
        borderBottom: "1px dotted var(--bsd-hairline)",
        background: zebra ? "var(--bsd-paper-low, transparent)" : "transparent",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: "var(--bsd-ink)",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={row.email}
        >
          {row.email}
        </div>
        <div
          className="cf-mono"
          style={{
            marginTop: 3,
            fontFamily: "Geist Mono, monospace",
            fontSize: 10,
            letterSpacing: "0.04em",
            color: row.email_verified ? "var(--bsd-sev-clean, #4f7d3f)" : "var(--bsd-muted)",
            fontWeight: 700,
          }}
        >
          {row.email_verified ? "verified" : "unverified"} · {row.id.slice(0, 8)}…
        </div>
        {isMobile && (
          <div
            className="cf-mono"
            style={{
              marginTop: 5,
              fontFamily: "Geist Mono, monospace",
              fontSize: 10,
              letterSpacing: "0.04em",
              color: "var(--bsd-muted)",
              fontWeight: 700,
            }}
          >
            {row.role} · {pad(row.drafts)} draft{row.drafts === 1 ? "" : "s"} · {dateStr}
          </div>
        )}
      </div>

      {!isMobile && (
        <span
          className="cf-mono"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 10px",
            background: isAdmin ? "var(--bsd-ink)" : "transparent",
            color: isAdmin ? "var(--bsd-paper)" : "var(--bsd-body)",
            border: `1px solid ${isAdmin ? "var(--bsd-ink)" : "var(--bsd-rule)"}`,
            fontFamily: "Geist Mono, monospace",
            fontSize: 9.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 800,
            borderRadius: 2,
            width: "max-content",
          }}
        >
          {isAdmin ? <Crown weight="duotone" size={11} /> : null}
          {row.role}
        </span>
      )}

      {!isMobile && (
        <span
          className="tabular-nums"
          style={{
            fontFamily: "Geist Mono, monospace",
            fontSize: 13,
            fontWeight: 600,
            color: row.drafts > 0 ? "var(--bsd-ink)" : "var(--bsd-muted)",
          }}
        >
          {pad(row.drafts)}
        </span>
      )}

      {!isMobile && (
        <span
          className="cf-mono"
          style={{
            fontFamily: "Geist Mono, monospace",
            fontSize: 11,
            color: "var(--bsd-body)",
            letterSpacing: "0.04em",
          }}
        >
          {dateStr}
        </span>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {deleteBtn}
      </div>
    </div>
  );
}
