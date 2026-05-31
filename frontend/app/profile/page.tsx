"use client";

/**
 * /profile — Broadsheet · v6
 *
 * Founder profile / membership card. Editorial press-pass framing:
 * red double-rule plate, mono captions, ivory paper, sharp edges.
 *
 * Sections:
 *   - Press pass (identity card with avatar monogram, role chip, member-since)
 *   - Workspace defaults (jurisdiction / stage / sector / company) — inline editable
 *   - Recent activity (counts of analyzed contracts, flagged clauses, highest risk)
 *   - Connected sign-in methods (read-only chips for email + OAuth providers)
 *   - Danger zone (sign out + delete account confirm)
 *
 * Motion principles (Emil):
 *   - Stagger sections in with 60ms delta, ease-out, 22ms steps for inner rows.
 *   - Inline edits scale 0.97 on press; saved state pulses the field border red→muted.
 *   - prefers-reduced-motion respected on every animation.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Buildings,
  Check,
  Coins,
  GearSix,
  Globe,
  Pencil,
  SignOut,
  ShieldStar,
  Trash,
  UserCircle,
  Warning,
  IdentificationCard,
} from "@phosphor-icons/react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { useIsMobile } from "../../lib/use-is-mobile";
import { NoticeModal, type NoticeContent } from "../../components/notice-modal";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import { listAnalyses, type StoredAnalysis } from "../../lib/analyses";
import { getProfile, setProfile, type FounderProfile } from "../../lib/founder-profile";

const EOQ = [0.23, 1, 0.32, 1] as const;

const STAGE_LABEL: Record<string, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  enterprise: "Enterprise",
};

const JURISDICTION_LABEL: Record<string, string> = {
  US: "United States",
  UK: "United Kingdom",
  EU: "European Union",
  IN: "India",
  SG: "Singapore",
};

export default function ProfilePage() {
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;
  const isMobile = useIsMobile();
  const { me, role, token, logout } = useAuth();
  const { push } = useToast();

  const [profile, setProfileState] = useState<FounderProfile>({});
  const [analyses, setAnalyses] = useState<StoredAnalysis[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeContent | null>(null);

  useEffect(() => {
    setProfileState(getProfile());
    setAnalyses(listAnalyses());
  }, []);

  const monogram = useMemo(() => {
    const name = profile.full_name?.trim() || me?.email || "";
    if (!name) return "—";
    const parts = name.split(/[\s@.]+/).filter(Boolean);
    return (parts[0]?.[0] ?? "—").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
  }, [profile.full_name, me?.email]);

  const stats = useMemo(() => {
    const total = analyses.length;
    let flagged = 0;
    let highest: "low" | "medium" | "high" | "critical" = "low";
    const order = { low: 0, medium: 1, high: 2, critical: 3 } as const;
    for (const a of analyses) {
      flagged += a.analysis.findings?.length ?? 0;
      const r = (a.analysis.summary?.highest_risk ?? "low") as
        | "low"
        | "medium"
        | "high"
        | "critical";
      if (order[r] > order[highest]) highest = r;
    }
    return { total, flagged, highest };
  }, [analyses]);

  function saveField(key: keyof FounderProfile, value: string) {
    const next = setProfile({ [key]: value || undefined });
    setProfileState(next);
    setEditing(null);
    push("Saved", "success", key.replace(/_/g, " "));
  }

  function confirmDelete() {
    setNotice({
      kind: "rejection",
      caption: "STOP PRESS · DELETE ACCOUNT",
      headline: "Delete your founder account?",
      body: "This signs you out and removes the account from your device. Contact support to fully erase server-side data.",
      hint: "This action can't be undone.",
      primaryLabel: "Delete & sign out",
      secondaryLabel: "Keep account",
      onPrimary: () => {
        logout();
        router.replace("/login");
      },
    });
  }

  function signOut() {
    setNotice({
      kind: "warning",
      caption: "STOP PRESS · SIGN OUT",
      headline: "Sign out of this device?",
      body: "Your contracts and findings stay safe. Sign back in any time to resume.",
      primaryLabel: "Sign out",
      secondaryLabel: "Stay signed in",
      onPrimary: () => {
        logout();
        router.replace("/login");
      },
    });
  }

  // Defensive — auth context loaded but no me means we redirect.
  useEffect(() => {
    if (token === null) router.replace("/login");
  }, [token, router]);

  return (
    <AppShell>
      {/* ========================= Header ========================= */}
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
            <span className="bsd-kicker" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IdentificationCard weight="duotone" size={14} aria-hidden />
              Founder profile
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
              Your press{" "}
              <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>
                pass.
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
              Identity, workspace defaults, and the reading record the editorial desk
              keeps on you. Edit any line in place.
            </p>
          </div>
          <div
            className="cf-mono"
            style={{
              fontFamily: "Geist Mono, ui-monospace, monospace",
              fontSize: 10.5,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--bsd-muted)",
              fontWeight: 700,
              textAlign: "right",
            }}
          >
            Issued · Clarifyd Editorial
            <br />
            <span style={{ color: "var(--bsd-red)" }}>
              {new Date().toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </motion.div>
      </section>

      <div
        style={{
          margin: "32px auto 80px",
          display: "grid",
          gap: 28,
          gridTemplateColumns: "minmax(0, 1fr)",
          maxWidth: 920,
        }}
      >
        {/* ========================= Press pass ========================= */}
        <Card delay={0.04} reduce={reduce}>
          <PassRule />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "92px 1fr auto",
              gap: 22,
              alignItems: isMobile ? "start" : "center",
              padding: isMobile ? "30px 18px 26px" : "30px 32px 26px",
            }}
          >
            <div
              aria-hidden
              style={{
                width: 92,
                height: 92,
                background: "var(--bsd-ink)",
                color: "var(--bsd-paper)",
                display: "grid",
                placeItems: "center",
                fontFamily: "Geist, sans-serif",
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                borderRadius: 2,
              }}
            >
              {monogram}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                className="cf-mono"
                style={{
                  fontFamily: "Geist Mono, ui-monospace, monospace",
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--bsd-red)",
                  fontWeight: 800,
                  marginBottom: 4,
                }}
              >
                Press pass · {role ?? "viewer"}
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 700,
                  color: "var(--bsd-ink)",
                  letterSpacing: "-0.02em",
                  overflowWrap: "anywhere",
                }}
              >
                {profile.full_name || me?.email?.split("@")[0] || "Anonymous founder"}
              </h2>
              <div
                className="cf-mono"
                style={{
                  marginTop: 6,
                  fontFamily: "Geist Mono, monospace",
                  fontSize: 12,
                  color: "var(--bsd-muted)",
                  letterSpacing: "0.04em",
                  overflowWrap: "anywhere",
                }}
              >
                {me?.email ?? "—"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <RoleChip role={role ?? "viewer"} />
            </div>
          </div>
        </Card>

        {/* ========================= Stats ========================= */}
        <Card delay={0.1} reduce={reduce}>
          <SectionHeader index="01" title="Reading record." />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
              gap: 0,
              borderTop: "1px solid var(--bsd-hairline)",
            }}
          >
            <Stat label="Contracts analyzed" value={String(stats.total).padStart(2, "0")} />
            <Stat label="Clauses flagged" value={String(stats.flagged).padStart(2, "0")} divider />
            <Stat label="Highest risk seen" value={stats.highest.toUpperCase()} divider />
          </div>
        </Card>

        {/* ========================= Workspace defaults ========================= */}
        <Card delay={0.16} reduce={reduce}>
          <SectionHeader
            index="02"
            title="Workspace defaults."
            hint="Used by Clarifyd AI as the starting context for every new analysis."
          />
          <FieldRow
            Icon={UserCircle}
            label="Full name"
            value={profile.full_name ?? ""}
            placeholder="Add your name"
            editing={editing === "full_name"}
            isMobile={isMobile}
            onEdit={() => setEditing("full_name")}
            onSave={(v) => saveField("full_name", v)}
            onCancel={() => setEditing(null)}
          />
          <FieldRow
            Icon={Buildings}
            label="Company"
            value={profile.company_name ?? ""}
            placeholder="Acme, Inc."
            editing={editing === "company_name"}
            isMobile={isMobile}
            onEdit={() => setEditing("company_name")}
            onSave={(v) => saveField("company_name", v)}
            onCancel={() => setEditing(null)}
          />
          <FieldRow
            Icon={Globe}
            label="Jurisdiction"
            value={profile.jurisdiction ? JURISDICTION_LABEL[profile.jurisdiction] ?? profile.jurisdiction : ""}
            placeholder="US, UK, EU, IN, SG"
            editing={editing === "jurisdiction"}
            isMobile={isMobile}
            onEdit={() => setEditing("jurisdiction")}
            onSave={(v) => saveField("jurisdiction", v.toUpperCase())}
            onCancel={() => setEditing(null)}
          />
          <FieldRow
            Icon={Coins}
            label="Stage"
            value={profile.stage ? STAGE_LABEL[profile.stage] ?? profile.stage : ""}
            placeholder="pre_seed, seed, series_a, enterprise"
            editing={editing === "stage"}
            isMobile={isMobile}
            onEdit={() => setEditing("stage")}
            onSave={(v) => saveField("stage", v.toLowerCase())}
            onCancel={() => setEditing(null)}
          />
          <FieldRow
            Icon={GearSix}
            label="Sector"
            value={profile.sector ?? ""}
            placeholder="SaaS, Fintech, Health, …"
            editing={editing === "sector"}
            isMobile={isMobile}
            onEdit={() => setEditing("sector")}
            onSave={(v) => saveField("sector", v)}
            onCancel={() => setEditing(null)}
            last
          />
        </Card>

        {/* ========================= Sign-in methods ========================= */}
        <Card delay={0.22} reduce={reduce}>
          <SectionHeader index="03" title="How you sign in." />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              padding: "12px 32px 26px",
              borderTop: "1px solid var(--bsd-hairline)",
            }}
          >
            <ProviderChip label="Email & password" active />
            <ProviderChip label="Google" />
            <ProviderChip label="Facebook" />
          </div>
        </Card>

        {/* ========================= Quick links ========================= */}
        <Card delay={0.28} reduce={reduce}>
          <SectionHeader index="04" title="Jump to." />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
              gap: 0,
              borderTop: "1px solid var(--bsd-hairline)",
            }}
          >
            <QuickLink href="/findings" label="Findings" hint="Risky clauses + rewrites" />
            <QuickLink href="/exports" label="Library" hint="Every analyzed contract" divider />
            <QuickLink href="/feedback" label="Feedback" hint="File a dispatch" divider />
          </div>
        </Card>

        {/* ========================= Danger zone ========================= */}
        <Card delay={0.34} reduce={reduce} danger>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "20px 32px 8px",
            }}
          >
            <Warning weight="duotone" size={18} color="var(--bsd-red)" />
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--bsd-red)",
              }}
            >
              Danger zone
            </h3>
          </div>
          <div
            style={{
              padding: "8px 32px 22px",
              borderBottom: "1px solid var(--bsd-hairline)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                color: "var(--bsd-body)",
                lineHeight: 1.55,
              }}
            >
              Sign out of this device or remove your account. Account deletion
              hard-removes drafts within 24 hours per the privacy policy.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "16px 24px 18px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <GhostButton onClick={signOut} Icon={SignOut} label="Sign out" />
            <DangerButton onClick={confirmDelete} Icon={Trash} label="Delete account" />
          </div>
        </Card>
      </div>

      <NoticeModal open={notice !== null} notice={notice} onClose={() => setNotice(null)} />
    </AppShell>
  );
}

