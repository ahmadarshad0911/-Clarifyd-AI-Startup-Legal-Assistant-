"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";

import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { pushRecent } from "../../lib/recent";
import { useToast } from "../../lib/toast";
import type { AnalyzeContractResponse } from "../../lib/contracts";
import { OrbitalLoader } from "../common/orbital-loader";

type Props = {
  onAnalyzed: (response: AnalyzeContractResponse, sourceName: string) => void;
};

type AltMode = null | "url" | "text";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadCard({ onAnalyzed }: Props) {
  const { client, role } = useAuth();
  const { push } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [altMode, setAltMode] = useState<AltMode>(null);
  const [urlValue, setUrlValue] = useState("");
  const [textValue, setTextValue] = useState("");

  const canReview = role === "reviewer" || role === "admin";
  const canSubmit = !!file && !submitting && canReview;

  function pick() {
    inputRef.current?.click();
  }
  function onPick(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    const dropped = event.dataTransfer.files?.[0] ?? null;
    if (dropped) setFile(dropped);
  }

  function announce(result: AnalyzeContractResponse, sourceName: string) {
    pushRecent({
      draft_id: result.draft_id,
      file_name: sourceName,
      highest_risk: result.summary.highest_risk,
      findings_count: result.summary.findings_count,
      uploaded_at: new Date().toISOString(),
    });
    push(
      `Analyzed: ${result.summary.findings_count} findings`,
      "success",
      `Highest risk: ${result.summary.highest_risk} · score ${result.summary.overall_score}/10`
    );
    onAnalyzed(result, sourceName);
  }

  function handleError(err: unknown, fallback: string) {
    if (err instanceof ApiError) {
      push(err.message, "error", `code: ${err.code} · req ${err.requestId.slice(0, 8)}…`);
    } else {
      push(fallback, "error");
    }
  }

  async function onSubmitFile() {
    if (!file) return;
    setSubmitting(true);
    try {
      const result = await client.analyzeContract(file);
      announce(result, file.name);
    } catch (err) {
      handleError(err, "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitUrl() {
    const url = urlValue.trim();
    if (!url || submitting) return;
    setSubmitting(true);
    try {
      const result = await client.analyzeUrl(url);
      announce(result, url.split("/").pop() || "Contract from URL");
      setUrlValue("");
      setAltMode(null);
    } catch (err) {
      handleError(err, "URL analysis failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitText() {
    const text = textValue.trim();
    if (text.length < 40 || submitting) return;
    setSubmitting(true);
    try {
      const result = await client.analyzeText(text, "Pasted contract");
      announce(result, "Pasted contract");
      setTextValue("");
      setAltMode(null);
    } catch (err) {
      handleError(err, "Text analysis failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="upload-card"
      className="crystal-glass rounded-3xl p-6 md:p-8 transition-transform"
    >
      <div className="mb-6">
        <h2 className="font-display-hero text-3xl md:text-4xl text-onboarding-navy mb-3 leading-tight">
          Review New Contract
        </h2>
        <p className="text-on-surface-variant">
          Instantly map risks and extract clauses with precision-engineered legal reasoning.
        </p>
      </div>

      <div
        className={`drop-zone-dashed rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center transition-colors group cursor-pointer ${
          over ? "bg-primary/10" : "hover:bg-white/20"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={pick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") pick();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          onChange={onPick}
          disabled={submitting}
          style={{ display: "none" }}
        />
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 36 }}>
            upload_file
          </span>
        </div>
        {file ? (
          <>
            <p className="font-bold text-onboarding-navy mb-1">{file.name}</p>
            <p className="text-[11px] text-on-surface-variant/70 uppercase tracking-wider mb-6">
              {fmtBytes(file.size)} · click to change
            </p>
          </>
        ) : (
          <>
            <p className="font-bold text-onboarding-navy mb-1">Drop your document here</p>
            <p className="text-[11px] text-on-surface-variant/70 uppercase tracking-wider mb-6">
              PDF, DOCX (Max 25MB)
            </p>
          </>
        )}
        <span
          className="bg-primary text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95 relative overflow-hidden"
          onClick={(e) => {
            e.stopPropagation();
            pick();
          }}
        >
          Browse Files
          <span className="shimmer-effect absolute inset-0" />
        </span>
      </div>

      {/* Alternate inputs — now functional */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <button
          type="button"
          onClick={() => setAltMode((m) => (m === "url" ? null : "url"))}
          disabled={submitting}
          className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
            altMode === "url"
              ? "bg-primary/10 border-primary/40 ring-2 ring-primary/20"
              : "bg-white/40 border-white/60 hover:bg-white/60"
          }`}
        >
          <span className="material-symbols-outlined text-primary">link</span>
          <span className="text-xs font-bold text-on-surface">Contract URL</span>
        </button>
        <button
          type="button"
          onClick={() => setAltMode((m) => (m === "text" ? null : "text"))}
          disabled={submitting}
          className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
            altMode === "text"
              ? "bg-primary/10 border-primary/40 ring-2 ring-primary/20"
              : "bg-white/40 border-white/60 hover:bg-white/60"
          }`}
        >
          <span className="material-symbols-outlined text-primary">content_paste</span>
          <span className="text-xs font-bold text-on-surface">Paste Text</span>
        </button>
      </div>

      {altMode === "url" ? (
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmitUrl();
            }}
            placeholder="https://example.com/contract.pdf"
            disabled={submitting}
            className="flex-1 bg-white border border-white/70 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary text-body-sm"
          />
          <button
            type="button"
            onClick={onSubmitUrl}
            disabled={!urlValue.trim() || submitting || !canReview}
            className="btn-capsule btn-capsule-primary text-sm px-6"
          >
            Analyze URL
          </button>
        </div>
      ) : null}

      {altMode === "text" ? (
        <div className="mt-4 flex flex-col gap-3">
          <textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Paste the full contract text here (minimum 40 characters)…"
            rows={6}
            disabled={submitting}
            className="w-full bg-white border border-white/70 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary text-body-sm resize-y"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSubmitText}
              disabled={textValue.trim().length < 40 || submitting || !canReview}
              className="btn-capsule btn-capsule-primary text-sm px-6"
            >
              Analyze text
            </button>
            <span className="text-[11px] text-on-surface-variant">
              {textValue.trim().length} chars
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 mt-6">
        <button
          type="button"
          onClick={onSubmitFile}
          disabled={!canSubmit}
          className="btn-capsule btn-capsule-primary text-sm px-8"
        >
          {submitting ? "Analyzing…" : "Analyze contract"}
        </button>
        {role === "viewer" ? (
          <span className="text-body-sm text-on-surface-variant">Viewer role cannot upload.</span>
        ) : null}
        {file ? (
          <button
            type="button"
            onClick={() => setFile(null)}
            disabled={submitting}
            className="btn-capsule glass-semi-clear text-onboarding-navy text-sm px-6"
          >
            Clear
          </button>
        ) : null}
      </div>

      {submitting ? <div className="shimmer" aria-hidden /> : null}
      {submitting ? (
        <OrbitalLoader
          fullscreen
          statusLines={["Extracting clauses…", "Clarifyd AI reasoning…", "Mapping risk…"]}
        />
      ) : null}
    </section>
  );
}
