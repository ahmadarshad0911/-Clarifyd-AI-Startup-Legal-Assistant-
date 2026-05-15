"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";

import { AuroraBackground } from "../../components/common/aurora-background";
import { ScrollReveal } from "../../components/common/scroll-reveal";
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
    subtitle: "Please read these terms carefully before using the Clarifyd intelligence platform.",
    sections: [
      {
        n: "01.",
        title: "Definitions",
        body: [
          `"Platform" refers to the Clarifyd AI-driven legal analysis environment, including all subdomains, APIs, and associated software tools provided by Clarifyd Inc.`,
          `"User Content" encompasses all legal documents, contracts, clauses, and metadata uploaded to or processed through the platform by the registered account holder.`,
          `"Reasoning Output" defines the AI-generated risk assessments, summaries, and linguistic interpretations provided by the Kimi reasoning engine.`,
        ],
      },
      {
        n: "02.",
        title: "Services & Scope",
        body: [
          "Clarifyd provides a cloud-based software service for high-speed document review and risk identification, intended for founders and legal professionals augmenting their workflow.",
        ],
        bullets: [
          "Automated clause identification and extraction.",
          "Multi-factor risk scoring against industry baselines.",
          "Semantic comparison against historical document vaults.",
          "Kimi-powered loophole detection and counter-offer drafting.",
        ],
      },
      {
        n: "03.",
        title: "Limitation of Liability",
        body: [
          "To the maximum extent permitted by applicable law, Clarifyd shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly.",
        ],
        quote:
          "The platform acts as a decision-support tool and does not replace the nuanced judgment of qualified legal counsel.",
      },
      {
        n: "04.",
        title: "Intellectual Property",
        body: [
          "The user retains all rights to the User Content uploaded. Clarifyd retains all rights, title, and interest in the platform, the underlying AI orchestration, and any performance improvements derived from anonymized, aggregated metadata.",
        ],
      },
      {
        n: "05.",
        title: "Data & Retention",
        body: [
          "Documents are processed in a zero-retention enclave. Source files are purged 365 days after upload unless explicitly retained by the account holder. Audit hashes and tamper-evident records persist for compliance.",
        ],
      },
    ],
  },
  privacy: {
    label: "Privacy Policy",
    subtitle: "How Clarifyd handles, processes, and protects the contracts you trust us with.",
    sections: [
      {
        n: "01.",
        title: "What we collect",
        body: [
          "Account data — email, role, and authentication state — used solely to operate the platform.",
          "Documents you upload, the extracted text, clause findings, and Kimi reasoning output produced from them.",
          "Operational telemetry — request IDs, latency, error codes — for reliability and incident response.",
        ],
      },
      {
        n: "02.",
        title: "How Kimi processes your data",
        body: [
          "Document text is sent over TLS to the configured reasoning provider for clause-level analysis. We do not retain raw documents inside the reasoning provider beyond the request lifecycle.",
          "Per-clause results are cached locally under a SHA-256 hash key so re-analyses are deterministic and avoid repeat spend.",
        ],
        bullets: [
          "TLS in transit, AES-256 at rest.",
          "No training of third-party models on your documents.",
          "Anonymized aggregates only for internal model evaluation.",
        ],
      },
      {
        n: "03.",
        title: "Your rights",
        body: [
          "You can request export or deletion of your account data at any time. Tamper-evident audit chain entries remain for legal compliance even after deletion.",
        ],
        quote:
          "Privacy is the default. You are the owner of your contracts and your reasoning history.",
      },
      {
        n: "04.",
        title: "Subprocessors",
        body: [
          "We use a minimum set of subprocessors strictly required to deliver the service — reasoning provider (Kimi / Moonshot), storage, email delivery. The current list is published in the Trust Center on request.",
        ],
      },
    ],
  },
  cookies: {
    label: "Cookie Policy",
    subtitle: "What we store on your device and why — broken down by category.",
    sections: [
      {
        n: "01.",
        title: "Essential cookies",
        body: [
          "Required for the platform to function — authentication, CSRF protection, session state, role-based routing. Cannot be disabled because they keep your workspace secure.",
        ],
      },
      {
        n: "02.",
        title: "Analytics cookies",
        body: [
          "Anonymous usage signals that help us refine the Kimi reasoning engine and identify slow surfaces. Aggregated only — never tied to a specific contract or clause.",
        ],
        bullets: [
          "Page views, feature usage, latency buckets.",
          "Optional — disable any time from the cookie popup.",
        ],
      },
      {
        n: "03.",
        title: "Marketing cookies",
        body: [
          "Optional personalization across Clarifyd surfaces and lifecycle communications. Off by default — opt in from the cookie popup if you want them.",
        ],
      },
      {
        n: "04.",
        title: "Managing your choices",
        body: [
          "Open the cookie popup at any time from the footer to update your preferences. Your decision is stored on your device and applies across this browser only.",
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
  // useSearchParams() requires a Suspense boundary in Next 14 App Router.
  return (
    <Suspense fallback={<div className="min-h-screen"><AuroraBackground /></div>}>
      <TermsPageInner />
    </Suspense>
  );
}

function TermsPageInner() {
  const { token } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const params = useSearchParams();

  const initial = (params.get("tab") as TabId | null) ?? "terms";
  const [tab, setTab] = useState<TabId>(
    initial === "privacy" || initial === "cookies" ? initial : "terms"
  );
  const [accepted, setAccepted] = useState(false);

  // Animated pill thumb
  const tabsRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const wrap = tabsRef.current;
    if (!wrap) return;
    const btn = wrap.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`);
    if (btn) {
      const w = wrap.getBoundingClientRect();
      const r = btn.getBoundingClientRect();
      setThumb({ left: r.left - w.left, width: r.width });
    }
  }, [tab]);

  useEffect(() => {
    const onResize = () => {
      const wrap = tabsRef.current;
      if (!wrap) return;
      const btn = wrap.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`);
      if (btn) {
        const w = wrap.getBoundingClientRect();
        const r = btn.getBoundingClientRect();
        setThumb({ left: r.left - w.left, width: r.width });
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [tab]);

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
        JSON.stringify({ accepted_at: new Date().toISOString() })
      );
    } catch {
      // ignore
    }
    push("Terms accepted", "success");
    setTimeout(() => router.push(ctaHref), 350);
  }

  return (
    <div className="text-on-surface font-body-lg overflow-x-hidden min-h-screen pb-32">
      <AuroraBackground />

      <header className="fixed top-0 left-0 w-full z-[100] px-4 md:px-8 py-4 flex justify-between items-center gap-4 glass-frosted">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span className="material-symbols-outlined text-primary text-3xl">gavel</span>
          <span className="font-display-hero text-2xl font-bold text-onboarding-navy tracking-tight">
            Clarifyd
          </span>
        </Link>
        <nav className="hidden md:flex gap-8 text-[11px] font-label-caps font-bold tracking-[0.2em] uppercase text-on-surface-variant">
          <Link className="hover:text-primary transition-colors" href="/#solutions">Solutions</Link>
          <Link className="hover:text-primary transition-colors" href="/pricing">Pricing</Link>
          <span className="text-primary">Legal</span>
        </nav>
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-status-success/10 text-status-success rounded-full border border-status-success/20">
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            shield
          </span>
          <span className="font-label-caps text-label-caps uppercase">Privacy Shield</span>
        </div>
      </header>

      <main className="relative z-10 pt-32 px-4 md:px-8 max-w-4xl mx-auto">
        {/* Hero */}
        <ScrollReveal as="section" variant="scale" className="text-center mb-12">
          <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest bg-white/40 px-3 py-1 rounded-full border border-white/60">
            Last updated · 15 May 2026
          </span>
          <h1 className="mt-8 font-display-hero text-5xl md:text-7xl text-onboarding-navy leading-none tab-content" key={`title-${tab}`}>
            {data.label}
          </h1>
          <p
            className="mt-6 font-label-caps text-label-caps uppercase tracking-widest text-primary max-w-lg mx-auto tab-content"
            key={`sub-${tab}`}
          >
            {data.subtitle}
          </p>
        </ScrollReveal>

        {/* Pill nav with animated thumb */}
        <div className="flex justify-center mb-12">
          <div
            ref={tabsRef}
            className="relative inline-flex p-1 bg-white/40 backdrop-blur-md rounded-full border border-white/60"
            role="tablist"
            aria-label="Legal sections"
          >
            <span
              className="tab-pill-thumb absolute top-1 bottom-1 bg-white shadow-sm rounded-full"
              style={{ left: thumb.left, width: thumb.width }}
              aria-hidden
            />
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-tab={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTab(t.id)}
                  className={`relative z-10 px-5 sm:px-6 py-2 rounded-full font-label-caps text-label-caps uppercase transition-colors ${
                    active ? "text-onboarding-navy" : "text-on-surface-variant hover:text-primary"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="crystal-glass rounded-3xl p-6 md:p-12 space-y-12 md:space-y-16 tab-content" key={`body-${tab}`}>
          {data.sections.map((s) => (
            <section key={s.n} className="space-y-5">
              <div className="flex items-baseline gap-4">
                <span className="font-display-hero text-h2 md:text-3xl text-primary">{s.n}</span>
                <h2 className="font-display-hero text-h2 md:text-3xl text-onboarding-navy m-0">
                  {s.title}
                </h2>
              </div>
              <div className="pl-0 md:pl-12 space-y-4 text-on-surface-variant leading-relaxed">
                {s.body.map((p, i) => (
                  <p key={i} className="m-0">
                    {p}
                  </p>
                ))}
                {s.bullets ? (
                  <ul className="list-disc pl-5 space-y-2 m-0">
                    {s.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
                {s.quote ? (
                  <div className="p-5 md:p-6 bg-primary/5 border-l-4 border-primary rounded-r-xl italic font-display-hero text-onboarding-navy">
                    &ldquo;{s.quote}&rdquo;
                  </div>
                ) : null}
              </div>
            </section>
          ))}

          <div
            className="sticky bottom-4 z-20 bg-[#B45309]/90 backdrop-blur-lg text-white p-5 rounded-2xl flex items-start gap-4 shadow-xl border border-white/20"
            role="note"
          >
            <span className="material-symbols-outlined text-[28px] shrink-0">warning</span>
            <div>
              <p className="font-label-caps text-label-caps font-bold uppercase tracking-widest m-0">
                Not legal advice
              </p>
              <p className="text-body-sm opacity-90 m-0">
                Clarifyd is an AI tool. All outputs should be reviewed by a licensed attorney. No
                attorney-client relationship is formed through platform use.
              </p>
            </div>
          </div>
        </div>

        {/* Action */}
        <ScrollReveal className="mt-12 flex flex-col items-center gap-6">
          <label className="flex items-center gap-3 text-on-surface cursor-pointer select-none">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="w-5 h-5 rounded border border-outline accent-primary"
            />
            <span className="text-body-sm">
              I have read and agree to the Terms, Privacy Policy, and Cookie Policy.
            </span>
          </label>
          <button
            type="button"
            onClick={onAccept}
            disabled={!accepted}
            className="btn-capsule btn-capsule-primary text-lg px-12"
          >
            Accept &amp; continue
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
        </ScrollReveal>
      </main>

      <footer className="glass-frosted py-8 px-4 md:px-8 border-t border-white/20 mt-20" role="note">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-4 text-[11px] text-on-surface-variant/90 text-center md:text-left">
          <span className="font-label-caps font-bold uppercase tracking-widest text-onboarding-navy whitespace-nowrap">
            Legal disclaimer:
          </span>
          <p className="m-0">
            Clarifyd is an AI-powered contract analysis tool, not a law firm. Findings do not
            constitute legal advice. Always consult qualified legal counsel.
          </p>
        </div>
      </footer>
    </div>
  );
}
