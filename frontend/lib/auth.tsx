"use client";

/**
 * Auth bridge over Clerk.
 *
 * Old API surface (login / register / verifyOtp / logout) is preserved as
 * stubs so existing pages compile. The real session lives in Clerk; we
 * just expose the Clerk-issued JWT (via `getToken`) to ApiClient so the
 * backend can verify it against Clerk's JWKS.
 */

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  useAuth as useClerkAuth,
  useClerk,
  useUser,
} from "@clerk/nextjs";

import { ApiClient } from "./api";
import type { Me, Role } from "./contracts";
import { clearLegacyGlobals } from "./user-storage";

const USER_KEY = "clarifyd.user-key";

type AuthState = {
  token: string | null;
  role: Role | null;
  me: Me | null;
  client: ApiClient;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isLoaded: clerkLoaded, isSignedIn, getToken } = useClerkAuth();
  const { user: clerkUser } = useUser();

  // Keep the latest JWT in a ref (exposed as `token` for gating) plus a ref
  // to Clerk's getToken so ApiClient can mint a FRESH token per request —
  // Clerk session tokens expire ~60s, so a cached ref goes stale and the
  // backend rejects it ("Missing"/"Invalid bearer token").
  const tokenRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  // True once the first token fetch has resolved. Keeps `loading` true
  // through the gap between Clerk loading and the async getToken() returning,
  // so the app shells don't briefly see a signed-in user as token-less and
  // bounce them to /login (which then forwarded to /dashboard on refresh).
  const [tokenReady, setTokenReady] = useState(false);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const isSignedInRef = useRef(isSignedIn);
  isSignedInRef.current = isSignedIn;

  // ApiClient fetches a live token at request time via the stable refs, so
  // the client is created once and never holds a stale closure.
  const client = useMemo(
    () =>
      new ApiClient(async () => {
        if (!isSignedInRef.current) return null;
        try {
          return await getTokenRef.current();
        } catch {
          return null;
        }
      }),
    []
  );

  // Refresh Clerk session token periodically (Clerk rotates every ~60s).
  useEffect(() => {
    if (!clerkLoaded) return;
    let cancelled = false;
    let timer: number | null = null;

    async function pull() {
      if (cancelled) return;
      try {
        const t = isSignedIn ? await getToken() : null;
        tokenRef.current = t;
        setToken(t);
      } catch {
        tokenRef.current = null;
        setToken(null);
      } finally {
        if (!cancelled) setTokenReady(true);
      }
      timer = window.setTimeout(pull, 30_000);
    }
    pull();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [clerkLoaded, isSignedIn, getToken]);

  // Map Clerk user -> our local Me shape on every change.
  // Owner-email allowlist mirrors backend _ADMIN_EMAILS so the admin link
  // appears even when Clerk's publicMetadata hasn't been set yet.
  const ADMIN_EMAILS = ["ahmedarshad260@gmail.com"];
  const me: Me | null = useMemo(() => {
    if (!clerkUser) return null;
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? "";
    const metadataRole =
      ((clerkUser.publicMetadata as Record<string, unknown>)?.role as Role) ??
      null;
    const role: Role =
      metadataRole ?? (ADMIN_EMAILS.includes(email) ? "admin" : "reviewer");
    return { id: clerkUser.id, email, role };
  }, [clerkUser]);

  const role: Role | null = me?.role ?? null;

  // Persist per-user storage key + wipe legacy globals on first sight.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!me?.email) return;
    const prev = window.localStorage.getItem(USER_KEY);
    window.localStorage.setItem(USER_KEY, me.email);
    if (prev !== me.email) clearLegacyGlobals();
  }, [me?.email]);

  const logout = useMemo(
    () => async () => {
      try {
        await signOut(() => router.replace("/login"));
      } catch {
        router.replace("/login");
      }
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(USER_KEY);
        clearLegacyGlobals();
      }
    },
    [signOut, router]
  );

  // Legacy stubs — the dashboard / pages still import these. Clerk owns the
  // real flow now, so these just point the user at the Clerk-hosted page.
  const noop = useMemo(
    () => async () => {
      router.push("/login");
    },
    [router]
  );

  const value: AuthState = {
    token,
    role,
    me,
    client,
    // Stay "loading" until Clerk has loaded AND (for a signed-in user) the
    // first token has resolved — otherwise the brief token-null window makes
    // shells redirect a logged-in user to /login on refresh.
    loading: !clerkLoaded || (isSignedIn === true && !tokenReady),
    error: null,
    login: noop,
    register: noop,
    verifyOtp: noop,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
