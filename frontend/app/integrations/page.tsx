"use client";

/**
 * /integrations — workflow cross-cutting (§6.16).
 *
 * Toggleable connectors that pipe Clarifyd events into existing tools.
 * Live ones: webhooks (configured via panel). Waitlist for Slack, Linear,
 * Drive, Notion, Stripe — they're shipped one-by-one as demand verifies.
 */

import { motion } from "framer-motion";
import { PuzzlePiece } from "@phosphor-icons/react";
import { useToast } from "../../lib/toast";
import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { IntegrationsPanel, type Integration } from "../../components/integrations-panel";

export default function IntegrationsPage() {
  const { push } = useToast();

  const items: Integration[] = [
    {
      id: "webhooks", name: "Webhooks", tagline: "POST every analysis to your endpoint. Signed with HMAC.",
      status: "configure",
      onConfigure: () => push("Configure webhooks → coming next sprint.", "info"),
    },
    {
      id: "slack", name: "Slack", tagline: "Critical findings → #legal-alerts within 30s.",
      status: "waitlist",
      onRequest: () => push("Slack request logged. We'll email when it ships.", "success"),
    },
    {
      id: "linear", name: "Linear", tagline: "Auto-file an issue per high-risk clause, assigned to GC.",
      status: "waitlist",
      onRequest: () => push("Linear request logged.", "success"),
    },
    {
      id: "drive", name: "Google Drive", tagline: "Sync exported drafts back to a shared folder.",
      status: "waitlist",
      onRequest: () => push("Drive request logged.", "success"),
    },
    {
      id: "notion", name: "Notion", tagline: "Mirror findings into your Notion legal hub.",
      status: "waitlist",
      onRequest: () => push("Notion request logged.", "success"),
    },
    {
      id: "stripe", name: "Stripe (vendor billing)", tagline: "Flag MSA pricing drift against your Stripe subscriptions.",
      status: "waitlist",
      onRequest: () => push("Stripe request logged.", "success"),
    },
  ];

  return (
    <AppShell>
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="cf-eyebrow" style={{ color: "var(--brand-500)", display: "inline-flex", alignItems: "center", gap: 8 }}>
          <PuzzlePiece weight="duotone" size={14} aria-hidden />
          Integrations
        </div>
        <h1 style={{ marginTop: 8, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Pipe Clarifyd into the tools you already live in.
        </h1>
        <p style={{ marginTop: 8, color: "var(--ink-secondary)", fontSize: 14.5, maxWidth: 540 }}>
          We ship integrations one at a time, after enough waitlist signal. No half-broken connectors.
        </p>
      </motion.header>

      <section style={{ marginTop: 28 }}>
        <IntegrationsPanel items={items} />
      </section>

      <p className="cf-mono" style={{ marginTop: 18, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 600 }}>
        Need something not listed? <a href="/contact" style={{ color: "var(--brand-500)" }}>Tell us →</a>
      </p>
    </AppShell>
  );
}