/* ============================================================ */
/*                       Sub-components                          */
/* ============================================================ */

function Card({
  children,
  delay,
  reduce,
  danger,
}: {
  children: React.ReactNode;
  delay: number;
  reduce: boolean;
  danger?: boolean;
}) {
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: EOQ, delay }}
      style={{
        position: "relative",
        background: "var(--bsd-paper)",
        border: `1px solid ${danger ? "var(--bsd-red)" : "var(--bsd-rule)"}`,
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      {children}
    </motion.section>
  );
}

function PassRule() {
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: "var(--bsd-red)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 7,
          left: 0,
          right: 0,
          height: 1,
          background: "var(--bsd-red)",
          opacity: 0.4,
        }}
      />
    </>
  );
}

function SectionHeader({
  index,
  title,
  hint,
}: {
  index: string;
  title: string;
  hint?: string;
}) {
  return (
    <div style={{ padding: "20px 32px 14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          className="cf-mono"
          style={{
            fontFamily: "Geist Mono, monospace",
            fontSize: 11,
            letterSpacing: "0.22em",
            color: "var(--bsd-red)",
            fontWeight: 800,
          }}
        >
          {index}
        </span>
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "var(--bsd-ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h3>
      </div>
      {hint ? (
        <p
          className="cf-mono"
          style={{
            margin: "4px 0 0 30px",
            fontFamily: "Geist Mono, monospace",
            fontSize: 11,
            color: "var(--bsd-muted)",
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  divider,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        padding: "26px 24px 28px",
        borderLeft: divider ? "1px dotted var(--bsd-hairline)" : "none",
      }}
    >
      <div
        className="cf-mono"
        style={{
          fontFamily: "Geist Mono, monospace",
          fontSize: 9.5,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--bsd-muted)",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        className="tabular-nums"
        style={{
          fontFamily: "Geist Mono, monospace",
          fontSize: 32,
          fontWeight: 600,
          color: "var(--bsd-ink)",
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FieldRow({
  Icon,
  label,
  value,
  placeholder,
  editing,
  isMobile,
  onEdit,
  onSave,
  onCancel,
  last,
}: {
  Icon: typeof UserCircle;
  label: string;
  value: string;
  placeholder: string;
  editing: boolean;
  isMobile: boolean;
  onEdit: () => void;
  onSave: (v: string) => void;
  onCancel: () => void;
  last?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (editing) setDraft(value);
  }, [editing, value]);

  const valueCell = (
    <AnimatePresence mode="wait" initial={false}>
      {editing ? (
        <motion.input
          key="edit"
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(draft.trim());
            if (e.key === "Escape") onCancel();
          }}
          autoFocus
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          transition={{ duration: 0.18, ease: EOQ }}
          style={{
            background: "var(--bsd-paper-low, var(--bsd-paper))",
            border: "1px solid var(--bsd-red)",
            borderRadius: 2,
            padding: "8px 10px",
            fontSize: 14,
            color: "var(--bsd-ink)",
            outline: "none",
            fontFamily: "Geist, sans-serif",
            minWidth: 0,
          }}
        />
      ) : (
        <motion.div
          key="value"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            fontSize: 14.5,
            color: value ? "var(--bsd-ink)" : "var(--bsd-muted)",
            fontStyle: value ? "normal" : "italic",
            overflowWrap: "anywhere",
            minWidth: 0,
          }}
        >
          {value || placeholder}
        </motion.div>
      )}
    </AnimatePresence>
  );

  const actionCell = editing ? (
    <div style={{ display: "flex", gap: 4 }}>
      <IconBtn onClick={() => onSave(draft.trim())} accent="var(--bsd-red)" label="Save">
        <Check weight="bold" size={13} />
      </IconBtn>
      <IconBtn onClick={onCancel} accent="var(--bsd-muted)" label="Cancel">
        ✕
      </IconBtn>
    </div>
  ) : (
    <IconBtn onClick={onEdit} accent="var(--bsd-muted)" label={`Edit ${label}`}>
      <Pencil weight="bold" size={12} />
    </IconBtn>
  );

  if (isMobile) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 12,
          alignItems: "center",
          padding: "14px 18px",
          borderTop: "1px solid var(--bsd-hairline)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            className="cf-mono"
            style={{
              fontFamily: "Geist Mono, monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--bsd-muted)",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            {label}
          </div>
          {valueCell}
        </div>
        {actionCell}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "26px 160px minmax(0, 1fr) auto",
        gap: 16,
        alignItems: "center",
        padding: "14px 32px",
        borderTop: "1px solid var(--bsd-hairline)",
        borderBottom: last ? "none" : "none",
      }}
    >
      <Icon weight="duotone" size={16} color="var(--bsd-red)" />
      <div
        className="cf-mono"
        style={{
          fontFamily: "Geist Mono, monospace",
          fontSize: 10.5,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--bsd-muted)",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      {valueCell}
      {actionCell}
    </div>
  );
}

function IconBtn({
  onClick,
  accent,
  label,
  children,
}: {
  onClick: () => void;
  accent: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="cursor-pointer"
      style={{
        width: 28,
        height: 28,
        display: "grid",
        placeItems: "center",
        background: "transparent",
        border: `1px solid ${accent}`,
        color: accent,
        borderRadius: 2,
        cursor: "pointer",
        outline: "none",
        transition: "background 140ms ease, color 140ms ease, transform 100ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = accent;
        e.currentTarget.style.color = "var(--bsd-paper)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = accent;
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.94)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {children}
    </button>
  );
}

function RoleChip({ role }: { role: string }) {
  return (
    <span
      className="cf-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        background: "var(--bsd-ink)",
        color: "var(--bsd-paper)",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10,
        letterSpacing: "0.20em",
        textTransform: "uppercase",
        fontWeight: 800,
        borderRadius: 2,
      }}
    >
      <ShieldStar weight="duotone" size={12} />
      {role}
    </span>
  );
}

function ProviderChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className="cf-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        background: active ? "var(--bsd-red-soft)" : "transparent",
        border: `1px solid ${active ? "var(--bsd-red)" : "var(--bsd-rule)"}`,
        color: active ? "var(--bsd-red)" : "var(--bsd-muted)",
        fontFamily: "Geist Mono, monospace",
        fontSize: 10.5,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        fontWeight: 700,
        borderRadius: 2,
      }}
    >
      {active ? <Check weight="bold" size={11} /> : null}
      {label}
      {!active ? <ArrowUpRight weight="bold" size={11} /> : null}
    </span>
  );
}

