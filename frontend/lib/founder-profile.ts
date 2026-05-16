// Local founder profile store — kept in localStorage until a real backend
// profile table lands. Read by the Co-Pilot, Negotiation Lab, and any flow
// that wants to give Kimi user context without re-asking each time.

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
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as FounderProfile;
  } catch {
    return {};
  }
}

export function setProfile(patch: Partial<FounderProfile>): FounderProfile {
  const current = getProfile();
  const next: FounderProfile = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private-mode errors
  }
  return next;
}

export function markOnboarded(): void {
  try {
    window.localStorage.setItem(ONBOARDED, "1");
  } catch {
    // ignore
  }
}

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ONBOARDED) === "1";
  } catch {
    return false;
  }
}

/**
 * Render a one-shot snapshot of what we know about the founder, ready to
 * inject into a Kimi opener so it doesn't have to re-ask the basics.
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
