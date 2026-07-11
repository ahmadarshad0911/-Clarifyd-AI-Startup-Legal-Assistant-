/**
 * Per-user localStorage helper.
 *
 * Reads/writes scoped to the currently-signed-in user via `clarifyd.user-key`
 * (set by AuthProvider to the Clerk user id). Falls back to the raw key when
 * no user is signed in.
 */

const USER_KEY = "clarifyd.user-key";
const PREFIX = "clarifyd.";

/** Suffix the storage key with the active user identifier. */
export function userKey(base: string): string {
  if (typeof window === "undefined") return base;
  const u = window.localStorage.getItem(USER_KEY);
  return u ? `${base}:${u}` : base;
}

/** The account id this device's Clarifyd storage currently belongs to. */
export function getActiveUser(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

/**
 * Point storage at `userId`, wiping the previous account's data first.
 * Callers that read scoped storage during a user switch must check
 * `getActiveUser() === userId` before trusting what they read — until this
 * runs, scoped reads still resolve against the previous account.
 */
export function setActiveUser(userId: string): void {
  if (typeof window === "undefined") return;
  const prev = getActiveUser();
  if (prev === userId) return;
  if (prev !== null) clearUserStorage();
  try {
    window.localStorage.setItem(USER_KEY, userId);
  } catch {}
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

/**
 * Device-level keys that survive a user switch: they describe the browser, not
 * the person. Cookie consent is a per-device legal record — re-prompting on
 * every account switch would be wrong.
 */
const DEVICE_KEYS: readonly string[] = [
  "clarifyd.cookie-consent",
  "clarifyd.rail.collapsed",
];

/**
 * Drop every Clarifyd localStorage entry for the previous user: scoped keys,
 * un-scoped keys written by older builds, and the active user key itself.
 * Called on logout and whenever a different user signs in on this browser.
 */
export function clearUserStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      if (DEVICE_KEYS.includes(key)) continue;
      doomed.push(key);
    }
    for (const key of doomed) window.localStorage.removeItem(key);
  } catch {}
}