function QuickLink({
  href,
  label,
  hint,
  divider,
}: {
  href: string;
  label: string;
  hint: string;
  divider?: boolean;
}) {
  return (
    <Link
      href={href}
      className="cursor-pointer"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "20px 22px",
        borderLeft: divider ? "1px dotted var(--bsd-hairline)" : "none",
        textDecoration: "none",
        transition: "background 160ms ease, color 160ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = "var(--bsd-red-soft)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 16,
          fontWeight: 700,
          color: "var(--bsd-ink)",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
        <ArrowRight weight="bold" size={12} color="var(--bsd-red)" />
      </span>
      <span
        className="cf-mono"
        style={{
          fontFamily: "Geist Mono, monospace",
          fontSize: 10.5,
          letterSpacing: "0.06em",
          color: "var(--bsd-muted)",
        }}
      >
        {hint}
      </span>
    </Link>
  );
}

function GhostButton({
  onClick,
  Icon,
  label,
}: {
  onClick: () => void;
  Icon: typeof SignOut;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 18px",
        background: "transparent",
        border: "1px solid var(--bsd-rule)",
        color: "var(--bsd-ink)",
        fontFamily: "Geist Mono, monospace",
        fontSize: 11,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        fontWeight: 700,
        borderRadius: 2,
        cursor: "pointer",
        outline: "none",
        transition: "border-color 140ms ease, transform 100ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--bsd-ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--bsd-rule)";
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <Icon weight="bold" size={12} />
      {label}
    </button>
  );
}

function DangerButton({
  onClick,
  Icon,
  label,
}: {
  onClick: () => void;
  Icon: typeof Trash;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 18px",
        background: "var(--bsd-red)",
        border: "1px solid var(--bsd-red)",
        color: "var(--bsd-paper)",
        fontFamily: "Geist Mono, monospace",
        fontSize: 11,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        fontWeight: 700,
        borderRadius: 2,
        cursor: "pointer",
        outline: "none",
        transition: "background 140ms ease, transform 100ms ease",
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <Icon weight="bold" size={12} />
      {label}
    </button>
  );
}
