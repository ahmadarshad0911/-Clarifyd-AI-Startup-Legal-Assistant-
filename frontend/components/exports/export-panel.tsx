"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadSimple, FileText } from "@phosphor-icons/react";

import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import type { ExportFormat, ExportStatusResponse } from "../../lib/contracts";

type Props = { draftId: string | null };

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000;

const STATUS_ACCENT: Record<string, string> = {
  queued: "var(--bsd-sev-medium)",
  ready: "var(--bsd-sev-clean, #4f7d3f)",
  failed: "var(--bsd-red)",
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

  const statusAccent = job ? STATUS_ACCENT[job.status] ?? "var(--bsd-muted)" : null;

  return (
    <section
      style={{
        position: "relative",
        background: "var(--bsd-paper)",
        border: "1px solid var(--bsd-rule)",
        borderRadius: 2,
        padding: "24px 26px 22px",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "var(--bsd-red)" }}
      />
      <div
        aria-hidden
        style={{ position: "absolute", top: 5, left: 0, right: 0, height: 1, background: "var(--bsd-red)", opacity: 0.4 }}
      />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
        <FileText
          weight="duotone"
          size={26}
          color="var(--bsd-red)"
          style={{ flexShrink: 0, marginTop: 4 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="cf-mono"
            style={{
              fontFamily: "Geist Mono, ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              color: "var(--bsd-red)",
              fontWeight: 800,
              marginBottom: 4,
            }}
          >
            § Export report
          </div>
          <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.01em" }}>
            {draftId ? (
              <>
                Draft{" "}
                <code style={{ fontFamily: "Geist Mono, monospace", fontSize: 14, color: "var(--bsd-muted)" }}>
                  {draftId.slice(0, 8)}…
                </code>
              </>
            ) : (
              "No active draft"
            )}
          </h4>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.5, color: "var(--bsd-body)" }}>
            {draftId
              ? "Download the findings and rewrites as JSON for tooling or PDF for sharing with counsel."
              : "Analyze a contract first to enable exports."}
          </p>
        </div>
      </div>

      {draftId ? (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid var(--bsd-hairline)",
            }}
          >
            <label
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              className="cf-mono"
            >
              <span
                style={{
                  fontFamily: "Geist Mono, ui-monospace, monospace",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--bsd-muted)",
                  fontWeight: 700,
                }}
              >
                Format
              </span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                disabled={busy}
                style={{
                  background: "var(--bsd-paper)",
                  border: "1px solid var(--bsd-rule)",
                  borderRadius: 2,
                  padding: "7px 10px",
                  fontFamily: "Geist Mono, ui-monospace, monospace",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--bsd-ink)",
                  letterSpacing: "0.10em",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="json">JSON</option>
                <option value="pdf">PDF</option>
              </select>
            </label>
            <button
              type="button"
              onClick={start}
              disabled={!canCreate || busy}
              className="cursor-pointer"
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                background: canCreate && !busy ? "var(--bsd-ink)" : "var(--bsd-rule)",
                border: `1px solid ${canCreate && !busy ? "var(--bsd-ink)" : "var(--bsd-rule)"}`,
                color: "var(--bsd-paper)",
                fontFamily: "Geist Mono, ui-monospace, monospace",
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 700,
                cursor: canCreate && !busy ? "pointer" : "not-allowed",
                opacity: canCreate && !busy ? 1 : 0.6,
                borderRadius: 2,
                outline: "none",
                transition: "background 160ms ease, transform 100ms ease",
              }}
              onMouseDown={(e) => {
                if (!canCreate || busy) return;
                e.currentTarget.style.transform = "scale(0.97)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <DownloadSimple weight="bold" size={12} />
              {busy ? "Generating…" : "Create export"}
            </button>
          </div>

          {job ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10,
                marginTop: 16,
                paddingTop: 14,
                borderTop: "1px dotted var(--bsd-hairline)",
              }}
            >
              <span
                className="cf-mono"
                style={{
                  padding: "4px 10px",
                  fontFamily: "Geist Mono, monospace",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontWeight: 800,
                  color: statusAccent ?? "var(--bsd-ink)",
                  border: `1px solid ${statusAccent ?? "var(--bsd-rule)"}`,
                  borderRadius: 2,
                }}
              >
                {job.status}
              </span>
              <span
                className="cf-mono"
                style={{
                  fontFamily: "Geist Mono, monospace",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: "var(--bsd-muted)",
                }}
              >
                {job.format.toUpperCase()} · ID {job.export_id.slice(0, 8)}…
              </span>
              {job.status === "ready" ? (
                <button
                  type="button"
                  onClick={download}
                  className="cursor-pointer"
                  style={{
                    marginLeft: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 18px",
                    background: "var(--bsd-red)",
                    border: "1px solid var(--bsd-red)",
                    color: "var(--bsd-paper)",
                    fontFamily: "Geist Mono, monospace",
                    fontSize: 11,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    cursor: "pointer",
                    borderRadius: 2,
                    outline: "none",
                    transition: "transform 100ms ease",
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = "scale(0.97)";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  <DownloadSimple weight="bold" size={12} />
                  Download
                </button>
              ) : null}
              {job.error_message ? (
                <span style={{ fontSize: 12, color: "var(--bsd-red)" }}>
                  {job.error_message}
                </span>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
