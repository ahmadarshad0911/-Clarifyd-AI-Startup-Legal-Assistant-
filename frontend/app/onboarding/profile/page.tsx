"use client";

/**
 * /onboarding/profile — Broadsheet · v6
 *
 * Pre-seed only (no other stages). Single locked stage card + audit rigor
 * + workspace particulars. Logic preserved.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Gavel, Check, Rocket,
  ShieldCheck, SealCheck, Cloud, Bank, FirstAid, Storefront, Cpu, Brain,
  Leaf, DotsThree, UsersThree, Gear, GraduationCap, User, Buildings,
  Globe, CaretDown, ArrowRight, ArrowLeft,
  type Icon,
} from "@phosphor-icons/react";

import { useAuth } from "../../../lib/auth";
import { useToast } from "../../../lib/toast";
import {
  getProfile, markOnboarded, setProfile, type FounderProfile,
} from "../../../lib/founder-profile";

type StepId = 1 | 2 | 3;
const EOQ = [0.23, 1, 0.32, 1] as const;
const ROMAN = ["I", "II", "III", "IV", "V"];

const SECTORS: { id: string; Icon: Icon }[] = [
  { id: "SaaS",        Icon: Cloud },
  { id: "Fintech",     Icon: Bank },
  { id: "Healthtech",  Icon: FirstAid },
  { id: "Marketplace", Icon: Storefront },
  { id: "Hardware",    Icon: Cpu },
  { id: "AI / ML",     Icon: Brain },
  { id: "Climate",     Icon: Leaf },
  { id: "Other",       Icon: DotsThree },
];

const JURISDICTIONS = [
  "United States", "United Kingdom", "European Union", "Canada",
  "Australia", "India", "Singapore", "Multi-jurisdiction",
];

const ROLES: { id: string; Icon: Icon }[] = [
  { id: "Founder / CEO", Icon: Rocket },
  { id: "Co-Founder",    Icon: UsersThree },
  { id: "Legal Lead",    Icon: Gavel },
  { id: "Operator",      Icon: Gear },
  { id: "Advisor",       Icon: GraduationCap },
];

function rigorLabel(v: number): string {
  if (v < 20) return "Permissive";
  if (v < 45) return "Lenient";
  if (v < 65) return "Standard";
  if (v < 85) return "Vigilant";
  return "Hyper-defensive";
}

export default function FounderProfilePage() {
  const router = useRouter();
  const { token, loading, me } = useAuth();
  const { push } = useToast();
  const reduceMotion = useReducedMotion() ?? false;

  const [step, setStep] = useState<StepId>(2);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [profile, setLocalProfile] = useState<FounderProfile>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !token) router.replace("/login");
  }, [loading, token, router]);

  useEffect(() => {
    const p = getProfile();
    if (me?.email && !p.email) p.email = me.email;
    // Pre-seed lock-in.
    if (!p.stage) p.stage = "pre_seed";
    setLocalProfile(p);
    const completed = Math.max(p.steps_completed ?? 1, 1);
    setStep(completed >= 2 ? 3 : 2);
    setLoaded(true);
  }, [me]);

  function update(patch: Partial<FounderProfile>) {
    const next = setProfile(patch);
    setLocalProfile(next);
  }

  function go(target: StepId) {
    setDirection(target > step ? 1 : -1);
    setStep(target);
  }

  function continueStep() {
    if (step === 2) {
      update({ stage: "pre_seed", steps_completed: Math.max(profile.steps_completed ?? 1, 2) });
      go(3);
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
    const completed = profile.steps_completed ?? 1;
    if (target === 1) return;
    if (target === 2) { go(2); return; }
    if (target === 3) {
      if (completed < 2) { go(2); return; }
      go(3);
    }
  }

  if (!loaded) return null;

  const completed = profile.steps_completed ?? 1;
  const stepDone = (id: StepId) => completed >= id;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bsd-paper)", color: "var(--bsd-body)", paddingBottom: 96 }}>
      {/* Masthead */}
      <header
        style={{
          borderBottom: "3px double var(--bsd-ink)",
          padding: "16px 32px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: "Geist, sans-serif", fontWeight: 800, fontSize: 22, color: "var(--bsd-ink)", letterSpacing: "-0.04em", lineHeight: 1 }}>
            Clarifyd
          </span>
          <span className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700 }}>
            Onboarding
          </span>
        </div>
        <button
          type="button"
          onClick={saveAndExit}
          className="cursor-pointer cf-mono"
          style={{
            background: "transparent", border: "none",
            color: "var(--bsd-muted)", fontSize: 10.5, letterSpacing: "0.18em",
            textTransform: "uppercase", fontWeight: 700,
            padding: 4, transition: "color 180ms ease-out",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bsd-red)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--bsd-muted)")}
        >
          Skip for now →
        </button>
      </header>

      {/* Dateline */}
      <div
        style={{
          borderBottom: "1px solid var(--bsd-hairline)",
          padding: "8px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "Geist Mono, monospace",
          fontSize: 9.5, color: "var(--bsd-muted)", letterSpacing: "0.18em",
          textTransform: "uppercase", fontWeight: 600,
        }}
      >
        <span>Chapter {ROMAN[step - 1]} · Of III</span>
        <span>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
      </div>

      <main
        style={{
          padding: "56px 32px 0",
          maxWidth: 1240, margin: "0 auto",
          display: "grid", gridTemplateColumns: "minmax(0, 4fr) minmax(0, 8fr)", gap: 64,
        }}
        className="grid-cols-1 lg:grid-cols-[4fr_8fr]"
      >
        {/* Left */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EOQ }}
          >
            <span className="bsd-kicker" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Rocket weight="duotone" size={14} aria-hidden />
              Chapter {ROMAN[step - 1]}
            </span>
            <h1 style={{ marginTop: 14, marginBottom: 0, fontSize: 46, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.02, color: "var(--bsd-ink)" }}>
              {step === 2 ? (
                <>On the matter of your <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>venture.</span></>
              ) : (
                <>And in <span style={{ color: "var(--bsd-red)", fontStyle: "italic", fontWeight: 600 }}>closing,</span> a few particulars.</>
              )}
            </h1>
            <p style={{ marginTop: 18, color: "var(--bsd-body)", fontSize: 15.5, lineHeight: 1.65, maxWidth: 360 }}>
              {step === 2
                ? "Clarifyd is built for pre-seed founders. We tune our reasoning to the clauses that bite first at the earliest stage."
                : "These particulars are committed to your device, not our ledger. They spare you from repeating yourself to the Co-Pilot in subsequent sittings."}
            </p>
          </motion.div>

          {/* Contents */}
          <div>
            <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, paddingBottom: 10, borderBottom: "1px solid var(--bsd-hairline)" }}>
              Contents
            </div>
            <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <TocItem n={1} title="Identity verified" subtitle={profile.email ?? me?.email ?? "Credentials secured."} state="done" onClick={() => gotoStep(1)} />
              <TocItem
                n={2}
                title="The venture"
                subtitle="Pre-seed · audit rigor"
                state={stepDone(2) ? "done" : step === 2 ? "active" : "locked"}
                onClick={() => gotoStep(2)}
              />
              <TocItem
                n={3}
                title="The particulars"
                subtitle={stepDone(3) ? "Complete." : step === 3 ? "Reading now…" : "Company, sector, jurisdiction"}
                state={stepDone(3) ? "done" : step === 3 ? "active" : "locked"}
                onClick={() => gotoStep(3)}
              />
            </ol>
          </div>

          <div style={{ paddingTop: 18, borderTop: "1px solid var(--bsd-hairline)" }}>
            <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
              Colophon
            </div>
            <p style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: 0, fontSize: 12.5, color: "var(--bsd-muted)", lineHeight: 1.65, fontStyle: "italic" }}>
              <ShieldCheck weight="duotone" size={15} color="var(--bsd-red)" style={{ marginTop: 3, flexShrink: 0 }} aria-hidden />
              Processed in a zero-retention enclave. No permanent log of clause selections.
            </p>
          </div>
        </aside>

        {/* Right */}
        <section style={{ minWidth: 0 }}>
          <div style={{ position: "relative", minHeight: 540 }}>
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={`step-${step}`}
                custom={direction}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 24 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -direction * 24 }}
                transition={{ duration: 0.28, ease: EOQ }}
                style={{ display: "flex", flexDirection: "column", gap: 40 }}
              >
                {step === 2 ? (
                  <VentureStep profile={profile} onChange={update} reduceMotion={reduceMotion} />
                ) : (
                  <WorkspaceStep profile={profile} onChange={update} reduceMotion={reduceMotion} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Folio footer */}
      <footer
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
          background: "var(--bsd-paper)",
          borderTop: "1.5px solid var(--bsd-ink)",
          padding: "12px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}
      >
        <p className="cf-mono" style={{ margin: 0, fontSize: 11, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600 }}>
          Folio · {String(step).padStart(2, "0")} of 03 ·{" "}
          <span style={{ color: "var(--bsd-ink)", fontWeight: 800 }}>
            {step === 2 ? "The venture" : "The particulars"}
          </span>
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          {step === 3 ? (
            <button type="button" onClick={() => go(2)} className="bsd-btn bsd-btn--ghost cursor-pointer">
              <ArrowLeft weight="bold" size={11} /> Back
            </button>
          ) : (
            <button type="button" onClick={saveAndExit} className="bsd-btn bsd-btn--ghost cursor-pointer">
              Save &amp; exit
            </button>
          )}
          <button type="button" onClick={continueStep} className="bsd-btn cursor-pointer">
            {step === 3 ? "Enter workspace" : "Continue"} <ArrowRight weight="bold" size={11} />
          </button>
        </div>
      </footer>
    </div>
  );
}

