// Session-scoped store of analyzed documents so the Findings page can switch
// between multiple uploaded contracts.

import type { AnalyzeContractResponse } from "./contracts";

const KEY = "clarifyd.analyses";
const MAX = 12;

export type StoredAnalysis = {
  draft_id: string;
  file_name: string;
  analyzed_at: string;
  analysis: AnalyzeContractResponse;
};

function read(): StoredAnalysis[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: StoredAnalysis[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // storage full / unavailable — non-fatal
  }
}

export function listAnalyses(): StoredAnalysis[] {
  return read();
}

export function pushAnalysis(
  analysis: AnalyzeContractResponse,
  fileName: string
): StoredAnalysis[] {
  const entry: StoredAnalysis = {
    draft_id: analysis.draft_id,
    file_name: fileName,
    analyzed_at: new Date().toISOString(),
    analysis,
  };
  const rest = read().filter((a) => a.draft_id !== entry.draft_id);
  const next = [entry, ...rest].slice(0, MAX);
  write(next);
  return next;
}

export function getAnalysis(draftId: string): StoredAnalysis | null {
  return read().find((a) => a.draft_id === draftId) ?? null;
}
