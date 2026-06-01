import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistSans, GeistMono } from "geist/font";
import { GoogleAnalytics } from "@next/third-parties/google";

import "./globals.css";
import { ToastProvider } from "../lib/toast";
import { ConditionalProviders } from "../components/conditional-providers";
import { CookieConsent } from "../components/common/cookie-consent";
import { NavProgress } from "../components/common/nav-progress";

export const metadata: Metadata = {
  title: "Clarifyd — Read your next contract like a senior counsel",
  description:
    "Drop in a SAFE, term sheet, or vendor MSA. Clarifyd AI flags loopholes, rewrites risky clauses, and hands you a draft your counterparty can sign.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Root layout — Geist + Geist Mono via next/font (no CDN).
 *
 * CSP retained: dev gets 'unsafe-eval' for HMR; prod stays strict.
 * Tailwind via CDN remains for utility classes used in components.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  const isDev = process.env.NODE_ENV !== "production";
  // GA4 Measurement ID is public (ships in client HTML), so a hardcoded
  // fallback is safe; env var still overrides per environment.
  const gaId = process.env.NEXT_PUBLIC_GA_ID ?? "G-P6CTYG3TD1";
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://*.clarifyd.app",
    "https://challenges.cloudflare.com",
    "https://www.googletagmanager.com",
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
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
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
            "img-src 'self' data: blob: https://*.clerk.accounts.dev https://*.clarifyd.app https://img.clerk.com https://graph.facebook.com https://lh3.googleusercontent.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com",
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
      </head>
      <body>
        <ToastProvider>
          <ConditionalProviders>
            <NavProgress />
            {children}
            <CookieConsent />
          </ConditionalProviders>
        </ToastProvider>
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
