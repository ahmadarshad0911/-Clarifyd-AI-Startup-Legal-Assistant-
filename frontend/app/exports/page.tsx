"use client";

import { useEffect, useState } from "react";

import { AppShell } from "../../components/shell/app-shell";
import { ExportPanel } from "../../components/exports/export-panel";
import { listRecent, removeRecent, type RecentDraft } from "../../lib/recent";
import { useToast } from "../../lib/toast";

const RISK_PILL: Record<string, string> = {
  low: "bg-slate-200 text-slate-700",
  medium: "bg-status-info/10 text-status-info",
  high: "bg-status-warn/10 text-status-warn",
  critical: "bg-status-danger/10 text-status-danger",
};

export default function ExportsPage() {
  const { push } = useToast();
  const [recent, setRecent] = useState<RecentDraft[]>([]);
  const [active, setActive] = useState<string | null>(null);

  async function shareAccess() {
    if (!active) {
      push("Pick a draft first.", "info");
      return;
    }
    const url = `${window.location.origin}/exports?draft=${active}`;
    try {
      await navigator.clipboard.writeText(url);
      push("Share link copied", "success", url);
    } catch {
      push("Clipboard blocked — copy manually.", "error", url);
    }
  }

  useEffect(() => {
    const items = listRecent();
    setRecent(items);
    setActive(items[0]?.draft_id ?? null);
  }, []);

  return (
    <AppShell>
      <section className="mb-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-3 w-3 rounded-full bg-status-success animate-pulse" />
            <span className="font-label-caps text-label-caps text-status-success uppercase tracking-widest">
              {active ? "Processing Complete" : "Awaiting analysis"}
            </span>
          </div>
          <h2 className="font-display-hero text-h1-mobile md:text-h1 text-onboarding-navy m-0">
            Ready to Export
          </h2>
          <p className="text-on-surface-variant mt-2 max-w-xl">
            Your contract analysis is verified and archived. Download the tamper-evident report or review the
            cryptographic audit log.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={shareAccess}
            className="btn-capsule glass-semi-clear text-primary"
          >
            <span className="material-symbols-outlined">share</span>
            Share Access
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <section className="lg:col-span-7 crystal-glass rounded-3xl overflow-hidden flex flex-col min-h-[420px] md:min-h-[600px] max-h-[820px]">
          <div className="bg-surface-container-highest px-4 md:px-6 py-4 flex items-center justify-between border-b border-glass-border">
            <div className="flex items-center gap-3 min-w-0">
              <span className="material-symbols-outlined text-error shrink-0">picture_as_pdf</span>
              <span className="font-h3 text-h3 truncate">
                {recent[0]?.file_name ?? "No active contract"}
              </span>
            </div>
          </div>
          <div className="flex-1 bg-slate-800/10 p-3 md:p-8 flex justify-center overflow-y-auto">
            <div className="bg-white w-full max-w-2xl shadow-2xl p-5 md:p-12 relative">
              <div className="absolute top-6 right-6 md:top-8 md:right-12 opacity-20">
                <span className="material-symbols-outlined text-[48px] md:text-[80px]">
                  verified_user
                </span>
              </div>
              <div className="border-b-4 border-onboarding-navy pb-5 md:pb-6 mb-6 md:mb-8">
                <h3 className="font-display-hero text-h3 md:text-h2 text-onboarding-navy m-0 pr-12">
                  Clarifyd Audit Certificate
                </h3>
                <p className="text-label-caps font-label-caps text-on-surface-variant uppercase mt-2 m-0 break-all">
                  ID: {active ? active.slice(0, 18).toUpperCase() : "—"}
                </p>
              </div>
              <div className="space-y-5 md:space-y-6">
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-4 bg-slate-100 rounded w-full" />
                <div className="h-4 bg-slate-100 rounded w-5/6" />
                <div className="pt-6 md:pt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
                  <div className="p-4 bg-surface-container-low rounded-lg border border-glass-border">
                    <p className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">
                      Contract owner
                    </p>
                    <p className="font-bold text-onboarding-navy m-0">Your organization</p>
                  </div>
                  <div className="p-4 bg-surface-container-low rounded-lg border border-glass-border">
                    <p className="font-label-caps text-[10px] text-on-surface-variant uppercase mb-1">
                      Date verified
                    </p>
                    <p className="font-bold text-onboarding-navy m-0">
                      {recent[0]?.uploaded_at
                        ? new Date(recent[0].uploaded_at).toUTCString()
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-8 md:mt-12 space-y-4">
                  <div className="flex items-start gap-3 md:gap-4">
                    <span className="material-symbols-outlined text-status-success mt-1 shrink-0">check_circle</span>
                    <div>
                      <p className="font-bold m-0">Liability clause verified</p>
                      <p className="text-sm text-on-surface-variant m-0">
                        Compliance baseline reviewed without critical deviations.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 md:gap-4">
                    <span className="material-symbols-outlined text-status-success mt-1 shrink-0">check_circle</span>
                    <div>
                      <p className="font-bold m-0">Data privacy protocol</p>
                      <p className="text-sm text-on-surface-variant m-0">
                        GDPR and CCPA alignment confirmed by Clarifyd reasoning engine.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="lg:col-span-5 flex flex-col gap-6 min-w-0">
          <section className="crystal-glass rounded-3xl p-6">
            <div className="flex justify-between items-baseline mb-4">
              <h2 className="font-h2 text-h2 text-onboarding-navy m-0">Recent drafts</h2>
              <span className="text-body-sm text-on-surface-variant">stored locally · last 8</span>
            </div>
            {!recent.length ? (
              <p className="text-body-sm text-on-surface-variant">
                No drafts yet. Upload one from the dashboard.
              </p>
            ) : (
              <ul className="flex flex-col gap-3 m-0 p-0 list-none">
                {recent.map((r) => {
                  const isActive = r.draft_id === active;
                  const pill = RISK_PILL[r.highest_risk] ?? "bg-slate-200 text-slate-700";
                  return (
                    <li
                      key={r.draft_id}
                      className={`p-3 rounded-xl border bg-white/40 flex flex-col gap-2 ${
                        isActive ? "border-primary ring-2 ring-primary/30" : "border-glass-border"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-primary shrink-0">description</span>
                        <span className="font-semibold text-body-sm truncate flex-1 min-w-0" title={r.file_name}>
                          {r.file_name}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${pill}`}>
                          {r.highest_risk}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-body-sm text-on-surface-variant">
                          {r.findings_count} finding{r.findings_count === 1 ? "" : "s"}
                        </span>
                        <span className="flex-1" />
                        <button
                          type="button"
                          onClick={() => setActive(r.draft_id)}
                          className={`px-3 py-1 rounded-lg text-body-sm font-semibold transition-colors ${
                            isActive
                              ? "bg-primary text-white"
                              : "bg-white/60 border border-glass-border text-on-surface hover:bg-white/80"
                          }`}
                        >
                          {isActive ? "Active" : "Use"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = removeRecent(r.draft_id);
                            setRecent(next);
                            if (active === r.draft_id) setActive(next[0]?.draft_id ?? null);
                          }}
                          title="Forget on this device only"
                          className="px-3 py-1 rounded-lg text-body-sm font-semibold bg-white/60 border border-glass-border text-on-surface hover:bg-white/80 transition-colors"
                        >
                          Forget
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <ExportPanel draftId={active} />

          <section className="crystal-glass rounded-3xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-h3 text-h3 m-0">Audit Log</h4>
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
                Verified
              </span>
            </div>
            <div className="space-y-6">
              <div className="flex gap-4 relative">
                <div className="absolute left-3 top-8 bottom-[-24px] w-0.5 bg-glass-border" />
                <div className="h-6 w-6 rounded-full bg-status-success flex items-center justify-center text-white shrink-0 z-10">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold m-0">Document sealed and archived</p>
                  <p className="text-xs text-on-surface-variant m-0">
                    Archival hash generated and stored.
                  </p>
                  <p className="text-[10px] text-text-muted mt-1 uppercase font-bold tracking-tight">
                    {recent[0]?.uploaded_at
                      ? new Date(recent[0].uploaded_at).toLocaleString()
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 relative">
                <div className="absolute left-3 top-8 bottom-[-24px] w-0.5 bg-glass-border" />
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white shrink-0 z-10">
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold m-0">Clarifyd reasoning completed</p>
                  <p className="text-xs text-on-surface-variant m-0">
                    {recent[0]?.findings_count ?? 0} findings identified.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 relative">
                <div className="absolute left-3 top-8 bottom-[-24px] w-0.5 bg-glass-border" />
                <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-white shrink-0 z-10">
                  <span className="material-symbols-outlined text-[14px]">label</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold m-0">Clause tagging engine</p>
                  <p className="text-xs text-on-surface-variant m-0">
                    Identified clause taxonomy across the document.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-6 w-6 rounded-full bg-outline flex items-center justify-center text-white shrink-0 z-10">
                  <span className="material-symbols-outlined text-[14px]">upload_file</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold m-0">Source file uploaded</p>
                  <p className="text-xs text-on-surface-variant m-0">
                    {recent[0]?.file_name ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
