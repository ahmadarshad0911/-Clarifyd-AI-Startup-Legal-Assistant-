"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuroraBackground } from "../../../components/common/aurora-background";
import { useAuth } from "../../../lib/auth";
import { useToast } from "../../../lib/toast";
import {
  getProfile,
  markOnboarded,
  setProfile,
  type FounderProfile,
} from "../../../lib/founder-profile";

type StepId = 1 | 2 | 3;

type Stage = {
  id: string;
  level: string;
  icon: string;
  title: string;
  blurb: string;
};

const STAGES: Stage[] = [
  {
    id: "pre_seed",
    level: "Lvl 01",
    icon: "rocket_launch",
    title: "Pre-Seed / Stealth",
    blurb: "Focused on IP protection, co-founder vesting, and advisor agreements.",
  },
  {
    id: "seed",
    level: "Lvl 02",
    icon: "grass",
    title: "Seed Stage",
    blurb: "Managing angel investment, early-hire ESOPs, and pilot customer MSAs.",
  },
  {
    id: "series_a",
    level: "Lvl 03",
    icon: "trending_up",
    title: "Series A+",
    blurb: "High-volume hiring, institutional VC compliance, and scaling operations.",
  },
  {
    id: "enterprise",
    level: "Lvl 04",
    icon: "domain",
    title: "Enterprise / M&A",
    blurb: "Due diligence preparation, complex procurement, and exit readiness.",
  },
];

const SECTORS: { id: string; icon: string }[] = [
  { id: "SaaS", icon: "cloud" },
  { id: "Fintech", icon: "account_balance" },
  { id: "Healthtech", icon: "health_and_safety" },
  { id: "Marketplace", icon: "storefront" },
  { id: "Hardware", icon: "memory" },
  { id: "AI / ML", icon: "psychology" },
  { id: "Climate", icon: "eco" },
  { id: "Other", icon: "more_horiz" },
];

const JURISDICTIONS = [
  "United States",
  "United Kingdom",
  "European Union",
  "Canada",
  "Australia",
  "India",
  "Singapore",
  "Multi-jurisdiction",
];

const ROLES: { id: string; icon: string }[] = [
  { id: "Founder / CEO", icon: "rocket_launch" },
  { id: "Co-Founder", icon: "groups" },
  { id: "Legal Lead", icon: "gavel" },
  { id: "Operator", icon: "settings_suggest" },
  { id: "Advisor", icon: "school" },
];

function rigorLabel(v: number): string {
  if (v < 34) return "Permissive";
  if (v < 67) return "Standard Founder";
  return "Hyper-Defensive";
}

