"use client";

/** /terms — Broadsheet · v6 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft } from "@phosphor-icons/react";

import { PublicShell } from "../../components/public-shell";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";

type TabId = "terms" | "privacy" | "cookies";
type Section = { n: string; title: string; body: string[]; bullets?: string[]; quote?: string };

const CONTENT: Record<TabId, { label: string; subtitle: string; sections: Section[] }> = {
  terms: {
    label: "Terms of Service",
    subtitle: "Read carefully before using the Clarifyd platform.",
    sections: [
      { n: "01", title: "Definitions", body: [
        `"Platform" refers to the Clarifyd AI-driven legal analysis environment, including all subdomains, APIs, and associated software tools.`,
        `"User Content" encompasses all legal documents, contracts, clauses, and metadata uploaded to or processed through the platform.`,
        `"Reasoning Output" defines the AI-generated risk assessments, summaries, and linguistic interpretations provided by the Clarifyd AI reasoning engine.`,
      ]},
      { n: "02", title: "Services & Scope", body: ["Clarifyd provides a cloud-based service for high-speed contract review and risk identification, intended for founders augmenting their workflow with AI."], bullets: [
        "Automated clause identification and extraction.",
        "Multi-factor risk scoring against industry baselines.",
        "Clarifyd AI loophole detection and counter-offer drafting.",
        "Citation-grounded findings — no hallucinated clauses.",
      ]},
      { n: "03", title: "Limitation of Liability", body: ["To the maximum extent permitted by applicable law, Clarifyd shall not be liable for any indirect, incidental, special, consequential, or punitive damages."], quote: "The platform is a decision-support tool. It does not replace the judgment of qualified legal counsel." },
      { n: "04", title: "Intellectual Property", body: ["You retain all rights to the User Content uploaded. Clarifyd retains all rights to the platform and any performance improvements derived from anonymized aggregated metadata."] },
      { n: "05", title: "Data & Retention", body: ["Documents are processed in a zero-retention enclave. Source files are purged 365 days after upload unless explicitly retained. Audit hashes and tamper-evident records persist for compliance."] },
      { n: "06", title: "AI limitations & legal notice", body: [
        "Clarifyd uses artificial intelligence to read, classify, and summarize the contracts you upload. AI can and does make mistakes — it can miss clauses, misread context, mis-categorize severity, or generate suggestions that are inappropriate for your specific facts.",
        "Clarifyd is decision support only. Clarifyd is not a law firm, does not provide legal advice, and does not establish a lawyer-client relationship. Outputs are not a substitute for review by qualified legal counsel licensed in your jurisdiction.",
        "You are responsible for verifying every finding before relying on it. For any binding commitment, retain a lawyer.",
      ], quote: "AI can make mistakes. Verify before you sign." },
    ],
  },
  privacy: {
    label: "Privacy Policy",
    subtitle: "How Clarifyd handles, processes, and protects the contracts you trust us with.",
    sections: [
      { n: "01", title: "What we collect", body: [
        "Account: email, password hash (bcrypt-12), role, OAuth identity claims if you sign in with Google or Facebook.",
        "Contracts: only what you upload. We never scrape email or third-party stores.",
        "Telemetry: anonymous page-view + latency buckets so we can find slow surfaces.",
      ]},
      { n: "02", title: "How we use it", body: [
        "Contracts are sent to Clarifyd AI for reasoning, then cached by SHA-256 so a re-upload of the same contract is byte-identical and free.",
        "No customer contract content trains any model — ever.",
      ]},
      { n: "03", title: "Where it lives", body: ["Postgres in our managed cloud (us-east), serverless runtime (iad1). TLS 1.3 in transit, AES-256 at rest. JWT auth with bcrypt-12 password hashing."] },
      { n: "04", title: "Your controls", body: ["Delete account anytime from Settings. We hard-delete user row + owned drafts within 24h. Audit log entries are anonymized — user_id zeroed, hash chain stays intact for compliance."] },
    ],
  },
  cookies: {
    label: "Cookies",
    subtitle: "What we store on your device and why.",
    sections: [
      { n: "01", title: "Essential cookies", body: ["Required for the platform to function — authentication, CSRF protection, session state. Cannot be disabled."] },
      { n: "02", title: "Analytics cookies", body: ["Anonymous usage signals that help us find slow surfaces. Aggregated only."], bullets: ["Page views, feature usage, latency buckets.", "Optional — disable any time from the cookie popup."] },
      { n: "03", title: "Marketing cookies", body: ["Optional personalization across Clarifyd surfaces. Off by default."], quote: "Essential cookies always on. Analytics + Marketing always your choice." },
    ],
  },
};

const TABS: { id: TabId; label: string }[] = [
  { id: "terms", label: "Terms" },
  { id: "privacy", label: "Privacy" },
  { id: "cookies", label: "Cookies" },
];

const EOQ = [0.23, 1, 0.32, 1] as const;

export default function TermsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--bsd-paper)", color: "var(--bsd-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { token } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("tab") as TabId | null) ?? "terms";
  const [tab, setTab] = useState<TabId>(initial === "privacy" || initial === "cookies" ? initial : "terms");
  const [accepted, setAccepted] = useState(false);

  function selectTab(id: TabId) {
    setTab(id);
    const url = new URL(window.location.href);
    if (id === "terms") url.searchParams.delete("tab"); else url.searchParams.set("tab", id);
    window.history.replaceState({}, "", url.toString());
  }

  const data = CONTENT[tab];
  const next = params.get("next");
  const ctaHref = token ? next || "/dashboard" : "/login";

  function onAccept() {
    if (!accepted) { push("Tick the checkbox to confirm.", "info"); return; }
    try { window.localStorage.setItem("clarifyd.terms-accepted", JSON.stringify({ accepted_at: new Date().toISOString() })); } catch {}
    push("Terms accepted", "success");
    setTimeout(() => router.push(ctaHref), 350);
  }

  return (
    <PublicShell>
      <section style={{ padding: "72px 32px 32px", borderBottom: "1.5px solid var(--bsd-ink)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EOQ }}>
            <span className="bsd-kicker">§ Legal</span>
            <h1 style={{ margin: "12px 0 0", fontSize: "clamp(48px, 7vw, 96px)", lineHeight: 0.95, letterSpacing: "-0.04em", color: "var(--bsd-ink)", fontWeight: 700 }}>
              {data.label}
            </h1>
            <p style={{ marginTop: 16, color: "var(--bsd-body)", fontSize: 16, lineHeight: 1.6, maxWidth: 600 }}>
              {data.subtitle}
            </p>
          </motion.div>
          <div style={{ marginTop: 26, display: "inline-flex", border: "1.5px solid var(--bsd-ink)", padding: 3 }}>
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTab(t.id)}
                  className="cursor-pointer cf-mono"
                  style={{
                    background: active ? "var(--bsd-ink)" : "transparent",
                    color: active ? "var(--bsd-paper)" : "var(--bsd-ink)",
                    border: "none", padding: "8px 16px",
                    fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800,
                    transition: "background var(--dur-base) ease, color var(--dur-base) ease",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <article style={{ padding: "48px 32px", maxWidth: 920, margin: "0 auto" }}>
        {data.sections.map((s, i) => (
          <motion.section
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.4, ease: EOQ, delay: i * 0.04 }}
            style={{ padding: "28px 0", borderTop: i === 0 ? "2px solid var(--bsd-ink)" : "1px solid var(--bsd-hairline)", borderBottom: i === data.sections.length - 1 ? "2px solid var(--bsd-ink)" : "none" }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span className="cf-mono" style={{ fontSize: 14, color: "var(--bsd-red)", letterSpacing: "0.16em", fontWeight: 800 }}>
                {s.n}
              </span>
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.015em", margin: 0, color: "var(--bsd-ink)" }}>{s.title}</h2>
            </div>
            <div style={{ marginTop: 14, paddingLeft: 28, display: "flex", flexDirection: "column", gap: 12 }}>
              {s.body.map((p, j) => (
                <p key={j} style={{ margin: 0, fontSize: 14.5, color: "var(--bsd-body)", lineHeight: 1.65 }}>{p}</p>
              ))}
            </div>
            {s.bullets ? (
              <ul style={{ marginTop: 14, paddingLeft: 28, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {s.bullets.map((b, j) => (
                  <li key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--bsd-body)", lineHeight: 1.55 }}>
                    <span style={{ color: "var(--bsd-red)", marginTop: 2, fontWeight: 800 }}>·</span>
                    {b}
                  </li>
                ))}
              </ul>
            ) : null}
            {s.quote ? (
              <blockquote style={{ marginTop: 18, padding: "10px 18px", fontSize: 16, color: "var(--bsd-ink)", fontStyle: "italic", lineHeight: 1.5, borderLeft: "2px solid var(--bsd-red)" }}>
                &ldquo;{s.quote}&rdquo;
              </blockquote>
            ) : null}
          </motion.section>
        ))}
      </article>

      {tab === "terms" ? (
        <div style={{ padding: "0 32px 64px", maxWidth: 920, margin: "0 auto" }}>
          <div style={{ background: "var(--bsd-paper-deep)", border: "2px solid var(--bsd-ink)", padding: 28 }}>
            <label className="cursor-pointer" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                style={{ marginTop: 4, width: 16, height: 16, accentColor: "var(--bsd-red)", cursor: "pointer" }}
              />
              <span style={{ fontSize: 14.5, color: "var(--bsd-ink)", lineHeight: 1.55 }}>
                I have read and accept the Clarifyd Terms of Service and Privacy Policy. The platform is a decision-support tool and does not replace qualified legal counsel.
              </span>
            </label>
            <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 14 }}>
              <Link href="/" className="bsd-link cf-mono" style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <ArrowLeft weight="bold" size={11} /> Cancel
              </Link>
              <button
                type="button"
                onClick={onAccept}
                disabled={!accepted}
                className="bsd-btn cursor-pointer"
              >
                Accept &amp; continue <ArrowRight weight="bold" size={11} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PublicShell>
  );
}
