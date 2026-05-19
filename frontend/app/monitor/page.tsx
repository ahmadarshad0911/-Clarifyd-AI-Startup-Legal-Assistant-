"use client";

/**
 * /monitor — Broadsheet · v6
 *
 * "Calendar of perils" plate. Vesting cliffs, IP assignments, renewals,
 * regulatory windows. Local store scoped per-user via user-storage.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Plus, ArrowRight, CalendarBlank, X, ShieldCheck, Scales, ClockClockwise,
  type Icon,
} from "@phosphor-icons/react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { useToast } from "../../lib/toast";
import { readJSON, writeJSON } from "../../lib/user-storage";

type DeadlineKind = "vesting" | "ip" | "regulation" | "renewal" | "other";
type Deadline = {
  id: string;
  kind: DeadlineKind;
  title: string;
  isoDate: string;
  note?: string;
};

const STORAGE_KEY = "clarifyd.monitor.deadlines";
const EOQ = [0.23, 1, 0.32, 1] as const;

const KIND_LABEL: Record<DeadlineKind, string> = {
  vesting: "Vesting",
  ip: "IP",
  regulation: "Regulation",
  renewal: "Renewal",
  other: "Other",
};
const KIND_ICON: Record<DeadlineKind, Icon> = {
  vesting: CalendarBlank,
  ip: ShieldCheck,
  regulation: Scales,
  renewal: ClockClockwise,
  other: CalendarBlank,
};

function seed(): Deadline[] {
  const now = Date.now();
  const d = (offsetDays: number) => new Date(now + offsetDays * 86400_000).toISOString().slice(0, 10);
  return [
    { id: "s1", kind: "vesting",    title: "Founder cliff — 25% vests",                         isoDate: d(5) },
    { id: "s2", kind: "renewal",    title: "MSA auto-renews unless cancelled",                  isoDate: d(21) },
    { id: "s3", kind: "ip",         title: "IP assignment confirmation due (vendor agreement)", isoDate: d(60) },
    { id: "s4", kind: "regulation", title: "SAFE 4(a)(2) Form D filing window closes",          isoDate: d(110) },
  ];
}

function daysOut(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function sevForDays(days: number): string {
  if (days < 7) return "var(--bsd-sev-critical)";
  if (days < 30) return "var(--bsd-sev-high)";
  if (days < 90) return "var(--bsd-sev-medium)";
  return "var(--bsd-muted)";
}

export default function MonitorPage() {
  const { push } = useToast();
  const reduce = useReducedMotion() ?? false;

  const [items, setItems] = useState<Deadline[]>([]);
  const [snoozed, setSnoozed] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState<DeadlineKind>("other");

  useEffect(() => {
    const stored = readJSON<Deadline[] | null>(STORAGE_KEY, null);
    setItems(stored && Array.isArray(stored) ? stored : seed());
  }, []);

  function persist(next: Deadline[]) {
    setItems(next);
    writeJSON(STORAGE_KEY, next);
  }

  function add() {
    if (!title.trim() || !date) { push("Title and date required.", "info"); return; }
    persist([{ id: crypto.randomUUID(), kind, title: title.trim(), isoDate: date }, ...items]);
    setTitle(""); setDate(""); setKind("other"); setAdding(false);
    push("Deadline added", "success");
  }

  function snooze(id: string) {
    setSnoozed((s) => ({ ...s, [id]: Date.now() + 7 * 86400_000 }));
    push("Snoozed for 7 days", "success");
  }
  function dismiss(id: string) {
    persist(items.filter((d) => d.id !== id));
  }

  const visible = useMemo(() => {
    return items
      .filter((d) => !snoozed[d.id] || snoozed[d.id] < Date.now())
      .sort((a, b) => daysOut(a.isoDate) - daysOut(b.isoDate));
  }, [items, snoozed]);

  const next30 = useMemo(
    () => visible.filter((d) => { const x = daysOut(d.isoDate); return x >= 0 && x < 30; }).length,
    [visible],
  );
  const next7 = useMemo(
    () => visible.filter((d) => { const x = daysOut(d.isoDate); return x >= 0 && x < 7; }).length,
    [visible],
  );
  const overdue = useMemo(() => visible.filter((d) => daysOut(d.isoDate) < 0).length, [visible]);

  return (
    <AppShell>
      {/* Plate */}
      <section style={{ paddingBottom: 22, borderBottom: "1px solid var(--bsd-hairline)" }}>
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EOQ }}
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}
        >
          <div>
            <span className="bsd-kicker">§ Calendar of perils · Volume I</span>
            <h1 style={{ margin: "10px 0 0", fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.03em", lineHeight: 1.02 }}>
              Deadlines that <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>bite back.</span>
            </h1>
            <p style={{ margin: "12px 0 0", color: "var(--bsd-body)", fontSize: 15, lineHeight: 1.6, maxWidth: 620 }}>
              Vesting cliffs, IP confirmations, renewals, and regulatory windows. Sorted nearest-first so the next bite never surprises you.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="bsd-btn cursor-pointer"
          >
            <Plus weight="bold" size={12} /> {adding ? "Cancel" : "Add entry"}
          </button>
        </motion.div>
      </section>

      {/* Stat strip */}
      <section style={{ marginTop: 24, borderTop: "2px solid var(--bsd-ink)", borderBottom: "2px solid var(--bsd-ink)", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {[
          { label: "Next 7 days",  value: next7,   tint: "var(--bsd-sev-critical)" },
          { label: "Next 30 days", value: next30,  tint: "var(--bsd-sev-high)" },
          { label: "Overdue",      value: overdue, tint: "var(--bsd-red)" },
        ].map((s, i, arr) => (
          <div
            key={s.label}
            style={{
              padding: "22px 24px",
              borderRight: i < arr.length - 1 ? "1px solid var(--bsd-hairline)" : "none",
              display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14,
            }}
          >
            <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700 }}>
              {s.label}
            </span>
            <span className="cf-mono" style={{ fontSize: 36, color: s.value === 0 ? "var(--bsd-muted)" : s.tint, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {String(s.value).padStart(2, "0")}
            </span>
          </div>
        ))}
      </section>

      {/* Add form */}
      <AnimatePresence>
        {adding ? (
          <motion.form
            key="add"
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : -6 }}
            transition={{ duration: 0.28, ease: EOQ }}
            onSubmit={(e) => { e.preventDefault(); add(); }}
            style={{
              marginTop: 24, padding: 24,
              border: "2px solid var(--bsd-ink)",
              background: "var(--bsd-paper-deep)",
              display: "grid", gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1fr) minmax(0, 1fr) auto", gap: 20, alignItems: "end",
            }}
          >
            <SimpleField label="Title"  value={title} onChange={setTitle} placeholder="Cliff vests" />
            <SimpleField label="Date"   value={date}  onChange={setDate}  type="date" />
            <div>
              <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
                Kind
              </div>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as DeadlineKind)}
                className="bsd-input"
                style={{ appearance: "none", cursor: "pointer", paddingRight: 24, fontSize: 16 }}
              >
                <option value="vesting">Vesting</option>
                <option value="ip">IP</option>
                <option value="regulation">Regulation</option>
                <option value="renewal">Renewal</option>
                <option value="other">Other</option>
              </select>
            </div>
            <button type="submit" className="bsd-btn cursor-pointer">
              Add <ArrowRight weight="bold" size={11} />
            </button>
          </motion.form>
        ) : null}
      </AnimatePresence>

      {/* Ledger */}
      <section style={{ marginTop: 40 }}>
        <div className="cf-mono" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
          <span>The ledger · {visible.length} entrie{visible.length === 1 ? "" : "s"}</span>
          <span>Nearest first</span>
        </div>

        {visible.length === 0 ? (
          <div style={{ marginTop: 22, border: "2px dashed var(--bsd-rule)", padding: 48, textAlign: "center" }}>
            <CalendarBlank weight="duotone" size={32} color="var(--bsd-muted)" />
            <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--bsd-muted)", fontStyle: "italic" }}>
              All clear. Next bite &gt; 90 days out.
            </p>
            <Link href="/dashboard" className="bsd-btn bsd-btn--sm bsd-btn--ghost cursor-pointer" style={{ marginTop: 16 }}>
              Scan a contract <ArrowRight weight="bold" size={11} />
            </Link>
          </div>
        ) : (
          <ol style={{ margin: "0", padding: 0, listStyle: "none" }}>
            {visible.map((d, i) => {
              const days = daysOut(d.isoDate);
              const tint = sevForDays(days);
              const Icon = KIND_ICON[d.kind];
              return (
                <motion.li
                  key={d.id}
                  initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.3, ease: EOQ, delay: i * 0.03 }}
                  style={{ borderBottom: "1px dotted var(--bsd-hairline)" }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "60px 100px 24px minmax(0, 1fr) auto auto auto",
                      gap: 18, alignItems: "center",
                      padding: "20px 4px",
                    }}
                  >
                    <span className="cf-mono" style={{ color: "var(--bsd-soft)", fontSize: 13, fontWeight: 800, letterSpacing: "0.10em" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="cf-mono" style={{ color: tint, fontSize: 13, letterSpacing: "0.14em", fontWeight: 800 }}>
                      {d.isoDate}
                    </span>
                    <Icon weight="duotone" size={18} color={tint} aria-hidden />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15.5, color: "var(--bsd-ink)", fontWeight: 600, letterSpacing: "-0.01em" }}>
                        {d.title}
                      </div>
                      <div className="cf-mono" style={{ marginTop: 3, fontSize: 9.5, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                        {KIND_LABEL[d.kind]}
                      </div>
                    </div>
                    <span
                      className="cf-mono"
                      style={{
                        color: tint,
                        fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800,
                        minWidth: 90, textAlign: "right",
                      }}
                    >
                      {days > 0 ? `In ${days}d` : days === 0 ? "Today" : `${Math.abs(days)}d ago`}
                    </span>
                    <button
                      type="button"
                      onClick={() => snooze(d.id)}
                      className="cursor-pointer cf-mono"
                      title="Snooze 7 days"
                      style={{
                        background: "transparent", border: "1.5px solid var(--bsd-ink)",
                        color: "var(--bsd-ink)",
                        padding: "5px 10px",
                        fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800,
                        transition: "background 200ms ease, color 200ms ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bsd-ink)"; e.currentTarget.style.color = "var(--bsd-paper)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--bsd-ink)"; }}
                    >
                      Snooze 7d
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(d.id)}
                      aria-label="Dismiss"
                      className="cursor-pointer"
                      style={{ background: "transparent", border: "none", color: "var(--bsd-muted)", padding: 4, transition: "color 200ms ease" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bsd-red)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--bsd-muted)")}
                    >
                      <X weight="bold" size={12} />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
      </section>
    </AppShell>
  );
}

function SimpleField({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bsd-input"
        style={{ fontSize: 16 }}
      />
    </div>
  );
}