export default function FounderProfilePage() {
  const router = useRouter();
  const { token, loading, me } = useAuth();
  const { push } = useToast();

  const [step, setStep] = useState<StepId>(2);
  const [profile, setLocalProfile] = useState<FounderProfile>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !token) router.replace("/login");
  }, [loading, token, router]);

  // Hydrate from localStorage + auth.
  useEffect(() => {
    const p = getProfile();
    if (me?.email && !p.email) p.email = me.email;
    setLocalProfile(p);
    // Identity always done after register.
    const completed = Math.max(p.steps_completed ?? 1, 1);
    if (completed >= 3) setStep(3);
    else if (completed >= 2) setStep(3);
    else setStep(2);
    setLoaded(true);
  }, [me]);

  function update(patch: Partial<FounderProfile>) {
    const next = setProfile(patch);
    setLocalProfile(next);
  }

  function highest(a: number, b: number) {
    return Math.max(a, b);
  }

  function continueStep() {
    if (step === 2) {
      if (!profile.stage) {
        push("Pick your startup stage first.", "info");
        return;
      }
      update({ steps_completed: highest(profile.steps_completed ?? 1, 2) });
      setStep(3);
      return;
    }
    if (step === 3) {
      update({ steps_completed: 3 });
      markOnboarded();
      push("Founder profile saved", "success", "Clarifyd is tuned to your stage.");
      router.push("/dashboard");
    }
  }

  function saveAndExit() {
    update({});
    markOnboarded();
    push("Profile saved", "success");
    router.push("/dashboard");
  }

  function gotoStep(target: StepId) {
    // Step 1 always considered done. Step 2/3 only unlock when previous done.
    const completed = profile.steps_completed ?? 1;
    if (target === 1) return; // identity is informational, no panel
    if (target === 2) {
      setStep(2);
      return;
    }
    if (target === 3) {
      if (completed < 2 && !profile.stage) {
        push("Finish the Venture profile first.", "info");
        return;
      }
      setStep(3);
    }
  }

  if (!loaded) return null;

  const completed = profile.steps_completed ?? 1;
  const stepDone = (id: StepId) => completed >= id;

  return (
    <div className="min-h-screen text-on-surface font-body-lg pb-28">
      <AuroraBackground />

      <header className="crystal-nav fixed top-0 left-0 w-full h-16 z-50 flex justify-between items-center px-margin-mobile md:px-margin-desktop">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-h2">gavel</span>
          <h1 className="font-display-hero text-h2 text-onboarding-navy m-0">Clarifyd</h1>
        </div>
        <button
          type="button"
          onClick={saveAndExit}
          className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors"
        >
          Skip for now
        </button>
      </header>

      <div
        className="fixed top-16 left-0 w-full z-40 bg-[#78350f]/85 backdrop-blur-md px-4 py-2 flex justify-center items-center gap-2"
        role="note"
      >
        <span className="material-symbols-outlined text-white text-[16px]">warning</span>
        <p className="text-white text-[11px] font-bold tracking-wide m-0">
          AI-ASSISTED REVIEW: CLARIFYD IS NOT A LAW FIRM AND DOES NOT PROVIDE LEGAL ADVICE.
        </p>
      </div>

      <main className="pt-32 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Left rail */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            <div>
              <span className="font-label-caps text-label-caps text-primary tracking-[0.2em] uppercase mb-3 block">
                Step {String(step).padStart(2, "0")} / 03
              </span>
              <h2 className="font-display-hero text-h1 leading-tight text-onboarding-navy mb-4">
                {step === 2
                  ? "Define your venture's trajectory."
                  : "Tune your workspace."}
              </h2>
              <p className="text-on-surface-variant max-w-md leading-relaxed">
                {step === 2
                  ? "Clarifyd tailors its Kimi reasoning engine to your startup's lifecycle, so contract audits reflect the risks most relevant to your scale."
                  : "A few extra details — company, sector, jurisdiction — so Kimi doesn't have to re-ask every time."}
              </p>
            </div>

            {/* Step pipeline */}
            <div className="flex flex-col gap-3">
              <StepRow
                n={1}
                title="Identity verified"
                subtitle={profile.email ?? me?.email ?? "Founder credentials secured."}
                state="done"
                onClick={() => gotoStep(1)}
              />
              <StepRow
                n={2}
                title="Venture profile"
                subtitle={
                  profile.stage
                    ? `Stage · ${profile.stage.replace(/_/g, " ")}`
                    : step === 2
                    ? "Currently configuring…"
                    : "Pick stage + audit rigor"
                }
                state={stepDone(2) ? "done" : step === 2 ? "active" : "locked"}
                onClick={() => gotoStep(2)}
              />
              <StepRow
                n={3}
                title="Workspace ready"
                subtitle={
                  stepDone(3)
                    ? "Profile complete."
                    : step === 3
                    ? "Currently configuring…"
                    : "Company, sector, jurisdiction"
                }
                state={stepDone(3) ? "done" : step === 3 ? "active" : "locked"}
                onClick={() => gotoStep(3)}
              />
            </div>

            <div className="crystal-glass p-6 rounded-3xl border-l-4 border-onboarding-gold/60">
              <div className="flex items-center gap-2 text-onboarding-gold mb-3">
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  shield
                </span>
                <span className="font-label-caps text-label-caps uppercase">
                  Clarifyd Privacy Shield
                </span>
              </div>
              <p className="text-body-sm text-on-surface-variant leading-relaxed m-0">
                Your venture data is processed within a zero-retention enclave. Clarifyd does not
                keep permanent logs of your specific clause selections.
              </p>
            </div>
          </div>

          {/* Right panel — content swaps per step */}
          <div className="lg:col-span-7" key={`step-${step}`}>
            <div className="tab-content space-y-6">
              {step === 2 ? (
                <VentureStep
                  profile={profile}
                  onChange={update}
                />
              ) : (
                <WorkspaceStep
                  profile={profile}
                  onChange={update}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="crystal-nav fixed bottom-0 left-0 w-full z-50 px-margin-mobile md:px-margin-desktop py-3 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-body-sm text-on-surface-variant m-0">
          Step {step} of 3 ·{" "}
          <span className="text-onboarding-navy font-bold">
            {step === 2 ? "Venture profile" : "Workspace ready"}
          </span>
        </p>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {step === 3 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="btn-capsule glass-semi-clear text-onboarding-navy text-sm flex-1 md:flex-none px-6"
            >
              ← Back
            </button>
          ) : (
            <button
              type="button"
              onClick={saveAndExit}
              className="btn-capsule glass-semi-clear text-onboarding-navy text-sm flex-1 md:flex-none px-6"
            >
              Save &amp; exit
            </button>
          )}
          <button
            type="button"
            onClick={continueStep}
            className="btn-capsule btn-capsule-primary text-sm flex-1 md:flex-none px-7"
          >
            {step === 3 ? "Enter workspace" : "Continue"}
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

function StepRow({
  n,
  title,
  subtitle,
  state,
  onClick,
}: {
  n: number;
  title: string;
  subtitle: string;
  state: "done" | "active" | "locked";
  onClick: () => void;
}) {
  const disabled = state === "locked";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-4 text-left rounded-2xl p-3 transition-all ${
        state === "active"
          ? "bg-white/60 ring-2 ring-primary/30"
          : state === "done"
          ? "hover:bg-white/40 cursor-pointer"
          : "opacity-60 cursor-not-allowed"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 relative ${
          state === "done"
            ? "bg-status-success text-white"
            : state === "active"
            ? "border-2 border-primary text-primary"
            : "border-2 border-outline text-outline"
        }`}
      >
        {state === "active" ? (
          <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
        ) : null}
        {state === "done" ? (
          <span className="material-symbols-outlined">check</span>
        ) : (
          <span className="font-label-caps text-label-caps">
            {String(n).padStart(2, "0")}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="font-h3 text-h3 text-onboarding-navy m-0">{title}</p>
        <p
          className={`text-body-sm m-0 truncate ${
            state === "active" ? "text-primary font-bold" : "text-on-surface-variant"
          }`}
        >
          {subtitle}
        </p>
      </div>
    </button>
  );
}

function VentureStep({
  profile,
  onChange,
}: {
  profile: FounderProfile;
  onChange: (p: Partial<FounderProfile>) => void;
}) {
  const rigor = typeof profile.audit_rigor === "number" ? profile.audit_rigor : 65;
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {STAGES.map((s) => {
          const selected = s.id === profile.stage;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange({ stage: s.id })}
              className={`crystal-glass group p-6 rounded-3xl text-left transition-all duration-300 flex flex-col justify-between h-[220px] ${
                selected ? "ring-2 ring-primary ring-offset-2" : "hover:-translate-y-1"
              }`}
            >
              <div className="flex justify-between items-start">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                    selected
                      ? "bg-gradient-to-br from-primary to-accent-violet text-white shadow-lg"
                      : "bg-black/5 text-on-surface group-hover:bg-primary/10 group-hover:text-primary"
                  }`}
                >
                  <span
                    className="material-symbols-outlined"
                    style={selected ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {s.icon}
                  </span>
                </div>
                {selected ? (
                  <span className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full">
                    <span
                      className="material-symbols-outlined text-primary text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span className="font-label-caps text-[10px] text-primary font-bold uppercase tracking-wider">
                      Active
                    </span>
                  </span>
                ) : (
                  <span className="font-label-caps text-label-caps text-on-surface-variant opacity-40">
                    {s.level}
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-h2 text-h2 text-onboarding-navy mb-1">{s.title}</h3>
                <p className="text-body-sm text-on-surface-variant">{s.blurb}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="crystal-glass rounded-3xl p-6">
        <div className="flex justify-between items-start gap-4 mb-5">
          <div>
            <h4 className="font-h3 text-h3 text-onboarding-navy m-0">Audit rigor</h4>
            <p className="text-body-sm text-on-surface-variant m-0">
              How aggressively Kimi flags non-standard clauses.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10 shrink-0">
            <span className="material-symbols-outlined text-onboarding-gold text-[16px]">
              verified
            </span>
            <span className="text-on-surface font-bold text-[10px] uppercase tracking-wider">
              Expert recommended
            </span>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={rigor}
          onChange={(e) => onChange({ audit_rigor: Number(e.target.value) })}
          className="w-full accent-primary cursor-pointer"
          aria-label="Audit rigor"
        />
        <div className="flex justify-between font-label-caps text-label-caps text-on-surface-variant mt-2">
          <span>Permissive</span>
          <span className="text-primary font-bold">{rigorLabel(rigor)}</span>
          <span>Hyper-Defensive</span>
        </div>
      </div>
    </>
  );
}

function WorkspaceStep({
  profile,
  onChange,
}: {
  profile: FounderProfile;
  onChange: (p: Partial<FounderProfile>) => void;
}) {
  const filled = [
    profile.full_name,
    profile.company_name,
    profile.sector,
    profile.jurisdiction,
    profile.role,
  ].filter(Boolean).length;
  const total = 5;
  const progress = Math.round((filled / total) * 100);

  return (
    <div className="crystal-glass rounded-3xl p-6 md:p-8 flex flex-col gap-8">
      {/* Header */}
      <div>
        <div className="flex items-end justify-between gap-3 mb-2">
          <h3 className="font-display-hero text-h2 text-onboarding-navy m-0 leading-tight">
            Workspace details
          </h3>
          <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary whitespace-nowrap">
            {filled}/{total}
          </span>
        </div>
        <p className="text-body-sm text-on-surface-variant m-0 mb-4">
          Stored locally so Clarifyd Assistant and the Negotiation Lab don&rsquo;t have to re-ask.
        </p>
        <div className="h-1 w-full bg-white/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary/80 rounded-full"
            style={{
              width: `${progress}%`,
              transition: "width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          />
        </div>
      </div>

      {/* Name + Company */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextField
          id="full_name"
          label="Full name"
          icon="person"
          placeholder="Alex Founder"
          value={profile.full_name ?? ""}
          onChange={(v) => onChange({ full_name: v })}
        />
        <TextField
          id="company_name"
          label="Company"
          icon="apartment"
          placeholder="Clarifyd-using startup"
          value={profile.company_name ?? ""}
          onChange={(v) => onChange({ company_name: v })}
        />
      </div>

      {/* Sector — calm glass chip grid (matches stage cards aesthetic) */}
      <div>
        <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-3">
          Sector
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SECTORS.map((s) => {
            const selected = profile.sector === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onChange({ sector: s.id })}
                className={`group relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/40 border transition-all duration-300 cursor-pointer ${
                  selected
                    ? "border-primary ring-2 ring-primary/20 bg-white/70"
                    : "border-white/60 hover:bg-white/60 hover:-translate-y-0.5"
                }`}
                style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
              >
                <span
                  className={`material-symbols-outlined text-[22px] transition-colors ${
                    selected ? "text-primary" : "text-on-surface-variant group-hover:text-primary"
                  }`}
                  style={selected ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {s.icon}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    selected ? "text-onboarding-navy" : "text-on-surface-variant"
                  }`}
                >
                  {s.id}
                </span>
                {selected ? (
                  <span
                    className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center text-white"
                    aria-hidden
                  >
                    <span className="material-symbols-outlined text-[10px]">check</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Jurisdiction */}
      <div>
        <label htmlFor="jurisdiction" className="block">
          <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-2">
            Primary jurisdiction
          </span>
          <div className={`glass-field ${profile.jurisdiction ? "is-filled" : ""}`}>
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-primary pointer-events-none">
              public
            </span>
            <select
              id="jurisdiction"
              value={profile.jurisdiction ?? ""}
              onChange={(e) => onChange({ jurisdiction: e.target.value })}
              className="w-full appearance-none pl-11 pr-10 py-3 text-body-sm font-medium text-on-surface cursor-pointer"
            >
              <option value="">Select jurisdiction…</option>
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-on-surface-variant pointer-events-none">
              expand_more
            </span>
          </div>
        </label>
      </div>

      {/* Role */}
      <div>
        <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant block mb-3">
          Your role
        </span>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => {
            const selected = r.id === profile.role;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onChange({ role: r.id })}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-body-sm font-medium cursor-pointer border transition-all duration-300 ${
                  selected
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white/50 border-white/60 text-on-surface hover:bg-white/75"
                }`}
                style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
              >
                <span
                  className={`material-symbols-outlined text-[16px] ${
                    selected ? "text-white" : "text-primary"
                  }`}
                  style={selected ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {r.icon}
                </span>
                {r.id}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  icon,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  icon: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const filled = value.length > 0;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant"
      >
        {label}
      </label>
      <div className={`glass-field ${filled ? "is-filled" : ""}`}>
        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-primary pointer-events-none">
          {icon}
        </span>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-11 pr-4 py-3 text-body-sm font-medium text-on-surface placeholder:text-on-surface-variant/60"
        />
      </div>
    </div>
  );
}
