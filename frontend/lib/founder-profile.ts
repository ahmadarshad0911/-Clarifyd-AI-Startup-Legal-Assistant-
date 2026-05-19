// Local founder profile store — kept in localStorage until a real backend
// profile table lands. Read by the Co-Pilot, Negotiation Lab, and any flow
// that wants to give Clarifyd AI user context without re-asking each time.

import { readJSON, writeJSON, readString, writeString } from "./user-storage";

const KEY = "clarifyd.founder-profile";
const ONBOARDED = "clarifyd.onboarded";

export type FounderProfile = {
  // Step 1 — auto-filled from auth
  email?: string;
  full_name?: string;
  // Step 2 — Venture profile
  stage?: string; // pre_seed | seed | series_a | enterprise
  audit_rigor?: number; // 0..100
  // Step 3 — Workspace ready
  company_name?: string;
  sector?: string;
  jurisdiction?: string;
  role?: string;
  // Meta
  steps_completed?: number; // highest completed step (1..3)
  updated_at?: string;
};

export function getProfile(): FounderProfile {
  return readJSON<FounderProfile>(KEY, {});
}

export function setProfile(patch: Partial<FounderProfile>): FounderProfile {
  const current = getProfile();
  const next: FounderProfile = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  writeJSON(KEY, next);
  return next;
}

export function markOnboarded(): void {
  writeString(ONBOARDED, "1");
}

export function isOnboarded(): boolean {
  return readString(ONBOARDED) === "1";
}

/**
 * Render a one-shot snapshot of what we know about the founder, ready to
 * inject into a Clarifyd AI opener so it doesn't have to re-ask the basics.
 * Returns an empty string when nothing useful is set.
 */
export function profileContextLine(p: FounderProfile = getProfile()): string {
  const parts: string[] = [];
  if (p.full_name) parts.push(`name: ${p.full_name}`);
  if (p.company_name) parts.push(`company: ${p.company_name}`);
  if (p.role) parts.push(`role: ${p.role}`);
  if (p.stage) parts.push(`stage: ${p.stage.replace(/_/g, " ")}`);
  if (p.sector) parts.push(`sector: ${p.sector}`);
  if (p.jurisdiction) parts.push(`jurisdiction: ${p.jurisdiction}`);
  if (typeof p.audit_rigor === "number") {
    const label =
      p.audit_rigor < 34 ? "permissive" : p.audit_rigor < 67 ? "standard" : "hyper-defensive";
    parts.push(`audit posture: ${label}`);
  }
  if (!parts.length) return "";
  return `FOUNDER CONTEXT — ${parts.join(" · ")}. Use this; do not re-ask.`;
}
