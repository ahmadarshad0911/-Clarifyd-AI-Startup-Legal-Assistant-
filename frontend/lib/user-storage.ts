/**
 * Per-user localStorage helper.
 *
 * Reads/writes scoped to the currently-signed-in user via `clarifyd.user-key`
 * (set by AuthProvider after /auth/me). Falls back to the raw key when no
 * user is signed in.
 */

const USER_KEY = "clarifyd.user-key";

/** Suffix the storage key with the active user identifier. */
export function userKey(base: string): string {
  if (typeof window === "undefined") return base;
  const u = window.localStorage.getItem(USER_KEY);
  return u ? `${base}:${u}` : base;
}

export function readJSON<T>(base: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(userKey(base));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(base: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(userKey(base), JSON.stringify(value));
  } catch {}
}

export function readString(base: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(userKey(base));
  } catch {
    return null;
  }
}

export function writeString(base: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(userKey(base), value);
  } catch {}
}

export function removeKey(base: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(userKey(base));
  } catch {}
}

/** Wipe legacy (un-scoped) localStorage entries that prior versions set. */
export const LEGACY_USER_KEYS = [
  "clarifyd.founder-profile",
  "clarifyd.onboarded",
  "clarifyd.recent-drafts",
  "clarifyd.analyses",
  "clarifyd.monitor.deadlines",
  "clarifyd.feedback",
  "clarifyd.contacts",
  "clarifyd.lawyer-waitlist",
  "clarifyd.terms-accepted",
  "clarifyd.disclaimer-ack",
  "clarifyd.plan",
] as const;

export function clearLegacyGlobals(): void {
  if (typeof window === "undefined") return;
  for (const k of LEGACY_USER_KEYS) {
    try { window.localStorage.removeItem(k); } catch {}
  }
}
