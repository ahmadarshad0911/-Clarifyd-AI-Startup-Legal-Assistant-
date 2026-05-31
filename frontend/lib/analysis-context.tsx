"use client";

/**
 * Global analysis runner. The fetch lives here, above the route outlet, so
 * an in-flight contract analysis survives page navigation — switching tabs
 * no longer abandons the request. A persistent pill shows progress and
 * links to the finished findings.
 */

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "./auth";
import { useToast } from "./toast";
import { pushAnalysis } from "./analyses";
import { ApiError } from "./api";
import type { AnalyzeContractResponse } from "./contracts";

export type StartAnalysisArgs = {
  mode: "file" | "text";
  file?: File | null;
  text?: string;
  name?: string;
};

export type AnalysisOutcome = {
  ok: boolean;
  draftId?: string;
  findings?: number;
  notContract?: boolean;
  message?: string;
};

type AnalysisState = {
  isAnalyzing: boolean;
  source: string | null;
  lastDraftId: string | null;
  startAnalysis: (args: StartAnalysisArgs) => Promise<AnalysisOutcome>;
};

const AnalysisContext = createContext<AnalysisState | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const { client } = useAuth();
  const { push } = useToast();
  const router = useRouter();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [lastDraftId, setLastDraftId] = useState<string | null>(null);

  const startAnalysis = useCallback(
    async (args: StartAnalysisArgs): Promise<AnalysisOutcome> => {
      let label: string;
      let work: Promise<AnalyzeContractResponse>;
      if (args.mode === "file") {
        if (!args.file) return { ok: false, message: "Pick a file first." };
        label = args.file.name;
        work = client.analyzeContract(args.file);
      } else {
        const text = args.text ?? "";
        if (text.trim().length < 40)
          return { ok: false, message: "Paste at least 40 characters of contract text." };
        label = (args.name ?? "").trim() || "Pasted contract";
        work = client.analyzeText(text, label);
      }

      setSource(label);
      setIsAnalyzing(true);

      try {
        const res = await work;
        pushAnalysis(res, label);
        setLastDraftId(res.draft_id);
        push("Analysis ready", "success", `${res.findings.length} finding(s) · ${label}`);
        return { ok: true, draftId: res.draft_id, findings: res.findings.length };
      } catch (err) {
        if (err instanceof ApiError && err.code === "not_a_contract") {
          return { ok: false, notContract: true, message: err.message };
        }
        const msg =
          err instanceof ApiError
            ? `${err.message} [${err.status}]`
            : err instanceof Error
            ? err.message
            : "Analysis failed.";
        push("Analysis failed", "error", msg);
        return { ok: false, message: msg };
      } finally {
        setIsAnalyzing(false);
      }
    },
    [client, push],
  );

  const value = useMemo<AnalysisState>(
    () => ({ isAnalyzing, source, lastDraftId, startAnalysis }),
    [isAnalyzing, source, lastDraftId, startAnalysis],
  );

  return (
    <AnalysisContext.Provider value={value}>
      {children}
      {isAnalyzing ? (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            left: 18,
            bottom: 18,
            zIndex: 9998,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            background: "var(--bsd-ink)",
            color: "var(--bsd-paper)",
            border: "1.5px solid var(--bsd-ink)",
            fontFamily: "Geist Mono, monospace",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            maxWidth: "calc(100vw - 36px)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 9,
              height: 9,
              borderRadius: 999,
              background: "var(--bsd-red)",
              animation: "bsd-pulse 1s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Analyzing {source ?? "contract"}…
          </span>
        </div>
      ) : null}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): AnalysisState {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used inside <AnalysisProvider>");
  return ctx;
}
