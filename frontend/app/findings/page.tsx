"use client";

/**
 * Findings — high-level verdict + risk score per analyzed document.
 * The risky-clause / loophole / suggested-clause workflow lives in the
 * Negotiation Lab now (/negotiate). This tab is intentionally read-only:
 * pick a doc, scan the verdict, jump to /negotiate when you want to redline.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { AppShell } from "../../components/shell/app-shell";
import { OrbitalLoader } from "../../components/common/orbital-loader";
import { VerdictCard } from "../../components/findings/verdict-card";
import { useAuth } from "../../lib/auth";
import { listAnalyses, removeAnalysis, type StoredAnalysis } from "../../lib/analyses";
import { useToast } from "../../lib/toast";

const RISK_DOT: Record<string, string> = {
  low: "#475569",
  medium: "#2563eb",
  high: "#ea580c",
  critical: "#dc2626",
};

export default function FindingsPage() {
  // useSearchParams() requires a Suspense boundary in Next 14 App Router.
  return (
    <Suspense fallback={<OrbitalLoader fullscreen />}>
      <FindingsPageInner />
    </Suspense>
  );
}

function FindingsPageInner() {
  const { client } = useAuth();
  const { push } = useToast();
  const params = useSearchParams();
  const [docs, setDocs] = useState<StoredAnalysis[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const local = listAnalyses();

    function settle(items: StoredAnalysis[]) {
      if (cancelled) return;
      // Findings tab = drafts NOT yet negotiated.
      const active = items.filter((d) => !d.negotiated_at);
      setDocs(active);
      const wanted = params.get("draft");
      setActiveId(
        (wanted && active.some((d) => d.draft_id === wanted) ? wanted : null) ??
          active[0]?.draft_id ??
          null
      );
      setLoaded(true);
    }

    settle(local);

    client
      .listStoredAnalyses()
      .then((res) => {
        if (cancelled) return;
        const remote: StoredAnalysis[] = res.items.map((r) => ({
          draft_id: r.draft_id,
          file_name: r.file_name,
          analyzed_at: r.analyzed_at,
          negotiated_at: r.negotiated_at ?? null,
          analysis: r.analysis,
        }));
        const seen = new Set(local.map((d) => d.draft_id));
        const merged = [...local, ...remote.filter((r) => !seen.has(r.draft_id))];
        settle(merged);
      })
      .catch(() => {
        /* offline / unauthorized — local-only is fine */
      });

    return () => {
      cancelled = true;
    };
  }, [params, client]);

  const active = useMemo(
    () => docs.find((d) => d.draft_id === activeId) ?? null,
    [docs, activeId]
  );

  async function deleteDoc(d: StoredAnalysis, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Remove "${d.file_name}" from Findings? This can't be undone.`)) return;
    removeAnalysis(d.draft_id);
    setDocs((prev) => {
      const next = prev.filter((x) => x.draft_id !== d.draft_id);
      if (activeId === d.draft_id) setActiveId(next[0]?.draft_id ?? null);
      return next;
    });
    try {
      await client.softDeleteDraft(d.draft_id);
      push("Removed", "success", d.file_name);
    } catch (err) {
      push("Removed locally — server delete failed", "info");
    }
  }

  function relTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  if (!loaded) return <AppShell><div /></AppShell>;

  if (!docs.length) {
    return (
      <AppShell>
        <section className="crystal-glass rounded-3xl p-10 text-center flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary/30 text-[56px]">
            description
          </span>
          <h2 className="font-display-hero text-h1-mobile lg:text-h1 text-onboarding-navy m-0">
            No pending findings
          </h2>
          <p className="text-on-surface-variant max-w-md">
            Either you haven&rsquo;t uploaded a contract yet, or every analysis has
            already moved to the Negotiation Lab. Upload another to start a
            fresh review.
          </p>
          <Link href="/dashboard" className="btn-capsule btn-capsule-primary mt-2">
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Upload a contract
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Document selector */}
      <section className="crystal-glass rounded-3xl p-5 md:p-6">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">folder_open</span>
            <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
              Analyzed documents · {docs.length}
            </span>
          </div>
          <Link
            href="/dashboard"
            className="btn-capsule glass-semi-clear text-primary text-sm px-5"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Analyze another
          </Link>
        </div>
        <div className="flex flex-wrap gap-3">
          {docs.map((d) => {
            const selected = d.draft_id === activeId;
            const risk = d.analysis.summary.highest_risk;
            return (
              <div
                key={d.draft_id}
                className={`group relative flex items-center gap-3 px-4 py-3 pr-10 rounded-2xl border text-left transition-all cursor-pointer ${
                  selected
                    ? "bg-gradient-to-r from-primary to-accent-violet text-white border-transparent shadow-md"
                    : "bg-white/50 border-white/60 text-on-surface hover:bg-white/70"
                }`}
                onClick={() => setActiveId(d.draft_id)}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: selected ? "#fff" : RISK_DOT[risk] ?? "#475569" }}
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-body-sm truncate max-w-[200px]">
                    {d.file_name}
                  </span>
                  <span
                    className={`block text-[11px] ${
                      selected ? "text-white/80" : "text-on-surface-variant"
                    }`}
                  >
                    {d.analysis.summary.findings_count} findings · {risk} · {relTime(d.analyzed_at)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={(e) => deleteDoc(d, e)}
                  aria-label={`Remove ${d.file_name}`}
                  title="Remove from Findings"
                  className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full inline-flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 ${
                    selected
                      ? "bg-white/25 hover:bg-white/40 text-white"
                      : "bg-status-danger/10 hover:bg-status-danger/20 text-status-danger"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {active ? (
        <>
          <VerdictCard analysis={active.analysis} fileName={active.file_name} />

          {/* CTA to Negotiation Lab — that's where loopholes + suggested
              clauses + the ultimate collaborator document live now. */}
          <section className="shimmer-gold-border rounded-3xl bg-onboarding-navy text-white p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
            <div
              className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
              style={{ background: "rgba(180, 83, 9, 0.25)", filter: "blur(80px)" }}
              aria-hidden
            />
            <div className="relative z-10">
              <span className="font-label-caps text-label-caps uppercase tracking-widest text-onboarding-gold/90 block">
                Negotiate the risky clauses
              </span>
              <h2 className="font-display-hero text-h2 m-0 mt-1">
                Open this draft in the Negotiation Lab
              </h2>
              <p className="text-body-sm opacity-90 m-0 mt-1 max-w-md">
                Review every loophole, accept Kimi-suggested replacement clauses,
                and generate the ultimate collaborator document.
              </p>
            </div>
            <Link
              href={`/negotiate?draft=${active.draft_id}`}
              className="relative z-10 bg-onboarding-gold hover:bg-onboarding-gold/90 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-onboarding-gold/30 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[20px]">handshake</span>
              Negotiate
            </Link>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
