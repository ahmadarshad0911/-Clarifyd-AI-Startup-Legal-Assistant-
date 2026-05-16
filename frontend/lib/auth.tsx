"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ApiClient } from "./api";
import type { Me, Role } from "./contracts";

const TOKEN_KEY = "clarifyd.token";
const ROLE_KEY = "clarifyd.role";

type AuthState = {
  token: string | null;
  role: Role | null;
  me: Me | null;
  client: ApiClient;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => new ApiClient(() => token), [token]);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    const stored = window.localStorage.getItem(TOKEN_KEY);
    const storedRole = window.localStorage.getItem(ROLE_KEY) as Role | null;
    if (stored) {
      setToken(stored);
      setRole(storedRole);
    }
    setLoading(false);
  }, []);

  // Refresh /auth/me whenever token changes.
  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }
    let cancelled = false;
    client
      .me()
      .then((m) => {
        if (!cancelled) setMe(m);
      })
      .catch(() => {
        if (!cancelled) {
          // Token invalid — drop it.
          setToken(null);
          setRole(null);
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(TOKEN_KEY);
            window.localStorage.removeItem(ROLE_KEY);
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, client]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const res = await new ApiClient(() => null).login({ email, password });
      setToken(res.access_token);
      setRole(res.role);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TOKEN_KEY, res.access_token);
        window.localStorage.setItem(ROLE_KEY, res.role);
      }
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const res = await new ApiClient(() => null).register({ email, password });
      setToken(res.access_token);
      setRole(res.role);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TOKEN_KEY, res.access_token);
        window.localStorage.setItem(ROLE_KEY, res.role);
      }
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setRole(null);
    setMe(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(ROLE_KEY);
    }
  }, []);

  const value: AuthState = {
    token,
    role,
    me,
    client,
    loading,
    error,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
