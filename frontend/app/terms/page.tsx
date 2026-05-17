"use client";

/** Terms / Privacy / Cookies — dark editorial. Tabbed content + accept gate. */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";

type TabId = "terms" | "privacy" | "cookies";

type Section = {
  n: string;
  title: string;
  body: string[];
  bullets?: string[];
  quote?: string;
};

const CONTENT: Record<TabId, { label: string; subtitle: string; sections: Section[] }> = {
  terms: {
    label: "Terms of Service",
    subtitle:
      "Please read these terms carefully before using the Clarifyd platform.",
    sections: [
      {
        n: "01",
        title: "Definitions",
        body: [
          `"Platform" refers to the Clarifyd AI-driven legal analysis environment, including all subdomains, APIs, and associated software tools.`,
          `"User Content" encompasses all legal documents, contracts, clauses, and metadata uploaded to or processed through the platform.`,
          `"Reasoning Output" defines the AI-generated risk assessments, summaries, and linguistic interpretations provided by the Kimi reasoning engine.`,
        ],
      },
      {
        n: "02",
        title: "Services & Scope",
        body: [
          "Clarifyd provides a cloud-based service for high-speed contract review and risk identification, intended for founders augmenting their workflow with AI.",
        ],
        bullets: [
          "Automated clause identification and extraction.",
          "Multi-factor risk scoring against industry baselines.",
          "Kimi-powered loophole detection and counter-offer drafting.",
          "Citation-grounded findings — no hallucinated clauses.",
        ],
      },
      {
        n: "03",
        title: "Limitation of Liability",
        body: [
          "To the maximum extent permitted by applicable law, Clarifyd shall not be liable for any indirect, incidental, special, consequential, or punitive damages.",
        ],
        quote:
          "The platform is a decision-support tool. It does not replace the judgment of qualified legal counsel.",
      },
      {
        n: "04",
        title: "Intellectual Property",
        body: [
          "You retain all rights to the User Content uploaded. Clarifyd retains all rights to the platform and any performance improvements derived from anonymized aggregated metadata.",
        ],
      },
      {
        n: "05",
        title: "Data & Retention",
        body: [
          "Documents are processed in a zero-retention enclave. Source files are purged 365 days after upload unless explicitly retained. Audit hashes and tamper-evident records persist for compliance.",
        ],
      },
    ],
  },
  privacy: {
    label: "Privacy Policy",
    subtitle:
      "How Clarifyd handles, processes, and protects the contracts you trust us with.",
    sections: [
      {
        n: "01",
        title: "What we collect",
        body: [
          "Account: email, password hash (bcrypt-12), role, OAuth identity claims if you sign in with Google or Facebook.",
          "Contracts: only what you upload. We never scrape email or third-party stores.",
          "Telemetry: anonymous page-view + latency buckets so we can find slow surfaces.",
        ],
      },
      {
        n: "02",
        title: "How we use it",
        body: [
          "Contracts are sent to NVIDIA NIM for Kimi K2 reasoning, then cached by SHA-256 so a re-upload of the same contract is byte-identical and free.",
          "No customer contract content trains any model — ever.",
        ],
      },
      {
        n: "03",
        title: "Where it lives",
        body: [
          "Postgres on Neon (us-east), Vercel serverless runtime (iad1). TLS 1.3 in transit, AES-256 at rest. JWT auth with bcrypt-12 password hashing.",
        ],
      },
      {
        n: "04",
        title: "Your controls",
        body: [
          "Delete account anytime from Settings. We hard-delete user row + owned drafts within 24h. Audit log entries are anonymized — user_id zeroed, hash chain stays intact for compliance.",
        ],
      },
    ],
  },
  cookies: {
    label: "Cookies",
    subtitle: "What we store on your device and why.",
    sections: [
      {
        n: "01",
        title: "Essential cookies",
        body: [
          "Required for the platform to function — authentication, CSRF protection, session state. Cannot be disabled.",
        ],
      },
      {
        n: "02",
        title: "Analytics cookies",
        body: [
          "Anonymous usage signals that help us find slow surfaces. Aggregated only.",
        ],
        bullets: [
          "Page views, feature usage, latency buckets.",
          "Optional — disable any time from the cookie popup.",
        ],
      },
      {
        n: "03",
        title: "Marketing cookies",
        body: [
          "Optional personalization across Clarifyd surfaces. Off by default.",
        ],
        quote:
          "Essential cookies always on. Analytics + Marketing always your choice.",
      },
    ],
  },
};

const TABS: { id: TabId; label: string }[] = [
  { id: "terms", label: "Terms" },
  { id: "privacy", label: "Privacy" },
  { id: "cookies", label: "Cookies" },
];

export default function TermsPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center text-slate-400"
          style={{ background: "#020617" }}
        >
          Loading…
        </div>
      }
    >
      <TermsInner />
    </Suspense>
  );
}