function TocItem({ n, title, subtitle, state, onClick }: { n: number; title: string; subtitle: string; state: "done" | "active" | "locked"; onClick: () => void }) {
  const disabled = state === "locked";
  const accent = state === "active" || state === "done";
  return (
    <li style={{ borderBottom: "1px solid var(--bsd-hairline)", opacity: disabled ? 0.45 : 1 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={disabled ? "" : "cursor-pointer"}
        style={{
          width: "100%", display: "flex", alignItems: "baseline", gap: 18, textAlign: "left",
          padding: "14px 0",
          background: "transparent", border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          color: state === "active" ? "var(--bsd-ink)" : "var(--bsd-body)",
        }}
      >
        <span
          className="cf-mono"
          style={{
            fontSize: 11, color: accent ? "var(--bsd-red)" : "var(--bsd-soft)",
            letterSpacing: "0.16em", fontWeight: 800,
            minWidth: 28,
            display: "inline-flex", alignItems: "center", gap: 4,
          }}
        >
          {state === "done" ? <Check weight="bold" size={11} color="var(--bsd-red)" /> : ROMAN[n - 1]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: state === "active" ? 700 : 500, color: "var(--bsd-ink)", letterSpacing: "-0.005em" }}>
            {title}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: state === "active" ? "var(--bsd-red)" : "var(--bsd-muted)", fontStyle: state === "active" ? "italic" : "normal", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitle}
          </p>
        </div>
        {state === "active" ? <ArrowRight weight="bold" size={14} color="var(--bsd-red)" aria-hidden /> : null}
      </button>
    </li>
  );
}

