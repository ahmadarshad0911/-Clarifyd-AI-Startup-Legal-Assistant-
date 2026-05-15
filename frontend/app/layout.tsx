import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "../lib/auth";
import { ToastProvider } from "../lib/toast";
import { CookieConsent } from "../components/common/cookie-consent";

export const metadata: Metadata = {
  title: "Clarifyd · AI Contract Risk Analyzer",
  description:
    "Upload contracts, score clause risk with rules + LLM, route findings to reviewers, export tamper-evident reports.",
};

const TAILWIND_CONFIG = `tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary-fixed-dim": "#c3c0ff",
        "onboarding-navy": "#1E3A8A",
        "app-bg-gradient-1": "#c7d2fe",
        "surface-container-low": "#f5f2ff",
        "on-secondary-fixed-variant": "#264191",
        "on-secondary-container": "#1d3989",
        "surface-container": "#f0ecf9",
        "glass-border": "rgba(255, 255, 255, 0.3)",
        "status-warn": "#ea580c",
        "surface-tint": "#4d44e3",
        "surface-container-high": "#eae6f4",
        "tertiary": "#7e3000",
        "tertiary-fixed": "#ffdbcc",
        "text-muted": "#334155",
        "inverse-surface": "#302f39",
        "status-info": "#2563eb",
        "primary-container": "#4f46e5",
        "on-tertiary-fixed": "#351000",
        "on-tertiary": "#ffffff",
        "surface-bright": "#fcf8ff",
        "tertiary-container": "#a44100",
        "app-bg-gradient-2": "#fbcfe8",
        "tertiary-fixed-dim": "#ffb695",
        "error": "#ba1a1a",
        "surface-container-highest": "#e4e1ee",
        "on-primary-fixed-variant": "#3323cc",
        "onboarding-gold": "#B45309",
        "status-success": "#059669",
        "inverse-primary": "#c3c0ff",
        "surface-container-lowest": "#ffffff",
        "secondary": "#4059aa",
        "glass-fill": "rgba(255, 255, 255, 0.55)",
        "outline-variant": "#c7c4d8",
        "on-surface": "#1b1b24",
        "app-bg-gradient-3": "#a5f3fc",
        "on-surface-variant": "#464555",
        "on-tertiary-container": "#ffd2be",
        "on-primary-fixed": "#0f0069",
        "surface-dim": "#dcd8e5",
        "secondary-fixed-dim": "#b6c4ff",
        "primary": "#3525cd",
        "on-secondary": "#ffffff",
        "surface-variant": "#e4e1ee",
        "app-bg-gradient-4": "#ddd6fe",
        "on-error": "#ffffff",
        "on-background": "#1b1b24",
        "error-container": "#ffdad6",
        "text-primary": "#0f172a",
        "on-tertiary-fixed-variant": "#7b2f00",
        "secondary-fixed": "#dce1ff",
        "outline": "#777587",
        "on-primary-container": "#dad7ff",
        "on-secondary-fixed": "#00164e",
        "status-danger": "#dc2626",
        "onboarding-bg": "#F8FAFC",
        "secondary-container": "#8fa7fe",
        "accent-violet": "#7c3aed",
        "accent-indigo": "#4f46e5",
        "surface": "#fcf8ff",
        "inverse-on-surface": "#f3effc",
        "primary-fixed": "#e2dfff",
        "background": "#fcf8ff",
        "on-error-container": "#93000a",
        "on-primary": "#ffffff",
        "laser-cyan": "#22d3ee"
      },
      borderRadius: { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "2xl": "1rem", "3xl": "1.5rem", "full": "9999px" },
      spacing: {
        "margin-mobile": "16px",
        "margin-desktop": "40px",
        "container-max": "1280px",
        "gutter": "24px",
        "inspector-panel-width": "380px",
        "unit": "4px",
        "nav-sidebar-width": "256px"
      },
      fontFamily: {
        "h3": ["Plus Jakarta Sans"], "h1-mobile": ["Plus Jakarta Sans"], "code-snippet": ["JetBrains Mono"],
        "body-sm": ["Plus Jakarta Sans"], "h2": ["Plus Jakarta Sans"], "h1": ["Plus Jakarta Sans"], "body-lg": ["Plus Jakarta Sans"],
        "display-hero": ["Fraunces"], "label-caps": ["Plus Jakarta Sans"]
      },
      fontSize: {
        "h3": ["20px", { "lineHeight": "1.4", "fontWeight": "600" }],
        "h1-mobile": ["26px", { "lineHeight": "1.2", "fontWeight": "700" }],
        "code-snippet": ["14px", { "lineHeight": "1.5", "fontWeight": "400" }],
        "body-sm": ["14px", { "lineHeight": "1.5", "fontWeight": "400" }],
        "h2": ["24px", { "lineHeight": "1.3", "fontWeight": "600" }],
        "h1": ["32px", { "lineHeight": "1.25", "letterSpacing": "-0.01em", "fontWeight": "700" }],
        "body-lg": ["16px", { "lineHeight": "1.6", "fontWeight": "400" }],
        "display-hero": ["40px", { "lineHeight": "1.2", "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "label-caps": ["12px", { "lineHeight": "1", "letterSpacing": "0.05em", "fontWeight": "700" }]
      }
    }
  }
};`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" />
        <script
          id="tailwind-config"
          dangerouslySetInnerHTML={{ __html: TAILWIND_CONFIG }}
        />
      </head>
      <body>
        <AuthProvider>
          <ToastProvider>
            {children}
            <CookieConsent />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