function TermsInner() {
  const { token } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const params = useSearchParams();

  const initial = (params.get("tab") as TabId | null) ?? "terms";
  const [tab, setTab] = useState<TabId>(
    initial === "privacy" || initial === "cookies" ? initial : "terms",
  );
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const orig = document.body.style.background;
    document.body.style.background = "#020617";
    return () => {
      document.body.style.background = orig;
    };
  }, []);

  function selectTab(id: TabId) {
    setTab(id);
    const url = new URL(window.location.href);
    if (id === "terms") url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    window.history.replaceState({}, "", url.toString());
  }

  const data = CONTENT[tab];
  const next = params.get("next");
  const ctaHref = token ? next || "/dashboard" : "/login";

  function onAccept() {
    if (!accepted) {
      push("Tick the checkbox to confirm.", "info");
      return;
    }
    try {
      window.localStorage.setItem(
        "clarifyd.terms-accepted",
        JSON.stringify({ accepted_at: new Date().toISOString() }),
      );
    } catch {}
    push("Terms accepted", "success");
    setTimeout(() => router.push(ctaHref), 350);
  }

  return (
    <div
      className="min-h-screen text-slate-200 pb-32"
      style={{
        background:
          "radial-gradient(ellipse 90% 50% at 50% -10%, rgba(99,102,241,0.10) 0%, transparent 50%), #020617",
        fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-100 font-semibold tracking-tight cursor-pointer">
            <span
              className="inline-block h-5 w-5 rounded-[6px]"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
              aria-hidden
            />
            Clarifyd
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/pricing" className="text-slate-400 hover:text-slate-100 cursor-pointer">Pricing</Link>
            <Link href="/contact" className="text-slate-400 hover:text-slate-100 cursor-pointer">Contact</Link>
          </div>
        </div>
      </nav>

      <main className="pt-28">
        <header className="mx-auto max-w-3xl px-6 text-center">
          <div
            className="text-[10px] uppercase tracking-[0.18em] text-violet-400"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            ↳ legal
          </div>
          <h1 className="mt-3 text-4xl text-white font-semibold tracking-tight">
            {data.label}
          </h1>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto">{data.subtitle}</p>
        </header>

        <div className="mx-auto max-w-3xl px-6 mt-8 flex justify-center">
          <div className="inline-flex gap-1 rounded-full border border-white/10 bg-slate-900/60 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors duration-200 cursor-pointer ${
                  tab === t.id
                    ? "bg-white text-slate-950"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <article className="mx-auto max-w-3xl px-6 mt-10 space-y-4">
          {data.sections.map((s, i) => (
            <section
              key={i}
              className="rounded-xl border border-white/10 bg-slate-900/40 p-6"
            >
              <div className="flex items-baseline gap-3">
                <span
                  className="text-xs text-slate-500 tabular-nums"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {s.n}
                </span>
                <h2 className="text-lg text-white font-semibold tracking-tight">
                  {s.title}
                </h2>
              </div>
              <div className="mt-3 space-y-3">
                {s.body.map((p, j) => (
                  <p key={j} className="text-sm text-slate-300 leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
              {s.bullets ? (
                <ul className="mt-3 space-y-1.5">
                  {s.bullets.map((b, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2 text-sm text-slate-400"
                    >
                      <span className="text-indigo-400 mt-0.5">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {s.quote ? (
                <blockquote
                  className="mt-4 rounded-lg border-l-2 border-violet-500/50 bg-violet-950/20 pl-4 py-2 text-sm text-violet-200 italic"
                >
                  &ldquo;{s.quote}&rdquo;
                </blockquote>
              ) : null}
            </section>
          ))}
        </article>

        {tab === "terms" ? (
          <div className="mx-auto max-w-3xl px-6 mt-10">
            <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 to-slate-900/40 p-7">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 cursor-pointer accent-indigo-500"
                />
                <span className="text-sm text-slate-300">
                  I have read and accept the Clarifyd Terms of Service and Privacy Policy.
                  I understand the platform is a decision-support tool and does
                  not replace qualified legal counsel.
                </span>
              </label>
              <div className="mt-5 flex items-center justify-end gap-3">
                <Link
                  href="/"
                  className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  ← Cancel
                </Link>
                <button
                  type="button"
                  onClick={onAccept}
                  disabled={!accepted}
                  className="rounded-lg bg-white text-slate-950 px-5 py-2.5 text-sm font-semibold hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
                >
                  Accept & continue →
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <footer className="border-t border-white/5 bg-slate-950/90 mt-20">
        <div
          className="mx-auto max-w-6xl px-6 py-6 text-xs text-slate-500 flex flex-col md:flex-row justify-between gap-2"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          <span>© 2026 Clarifyd. Not legal advice.</span>
          <Link href="/" className="hover:text-slate-300 cursor-pointer">← landing</Link>
        </div>
      </footer>
    </div>
  );
}
