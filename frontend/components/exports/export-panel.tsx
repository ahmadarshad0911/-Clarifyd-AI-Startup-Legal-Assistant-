"use client";

import { useEffect, useRef, useState } from "react";

import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import type { ExportFormat, ExportStatusResponse } from "../../lib/contracts";

type Props = { draftId: string | null };

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000;

const STATUS_PILL: Record<string, string> = {
  queued: "bg-primary/10 text-primary animate-pulse",
  ready: "bg-status-success/10 text-status-success",
  failed: "bg-error-container text-on-error-container",
};

export function ExportPanel({ draftId }: Props) {
  const { client, role } = useAuth();
  const { push } = useToast();
  const [format, setFormat] = useState<ExportFormat>("json");
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<ExportStatusResponse | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    },
    []
  );

  const canCreate = role === "reviewer" || role === "admin";

  async function start() {
    if (!draftId) return;
    setBusy(true);
    setJob(null);
    try {
      const created = await client.createExport(draftId, format);
      const initial: ExportStatusResponse = {
        contract_version: created.contract_version,
        export_id: created.export_id,
        draft_id: created.draft_id,
        format: created.format,
        status: created.status,
        file_path: null,
        error_message: null,
      };
      setJob(initial);
      pollUntilTerminal(created.export_id, Date.now());
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Export failed.", "error");
      setBusy(false);
    }
  }

  function pollUntilTerminal(exportId: string, startedAt: number) {
    const tick = async () => {
      try {
        const status = await client.getExport(exportId);
        setJob(status);
        if (status.status !== "queued") {
          setBusy(false);
          if (status.status === "ready") {
            push("Export ready.", "success");
          } else if (status.status === "failed") {
            push("Export failed.", "error", status.error_message ?? undefined);
          }
          return;
        }
      } catch (err) {
        push(err instanceof ApiError ? err.message : "Polling failed.", "error");
        setBusy(false);
        return;
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        push("Export timed out.", "error");
        setBusy(false);
        return;
      }
      pollRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
    };
    pollRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
  }

  async function download() {
    if (!job) return;
    try {
      const blob = await client.downloadExportBlob(job.export_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clarifyd-${job.draft_id.slice(0, 8)}.${job.format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Download failed.", "error");
    }
  }

  return (
    <section className="crystal-glass rounded-3xl p-6 relative overflow-hidden group hover:scale-[1.01] transition-transform">
      <div className="absolute -right-4 -top-4 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors" />
      <div className="flex items-center gap-4 mb-4 relative z-10">
        <div className="h-12 w-12 rounded-xl bg-onboarding-navy flex items-center justify-center text-white shrink-0">
          <span className="material-symbols-outlined">security</span>
        </div>
        <div>
          <h4 className="font-h3 text-h3 m-0">Tamper-Evident Report</h4>
          <p className="text-body-sm text-on-surface-variant m-0">
            {draftId ? (
              <>
                Draft <code>{draftId.slice(0, 8)}…</code>
              </>
            ) : (
              "Analyze a contract first to enable exports."
            )}
          </p>
        </div>
      </div>

      {draftId ? (
        <>
          <p className="text-body-sm text-on-surface-variant mb-6 relative z-10">
            Generated report includes a SHA-256 hash of the analysis results, preventing any unauthorized
            post-review modifications.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-4 relative z-10">
            <label className="flex items-center gap-2">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Format
              </span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                disabled={busy}
                className="bg-white/60 border border-glass-border rounded-lg px-2 py-1 text-body-sm"
                style={{ width: "auto" }}
              >
                <option value="json">JSON</option>
                <option value="pdf">PDF</option>
              </select>
            </label>
            <button
              type="button"
              onClick={start}
              disabled={!canCreate || busy}
              className="flex-1 py-3 bg-surface-container-highest rounded-xl font-bold text-onboarding-navy hover:bg-surface-container transition-colors border border-onboarding-navy/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined">file_download</span>
              {busy ? "Generating…" : "Create Export"}
            </button>
          </div>

          {job ? (
            <div className="flex flex-wrap items-center gap-3 mt-3 relative z-10">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  STATUS_PILL[job.status] ?? "bg-slate-200 text-slate-700"
                }`}
              >
                {job.status}
              </span>
              <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                {job.format.toUpperCase()}
              </span>
              <span className="text-body-sm text-on-surface-variant">
                id {job.export_id.slice(0, 8)}…
              </span>
              {job.status === "ready" ? (
                <button
                  type="button"
                  onClick={download}
                  className="bg-gradient-to-r from-accent-indigo to-accent-violet text-white px-4 py-2 rounded-xl font-bold shadow hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Download
                </button>
              ) : null}
              {job.error_message ? (
                <span className="text-[12px] text-status-danger">{job.error_message}</span>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
