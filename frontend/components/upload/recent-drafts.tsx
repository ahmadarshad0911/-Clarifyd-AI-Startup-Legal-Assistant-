"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { listRecent, type RecentDraft } from "../../lib/recent";

const RISK_PILL: Record<string, string> = {
  low: "bg-slate-200 text-slate-700",
  medium: "bg-status-info/10 text-status-info",
  high: "bg-status-warn/10 text-status-warn",
  critical: "bg-status-danger/10 text-status-danger",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

export function RecentDrafts() {
  const [items, setItems] = useState<RecentDraft[]>([]);

  useEffect(() => {
    setItems(listRecent());
  }, []);

  return (
    <aside className="crystal-glass rounded-3xl p-6 h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-h3 text-h3 text-onboarding-navy">Recent Drafts</h3>
        <span className="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary">
          more_horiz
        </span>
      </div>

      {!items.length ? (
        <p className="text-body-sm text-on-surface-variant">
          No drafts yet. Upload one above to start the pipeline.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((d) => {
            const pillClass = RISK_PILL[d.highest_risk] ?? "bg-slate-200 text-slate-700";
            return (
              <div
                key={d.draft_id}
                className="p-4 rounded-2xl border border-white/60 bg-white/40 hover:bg-white/60 transition-all"
              >
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-primary shrink-0">description</span>
                    <span className="font-semibold text-body-lg truncate" title={d.file_name}>
                      {d.file_name}
                    </span>
                  </div>
                  <span className="bg-status-success/10 text-status-success px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shrink-0">
                    Analyzed
                  </span>
                </div>
                <p className="text-body-sm text-on-surface-variant mb-2">
                  Uploaded {relativeTime(d.uploaded_at)}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${pillClass}`}>
                    {d.highest_risk.toUpperCase()}
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold">
                    {d.findings_count} finding{d.findings_count === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Link
        href="/exports"
        className="w-full mt-8 text-primary font-bold text-body-sm hover:underline flex items-center justify-center gap-2"
      >
        View All Contracts <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </Link>
    </aside>
  );
}
