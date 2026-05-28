import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans, GeistMono } from "geist/font";
import { ClerkProvider } from "@clerk/nextjs";

import "./globals.css";
import { AuthProvider } from "../lib/auth";
import { ToastProvider } from "../lib/toast";
import { CookieConsent } from "../components/common/cookie-consent";

export const metadata: Metadata = {
  title: "Clarifyd — Read your next contract like a senior counsel",
  description:
    "Drop in a SAFE, term sheet, or vendor MSA. Clarifyd AI flags loopholes, rewrites risky clauses, and hands you a draft your counterparty can sign.",
};

/**
 * Root layout — Geist + Geist Mono via next/font (no CDN).
 *
 * CSP retained: dev gets 'unsafe-eval' for HMR; prod stays strict.
 * Tailwind via CDN remains for utility classes used in components.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://cdn.tailwindcss.com",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://*.clarifyd.app",
    "https://challenges.cloudflare.com",
    isDev ? "'unsafe-eval'" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const connectSrc = [
    "'self'",
    "http://localhost:8000",
    "http://localhost:8001",
    "https://*.trycloudflare.com",
    "https://*.onrender.com",
    "https://*.vercel.app",
    "https://*.ondigitalocean.app",
    "https://clarifyd.app",
    "https://*.clarifyd.app",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://clerk-telemetry.com",
    isDev ? "ws://localhost:*" : null,
    isDev ? "http://localhost:*" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={[
            "default-src 'self'",
            `script-src ${scriptSrc}`,
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data:",
            "img-src 'self' data: blob: https://*.clerk.accounts.dev https://*.clarifyd.app https://img.clerk.com https://graph.facebook.com https://lh3.googleusercontent.com",
            `connect-src ${connectSrc}`,
            // Clerk uses Cloudflare Turnstile (challenges.cloudflare.com)
            // and Clerk-hosted iframes for OAuth/captcha flows.
            "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com https://*.clarifyd.app https://accounts.google.com https://www.facebook.com",
            "worker-src 'self' blob:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self' https://accounts.google.com https://www.facebook.com",
          ].join("; ")}
        />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        {/* Tailwind via CDN — utility-only fallback while we stay on
            App Router w/o a build step. Bento utilities use plain CSS
            vars defined in globals.css. */}
        <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" />
      </head>
      <body>
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
            <ToastProvider>
              {children}
              <CookieConsent />
            </ToastProvider>
          </AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
