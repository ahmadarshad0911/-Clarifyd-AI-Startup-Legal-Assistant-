"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ClerkProvider } from "@clerk/nextjs";

import { AuthProvider, StubAuthProvider } from "../lib/auth";
import { AnalysisProvider } from "../lib/analysis-context";

// Public marketing pages that must NOT pay the ~220KB ClerkJS cost. Anything
// not listed here (app routes + /login) gets the real Clerk-backed stack.
const PUBLIC_PREFIXES = [
  "/landing-preview",
  "/faq",
  "/pricing",
  "/contact",
  "/terms",
  "/security",
  "/changelog",
  "/status",
];

function isPublicMarketing(path: string): boolean {
  if (path === "/") return true;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

/**
 * Route-aware provider boundary. Marketing pages render with a Clerk-free
 * stub auth context (no ClerkJS download/parse on a slow phone → big mobile
 * PageSpeed win). Every other route boots the full Clerk + analysis stack.
 */
export function ConditionalProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";

  if (isPublicMarketing(pathname)) {
    return <StubAuthProvider>{children}</StubAuthProvider>;
  }

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#b8260f",
          colorBackground: "#f4ede1",
          colorText: "#0c0a08",
          colorInputBackground: "#f7f1e7",
          borderRadius: "2px",
          fontFamily:
            "Geist, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
        },
      }}
    >
      <AuthProvider>
        <AnalysisProvider>{children}</AnalysisProvider>
      </AuthProvider>
    </ClerkProvider>
  );
}
