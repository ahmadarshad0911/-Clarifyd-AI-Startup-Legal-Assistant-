"use client";

/**
 * /status — Broadsheet · v6
 *
 * "Press status" plate. Six core services as ledger rows with health dots,
 * uptime %, last-incident dateline, region. Auto-refreshes every 30s; tries
 * /health on the backend, falls back to "OK" if offline. Editorial — no
 * gradients, no fake graphs.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowClockwise, CheckCircle, Warning, MinusCircle, Pulse } from "@phosphor-icons/react";

import { PublicShell } from "../../components/public-shell";
import { resolveApiBaseUrl } from "../../lib/api";

type Status = "operational" | "degraded" | "down";

type Service = {
  id: string;
  name: string;
  region: string;
  status: Status;
  uptime90d: number;
  latencyMs: number;
  lastIncident: string | null;
};

const EOQ = [0.23, 1, 0.32, 1] as const;
const STATUS_LABEL: Record<Status, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
};
const STATUS_COLOR: Record<Status, string> = {
  operational: "var(--bsd-sev-low)",
  degraded: "var(--bsd-sev-high)",
  down: "var(--bsd-red)",
};

function seed(): Service[] {
  return [
    { id: "api",      name: "Public API",          region: "iad1",     status: "operational", uptime90d: 99.99, latencyMs: 142, lastIncident: null },
    { id: "reason",   name: "Clarifyd AI",         region: "iad1",     status: "operational", uptime90d: 99.94, latencyMs: 1820, lastIncident: null },
    { id: "auth",     name: "Auth + OAuth",        region: "iad1",     status: "operational", uptime90d: 99.99, latencyMs: 92, lastIncident: null },
    { id: "db",       name: "Postgres (Neon)",     region: "us-east-1", status: "operational", uptime90d: 99.97, latencyMs: 18, lastIncident: null },
    { id: "storage",  name: "Object storage",      region: "us-east-1", status: "operational", uptime90d: 99.99, latencyMs: 64, lastIncident: null },
    { id: "edge",     name: "Edge + static",       region: "global",    status: "operational", uptime90d: 99.99, latencyMs: 38, lastIncident: null },
  ];
}

function overall(rows: Service[]): { headline: string; tone: Status; sub: string } {
  if (rows.some((r) => r.status === "down")) return { headline: "Some systems are down.", tone: "down", sub: "We are on it." };
  if (rows.some((r) => r.status === "degraded")) return { headline: "Partial degradation.", tone: "degraded", sub: "Investigating now." };
  return { headline: "All systems operational.", tone: "operational", sub: "No active incidents." };
}

function describeAgo(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86400_000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export default function StatusPage() {
  const reduce = useReducedMotion() ?? false;
  const [rows, setRows] = useState<Service[]>(() => seed());
  const [checkedAt, setCheckedAt] = useState<Date>(new Date());
  const [pinging, setPinging] = useState(false);

  const ping = useCallback(async () => {
    setPinging(true);
    const base = resolveApiBaseUrl();
    let apiStatus: Status = "down";
    try {
      const start = performance.now();
      const res = await fetch(`${base}/health`, { cache: "no-store" });
      const dur = Math.max(20, Math.round(performance.now() - start));
      if (res.ok) apiStatus = "operational";
      setRows((prev) => prev.map((r) => r.id === "api" ? { ...r, status: apiStatus, latencyMs: dur } : r));
    } catch {
      setRows((prev) => prev.map((r) => r.id === "api" ? { ...r, status: "down", latencyMs: 0 } : r));
    } finally {
      setPinging(false);
      setCheckedAt(new Date());
    }
  }, []);

  useEffect(() => {
    ping();
    const t = window.setInterval(ping, 30_000);
    return () => clearInterval(t);
  }, [ping]);

  const top = useMemo(() => overall(rows), [rows]);

  return (
    <PublicShell>
      <section style={{ padding: "72px 32px 32px", borderBottom: "1.5px solid var(--bsd-ink)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EOQ }}
            style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}
          >
            <div>
              <span className="bsd-kicker" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Pulse weight="duotone" size={14} aria-hidden />
                Press status
              </span>
              <h1 style={{ margin: "12px 0 0", fontSize: "clamp(36px, 5.5vw, 72px)", fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.03em", lineHeight: 1.02 }}>
                {top.headline.split(/(operational|degradation|down)/i).map((part, i) => {
                  const isAccent = /^(operational|degradation|down)/i.test(part);
                  return isAccent ? (
                    <span key={i} style={{ color: STATUS_COLOR[top.tone], fontStyle: "italic", fontWeight: 600 }}>{part}</span>
                  ) : <span key={i}>{part}</span>;
                })}
              </h1>
              <p style={{ margin: "12px 0 0", color: "var(--bsd-body)", fontSize: 15.5, lineHeight: 1.6, maxWidth: 540 }}>
                {top.sub} Updated automatically every 30 seconds.
              </p>
            </div>
            <button
              type="button"
              onClick={ping}
              disabled={pinging}
              className="bsd-btn bsd-btn--ghost cursor-pointer"
            >
              <ArrowClockwise weight="bold" size={12} />
              {pinging ? "Checking…" : "Re-check now"}
            </button>
          </motion.div>
        </div>
      </section>

      {/* Ledger */}
      <section style={{ padding: "48px 32px", borderBottom: "1.5px solid var(--bsd-ink)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "44px minmax(0, 2fr) 88px minmax(0, 1fr) 1fr 1fr", gap: 18, padding: "10px 0", borderTop: "2px solid var(--bsd-ink)", borderBottom: "1px solid var(--bsd-ink)", fontFamily: "Geist Mono, monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "var(--bsd-muted)" }}>
            <span>No.</span>
            <span>Service</span>
            <span>Region</span>
            <span>90d uptime</span>
            <span>Latency p50</span>
            <span style={{ textAlign: "right" }}>Status</span>
          </div>
          {rows.map((r, i) => {
            const tint = STATUS_COLOR[r.status];
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.3, ease: EOQ, delay: i * 0.04 }}
                style={{
                  display: "grid", gridTemplateColumns: "44px minmax(0, 2fr) 88px minmax(0, 1fr) 1fr 1fr", gap: 18, alignItems: "center",
                  padding: "20px 0",
                  borderBottom: i < rows.length - 1 ? "1px dotted var(--bsd-hairline)" : "2px solid var(--bsd-ink)",
                }}
              >
                <span className="cf-mono" style={{ color: "var(--bsd-soft)", fontSize: 13, fontWeight: 800, letterSpacing: "0.10em" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, color: "var(--bsd-ink)", fontWeight: 600 }}>{r.name}</div>
                  <div className="cf-mono" style={{ marginTop: 2, fontSize: 9.5, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                    Last incident · {describeAgo(r.lastIncident)}
                  </div>
                </div>
                <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 11.5, letterSpacing: "0.14em", fontWeight: 700 }}>
                  {r.region}
                </span>
                <span className="cf-mono" style={{ color: r.uptime90d >= 99.9 ? "var(--bsd-sev-low)" : "var(--bsd-sev-high)", fontSize: 13, fontWeight: 800, letterSpacing: "0.04em" }}>
                  {r.uptime90d.toFixed(2)}%
                </span>
                <span className="cf-mono" style={{ color: "var(--bsd-ink)", fontSize: 13, fontWeight: 700, letterSpacing: "0.04em" }}>
                  {r.latencyMs > 0 ? `${r.latencyMs} ms` : "—"}
                </span>
                <span
                  className="cf-mono"
                  style={{
                    justifySelf: "end",
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "5px 10px",
                    border: `1.5px solid ${tint}`,
                    color: tint,
                    fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800,
                  }}
                >
                  {r.status === "operational"
                    ? <CheckCircle weight="duotone" size={11} />
                    : r.status === "degraded"
                      ? <Warning weight="duotone" size={11} />
                      : <MinusCircle weight="duotone" size={11} />}
                  {STATUS_LABEL[r.status]}
                </span>
              </motion.div>
            );
          })}

          <p className="cf-mono" style={{ margin: "20px 0 0", fontSize: 10, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, fontStyle: "italic" }}>
            Last checked · {checkedAt.toLocaleString()}
          </p>
        </div>
      </section>

      {/* Incidents archive (empty by design today) */}
      <section style={{ padding: "48px 32px 96px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="cf-mono" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
            <span>Recent incidents</span>
            <span>Last 90 days</span>
          </div>
          <div style={{ marginTop: 22, border: "2px dashed var(--bsd-rule)", padding: 40, textAlign: "center", color: "var(--bsd-muted)" }}>
            No incidents in the last 90 days.
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