function VentureStep({
  profile, onChange, reduceMotion,
}: { profile: FounderProfile; onChange: (p: Partial<FounderProfile>) => void; reduceMotion: boolean }) {
  const rigor = typeof profile.audit_rigor === "number" ? profile.audit_rigor : 65;
  return (
    <>
      <SectionHeading kicker="Article I" title="Stage of the venture" />

      <div style={{ borderTop: "2px solid var(--bsd-ink)", borderBottom: "1px solid var(--bsd-hairline)", padding: "24px 16px 24px 0", background: "var(--bsd-paper-deep)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <span className="cf-mono" style={{ fontSize: 28, color: "var(--bsd-red)", fontWeight: 800, letterSpacing: "-0.02em", minWidth: 44, paddingLeft: 22 }}>
            01
          </span>
          <Rocket weight="duotone" size={22} color="var(--bsd-red)" style={{ flexShrink: 0 }} aria-hidden />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.01em" }}>
              Pre-Seed
            </div>
            <div style={{ marginTop: 4, fontSize: 13.5, color: "var(--bsd-body)", lineHeight: 1.55 }}>
              IP protection, co-founder vesting, advisor agreements. Clarifyd is purpose-built for this stage.
            </div>
          </div>
          <span
            className="cf-mono"
            style={{
              color: "var(--bsd-red)",
              fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <Check weight="bold" size={11} /> Selected
          </span>
        </div>
      </div>

      <p className="cf-mono" style={{ margin: "8px 0 0", fontSize: 10, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, fontStyle: "italic" }}>
        Seed and later stages on a separate waitlist. <a href="/contact" className="bsd-link" style={{ fontStyle: "normal", fontWeight: 700 }}>Tell us</a> if that&rsquo;s you.
      </p>

      <div>
        <SectionHeading kicker="Article II" title="Audit rigor" />
        <div style={{ borderTop: "2px solid var(--bsd-ink)", paddingTop: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--bsd-body)", fontStyle: "italic", maxWidth: 360, lineHeight: 1.5 }}>
              How aggressively our analyzer flags non-standard clauses.
            </p>
            <motion.span
              key={rigorLabel(rigor)}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: EOQ }}
              className="cf-mono"
              style={{ color: "var(--bsd-red)", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800 }}
            >
              {rigorLabel(rigor)} · {String(rigor).padStart(2, "0")}
            </motion.span>
          </div>
          <input
            type="range"
            min={0} max={100}
            value={rigor}
            onChange={(e) => onChange({ audit_rigor: Number(e.target.value) })}
            className="bsd-range"
            aria-label="Audit rigor"
            style={{ ["--bsd-range-fill" as unknown as string]: `${rigor}%` }}
          />
          <div className="cf-mono" style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 10, color: "var(--bsd-muted)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
            <span>0 · Permissive</span>
            <span>100 · Hyper-defensive</span>
          </div>
        </div>
      </div>
    </>
  );
}

function WorkspaceStep({
  profile, onChange, reduceMotion,
}: { profile: FounderProfile; onChange: (p: Partial<FounderProfile>) => void; reduceMotion: boolean }) {
  const filled = [profile.full_name, profile.company_name, profile.sector, profile.jurisdiction, profile.role].filter(Boolean).length;
  const total = 5;
  return (
    <>
      <SectionHeading
        kicker="Article III"
        title="The particulars"
        meta={
          <span className="cf-mono" style={{ color: "var(--bsd-red)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800 }}>
            {filled} / {total} entered
          </span>
        }
      />

      <div style={{ borderTop: "2px solid var(--bsd-ink)", paddingTop: 28, display: "flex", flexDirection: "column", gap: 36 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36 }} className="grid-cols-1 sm:grid-cols-2">
          <InkField id="full_name" label="Full name" Icon={User} value={profile.full_name ?? ""} onChange={(v) => onChange({ full_name: v })} placeholder="Alex Founder" delay={0.0} reduceMotion={reduceMotion} />
          <InkField id="company_name" label="Company" Icon={Buildings} value={profile.company_name ?? ""} onChange={(v) => onChange({ company_name: v })} placeholder="The startup" delay={0.06} reduceMotion={reduceMotion} />
        </div>

        <div>
          <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid var(--bsd-hairline)" }}>
            Sector
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 36px" }} className="grid-cols-1 sm:grid-cols-2">
            {SECTORS.map((s, i) => {
              const selected = profile.sector === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChange({ sector: s.id })}
                  className={`cursor-pointer${selected ? " is-active" : ""}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, textAlign: "left",
                    background: "transparent", border: "none",
                    padding: "12px 0",
                    borderBottom: "1px dotted var(--bsd-hairline)",
                    color: "var(--bsd-ink)",
                    transition: "color var(--dur-base) ease",
                  }}
                >
                  <span className="cf-mono" style={{ fontSize: 11, color: selected ? "var(--bsd-red)" : "var(--bsd-soft)", letterSpacing: "0.16em", fontWeight: 800, minWidth: 22 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <s.Icon weight={selected ? "duotone" : "regular"} size={16} color={selected ? "var(--bsd-red)" : "var(--bsd-muted)"} aria-hidden />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: selected ? 700 : 500 }}>{s.id}</span>
                  <span style={{ width: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--bsd-red)", fontWeight: 800 }}>
                    {selected ? <Check weight="bold" size={12} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--bsd-hairline)" }}>
            Primary jurisdiction
          </div>
          <div style={{ position: "relative", maxWidth: 460 }}>
            <Globe weight="duotone" size={16} color="var(--bsd-red)" style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} aria-hidden />
            <select
              id="jurisdiction"
              value={profile.jurisdiction ?? ""}
              onChange={(e) => onChange({ jurisdiction: e.target.value })}
              className="bsd-input"
              style={{ appearance: "none", paddingLeft: 26, paddingRight: 28, cursor: "pointer", fontSize: 15 }}
            >
              <option value="">Select…</option>
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
            <CaretDown weight="bold" size={12} color="var(--bsd-muted)" style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} aria-hidden />
          </div>
        </div>

        <div>
          <div className="cf-mono" style={{ color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid var(--bsd-hairline)" }}>
            Your role
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ROLES.map((r) => {
              const selected = r.id === profile.role;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onChange({ role: r.id })}
                  className={`bsd-chip cursor-pointer${selected ? " is-active" : ""}`}
                  style={{ fontSize: 13 }}
                >
                  <r.Icon weight={selected ? "duotone" : "regular"} size={14} color={selected ? "var(--bsd-paper)" : "var(--bsd-red)"} aria-hidden />
                  {r.id}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function SectionHeading({ kicker, title, meta }: { kicker: string; title: string; meta?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
      <div>
        <span className="bsd-kicker">{kicker}</span>
        <h2 style={{ margin: "8px 0 14px", fontSize: 28, fontWeight: 700, color: "var(--bsd-ink)", letterSpacing: "-0.022em", lineHeight: 1.05 }}>
          {title}
        </h2>
      </div>
      {meta}
    </div>
  );
}

function InkField({
  id, label, Icon, value, onChange, placeholder, delay, reduceMotion,
}: {
  id: string; label: string; Icon: Icon; value: string;
  onChange: (v: string) => void; placeholder?: string; delay: number; reduceMotion: boolean;
}) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EOQ, delay }}
    >
      <label htmlFor={id} className="cf-mono" style={{ display: "block", color: "var(--bsd-muted)", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <Icon weight="duotone" size={16} color="var(--bsd-red)" style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} aria-hidden />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bsd-input"
          style={{ paddingLeft: 26 }}
        />
      </div>
    </motion.div>
  );
}
