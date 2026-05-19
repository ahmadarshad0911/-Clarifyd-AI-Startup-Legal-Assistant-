"use client";

/**
 * /compare — Broadsheet · v6
 *
 * Editorial "Comparative reading" plate. Pick 2+ recent drafts from the
 * ledger column (or paste raw IDs), see clause-by-clause variance.
 * Preserves client.compare(ids) + CompareResponse contract.
 */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, Check, Equals, NotEquals, FileText, ListMagnifyingGlass, Warning,
} from "@phosphor-icons/react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { CompareResponse } from "../../lib/contracts";
import { listRecent, type RecentDraft } from "../../lib/recent";
import { useToast } from "../../lib/toast";

const EOQ = [0.23, 1, 0.32, 1] as const;

const SEV_COLOR: Record<string, string> = {
  low:      "var(--bsd-sev-low)",
  medium:   "var(--bsd-sev-medium)",
  high:     "var(--bsd-sev-high)",
  critical: "var(--bsd-sev-critical)",
};

export default function ComparePage() {
  const { client } = useAuth();
  const { push } = useToast();
  const reduce = useReducedMotion() ?? false;

  const [recent, setRecent] = useState<RecentDraft[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pastedRaw, setPastedRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);

  useEffect(() => {
    setRecent(listRecent());
  }, []);

  const draftIds = useMemo(() => {
    const fromPicker = Array.from(picked);
    if (fromPicker.length) return fromPicker;
    return pastedRaw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  }, [picked, pastedRaw]);

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (draftIds.length < 2) {
      push("Pick at least 2 drafts.", "error");
      return;
    }
    setBusy(true);
    try {
      const r = await client.compare(draftIds);
      setResult(r);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Compare failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      {/* Plate header */}
      <section style={{ paddingBottom: 22, borderBottom: "1px solid var(--bsd-hairline)" }}>
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EOQ }}
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}
        >
          <div>
            <span className="bsd-kicker">§ Comparative reading · Volume I</span>
            <h1 style={{ margin: "10px 0 0", fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.03em", lineHeight: 1.02 }}>
              Same clause, <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>different drafts.</span>
            </h1>
            <p style={{ margin: "12px 0 0", color: "var(--bsd-body)", fontSize: 15, lineHeight: 1.6, maxWidth: 620 }}>
              Pick two or more drafts. We line up every clause, draft by draft, and mark where one version puts you on the hook and the other doesn&rsquo;t.
            </p>
          </div>
          <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>
            ◆ {draftIds.length} picked
          </span>
        </motion.div>
      </section>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)", gap: 56, marginTop: 40 }} className="grid-cols-1 lg:grid-cols-[5fr_7fr]">
        {/* Picker column */}
        <aside>
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div>
              <div className="cf-mono" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
                <span>Recent drafts</span>
                <span>{recent.length} on file</span>
              </div>
              {!recent.length ? (
                <p style={{ margin: "22px 0 0", color: "var(--bsd-muted)", fontSize: 13.5, fontStyle: "italic" }}>
                  No drafts on file. Upload from the Dashboard, then return.
                </p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {recent.map((r, i) => {
                    const on = picked.has(r.draft_id);
                    return (
                      <li key={r.draft_id} style={{ borderBottom: "1px dotted var(--bsd-hairline)" }}>
                        <button
                          type="button"
                          onClick={() => togglePick(r.draft_id)}
                          className="bsd-row cursor-pointer"
                          style={{
                            width: "100%", textAlign: "left",
                            display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 14,
                            padding: "16px 4px",
                            background: on ? "var(--bsd-paper-deep)" : "transparent",
                            border: "none",
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: 18, height: 18,
                              border: `1.5px solid ${on ? "var(--bsd-red)" : "var(--bsd-rule)"}`,
                              background: on ? "var(--bsd-red)" : "transparent",
                              color: "var(--bsd-paper)",
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              transition: "background 200ms ease, border-color 200ms ease",
                              marginTop: 2,
                            }}
                          >
                            {on ? <Check weight="bold" size={11} /> : null}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <FileText weight={on ? "duotone" : "regular"} size={14} color={on ? "var(--bsd-red)" : "var(--bsd-muted)"} aria-hidden />
                              <span style={{ fontSize: 14, color: "var(--bsd-ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.file_name}>
                                {r.file_name}
                              </span>
                            </div>
                            <div className="cf-mono" style={{ marginTop: 3, fontSize: 9.5, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                              {r.findings_count} finding{r.findings_count === 1 ? "" : "s"} · <span style={{ color: SEV_COLOR[r.highest_risk] ?? "var(--bsd-muted)", fontWeight: 800 }}>{r.highest_risk}</span>
                            </div>
                          </div>
                          <span className="cf-mono" style={{ color: "var(--bsd-soft)", fontSize: 10, letterSpacing: "0.16em", fontWeight: 800 }}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
                Or paste IDs
              </div>
              <textarea
                value={pastedRaw}
                onChange={(e) => setPastedRaw(e.target.value)}
                placeholder="draft_id_a, draft_id_b, draft_id_c"
                rows={3}
                className="bsd-input"
                style={{ marginTop: 12, fontFamily: "Geist Mono, monospace", fontSize: 13, resize: "vertical" }}
              />
              <p className="cf-mono" style={{ margin: "8px 0 0", fontSize: 9.5, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                Comma or whitespace separated. Picker takes precedence if filled.
              </p>
            </div>

            <button
              type="submit"
              disabled={busy || draftIds.length < 2}
              className="bsd-btn cursor-pointer"
              style={{ alignSelf: "flex-start" }}
            >
              <ListMagnifyingGlass weight="duotone" size={12} />
              {busy ? "Reading…" : `Compare ${draftIds.length || "—"} draft${draftIds.length === 1 ? "" : "s"}`}
              <ArrowRight weight="bold" size={11} />
            </button>
          </form>
        </aside>

        {/* Results column */}
        <section>
          {!result ? (
            <Empty />
          ) : (
            <Results result={result} reduce={reduce} />
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Empty() {
  return (
    <div style={{ border: "2px dashed var(--bsd-rule)", padding: 48, textAlign: "center" }}>
      <Equals weight="duotone" size={32} color="var(--bsd-muted)" />
      <h2 style={{ margin: "14px 0 0", fontSize: 22, color: "var(--bsd-ink)", fontWeight: 700, letterSpacing: "-0.015em" }}>
        Waiting for a comparison.
      </h2>
      <p style={{ margin: "10px 0 0", color: "var(--bsd-muted)", fontSize: 14, lineHeight: 1.55, maxWidth: 380, marginInline: "auto" }}>
        Pick at least two drafts on the left. The variance table prints here once you press <strong style={{ color: "var(--bsd-ink)", fontWeight: 700 }}>Compare</strong>.
      </p>
    </div>
  );
}

function Results({ result, reduce }: { result: CompareResponse; reduce: boolean }) {
  const draftCount = result.draft_ids.length;
  return (
    <div>
      <div className="cf-mono" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "2px solid var(--bsd-ink)" }}>
        <span>Variance table · {result.variances.length} clause{result.variances.length === 1 ? "" : "s"}</span>
        <span>{draftCount} drafts read</span>
      </div>

      {/* Drafts dateline */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {result.draft_ids.map((d, i) => (
          <span
            key={d}
            className="cf-mono"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 10px",
              border: "1.5px solid var(--bsd-ink)",
              background: "var(--bsd-paper-deep)",
              fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 800,
              color: "var(--bsd-ink)",
            }}
          >
            <span style={{ color: "var(--bsd-red)" }}>{String.fromCharCode(65 + i)}</span>
            {d.slice(0, 10)}…
          </span>
        ))}
      </div>

      {/* Table head */}
      <div
        style={{
          marginTop: 28,
          display: "grid", gridTemplateColumns: "44px minmax(0, 1.4fr) 88px minmax(0, 1.8fr)", gap: 18,
          padding: "10px 0",
          borderTop: "2px solid var(--bsd-ink)", borderBottom: "1px solid var(--bsd-ink)",
          fontFamily: "Geist Mono, monospace",
          fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "var(--bsd-muted)",
        }}
      >
        <span>No.</span>
        <span>Clause</span>
        <span>Presence</span>
        <span>Risk by draft</span>
      </div>

      {/* Rows */}
      {result.variances.map((v, i) => {
        const presence = v.present_in.length;
        const ratio = presence / draftCount;
        const divergent = new Set(Object.values(v.risk_levels).filter(Boolean)).size > 1;
        return (
          <motion.div
            key={v.clause_name}
            initial={{ opacity: 0, y: reduce ? 0 : 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.3, ease: EOQ, delay: i * 0.03 }}
            style={{
              display: "grid", gridTemplateColumns: "44px minmax(0, 1.4fr) 88px minmax(0, 1.8fr)", gap: 18,
              padding: "18px 0",
              borderBottom: i < result.variances.length - 1 ? "1px dotted var(--bsd-hairline)" : "2px solid var(--bsd-ink)",
              alignItems: "center",
            }}
          >
            <span className="cf-mono" style={{ color: divergent ? "var(--bsd-red)" : "var(--bsd-soft)", fontSize: 13, fontWeight: 800, letterSpacing: "0.10em" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {divergent ? (
                <NotEquals weight="bold" size={13} color="var(--bsd-red)" aria-hidden />
              ) : (
                <Equals weight="bold" size={13} color="var(--bsd-muted)" aria-hidden />
              )}
              <span style={{ fontSize: 15, color: "var(--bsd-ink)", fontWeight: 600 }}>{v.clause_name}</span>
            </div>
            <div className="cf-mono" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: "var(--bsd-muted)", letterSpacing: "0.14em", fontWeight: 700 }}>
              <span style={{ color: "var(--bsd-ink)", fontWeight: 800 }}>{presence}</span>
              <span style={{ flex: 1, position: "relative", height: 2, background: "var(--bsd-hairline)" }}>
                <span style={{ position: "absolute", inset: 0, transformOrigin: "left", transform: `scaleX(${ratio})`, background: "var(--bsd-ink)" }} />
              </span>
              <span>/{draftCount}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {result.draft_ids.map((d, j) => {
                const lvl = v.risk_levels[d];
                return (
                  <span
                    key={d}
                    className="cf-mono"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "3px 8px",
                      border: `1px solid ${lvl ? SEV_COLOR[lvl] ?? "var(--bsd-rule)" : "var(--bsd-rule)"}`,
                      color: lvl ? SEV_COLOR[lvl] ?? "var(--bsd-muted)" : "var(--bsd-muted)",
                      background: "transparent",
                      fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800,
                    }}
                  >
                    <span style={{ color: "var(--bsd-red)" }}>{String.fromCharCode(65 + j)}</span>
                    {lvl ?? "absent"}
                  </span>
                );
              })}
            </div>
          </motion.div>
        );
      })}

      {/* Footnote */}
      <p className="cf-mono" style={{ margin: "18px 0 0", fontSize: 10, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Warning weight="duotone" size={11} color="var(--bsd-red)" /> Divergent rows ≠ are highest-priority. Review them first.
      </p>
    </div>
  );
}
