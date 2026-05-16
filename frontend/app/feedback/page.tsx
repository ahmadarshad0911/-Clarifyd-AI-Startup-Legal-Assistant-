"use client";

/**
 * Feedback — single-card flow with a mood selector, category chips, message
 * field, optional NPS slider, and a contact email. Crystal-glass on aurora,
 * bubbly easing, and a particle burst on submit. Stored to localStorage for
 * now (`clarifyd.feedback`); ship a real backend route later.
 *
 * Motion details:
 *   - Mood faces SCALE + COLOR-MORPH on select, with a soft glow halo.
 *   - Selected category chip rides a sliding indigo→violet pill.
 *   - NPS slider track gradients from red→amber→emerald based on value.
 *   - "Send feedback" button has a press squish + bubble-eject confetti on success.
 *   - Success card flips in with a 3D rotateX, then auto-dismisses on "Send another".
 *   - All animations respect prefers-reduced-motion.
 */

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "../../components/shell/app-shell";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";

const STORAGE_KEY = "clarifyd.feedback";

type Mood = 1 | 2 | 3 | 4 | 5;
type Category = "bug" | "feature" | "ui" | "performance" | "praise";

type FeedbackEntry = {
  id: string;
  mood: Mood;
  category: Category;
  message: string;
  nps: number | null;
  contact_email: string;
  submitted_at: string;
  user_email?: string | null;
};

const MOODS: Array<{
  v: Mood;
  glyph: string;
  label: string;
  color: string;
  halo: string;
}> = [
  { v: 1, glyph: "sentiment_very_dissatisfied", label: "Awful",   color: "#dc2626", halo: "rgba(220,38,38,0.35)"  },
  { v: 2, glyph: "sentiment_dissatisfied",      label: "Meh",     color: "#ea580c", halo: "rgba(234,88,12,0.35)"  },
  { v: 3, glyph: "sentiment_neutral",           label: "Okay",    color: "#64748b", halo: "rgba(100,116,139,0.30)"},
  { v: 4, glyph: "sentiment_satisfied",         label: "Good",    color: "#2563eb", halo: "rgba(37,99,235,0.35)"  },
  { v: 5, glyph: "sentiment_very_satisfied",    label: "Brill",   color: "#059669", halo: "rgba(5,150,105,0.40)"  },
];

const CATEGORIES: Array<{ v: Category; glyph: string; label: string }> = [
  { v: "bug",         glyph: "bug_report",       label: "Bug" },
  { v: "feature",     glyph: "lightbulb",        label: "Feature request" },
  { v: "ui",          glyph: "design_services",  label: "UI / Design" },
  { v: "performance", glyph: "bolt",             label: "Performance" },
  { v: "praise",      glyph: "favorite",         label: "Praise" },
];

export default function FeedbackPage() {
  const { me, client } = useAuth();
  const { push } = useToast();

  const [mood, setMood] = useState<Mood | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState("");
  const [nps, setNps] = useState<number>(8);
  const [npsTouched, setNpsTouched] = useState(false);
  const [contactEmail, setContactEmail] = useState(me?.email ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [sentEntry, setSentEntry] = useState<FeedbackEntry | null>(null);

  // Particle burst on submit.
  const burstRef = useRef<HTMLDivElement | null>(null);

  // Sync contact email when auth populates after first paint.
  useEffect(() => {
    if (me?.email && !contactEmail) setContactEmail(me.email);
  }, [me, contactEmail]);

  // Bubbly chip switch — per-chip selected state, no absolute pill (the
  // old sliding pill had no pointer-events:none so it intercepted clicks
  // on chips it overlapped, making the neighbour look "white and dead").

  // NPS track gradient: red @ 0 → amber @ 6 → emerald @ 10.
  const npsTrackStyle = useMemo(() => {
    const pct = (nps / 10) * 100;
    const stop = nps <= 6 ? "#ea580c" : nps <= 8 ? "#2563eb" : "#059669";
    return {
      background: `linear-gradient(90deg, ${stop} ${pct}%, rgba(255,255,255,0.45) ${pct}%)`,
    } as const;
  }, [nps]);

  function fireConfetti() {
    if (typeof window === "undefined" || !burstRef.current) return;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const host = burstRef.current;
    const colors = ["#3525cd", "#7c3aed", "#22d3ee", "#059669", "#B45309"];
    for (let i = 0; i < 28; i++) {
      const dot = document.createElement("span");
      const angle = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 140;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 30;
      const sz = 6 + Math.random() * 6;
      dot.style.cssText = `
        position:absolute; left:50%; top:50%;
        width:${sz}px; height:${sz}px; border-radius:9999px;
        background:${colors[i % colors.length]};
        transform:translate(-50%,-50%);
        opacity:0.95; pointer-events:none;
        transition: transform 900ms cubic-bezier(0.16,1,0.3,1), opacity 900ms ease-out;
        will-change: transform, opacity;
        box-shadow: 0 0 12px ${colors[i % colors.length]}66;
      `;
      host.appendChild(dot);
      requestAnimationFrame(() => {
        dot.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.4)`;
        dot.style.opacity = "0";
      });
      window.setTimeout(() => dot.remove(), 1100);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mood) return push("Pick a mood first.", "info");
    if (!category) return push("Pick a category first.", "info");
    if (message.trim().length < 6) {
      return push("Tell us a little more (≥ 6 chars).", "info");
    }
    setSubmitting(true);
    try {
      const trimmedEmail = contactEmail.trim();
      // 1) Persist server-side first — this is the source of truth.
      let serverId = "";
      let serverTs = new Date().toISOString();
      try {
        const res = await client.submitFeedback({
          mood,
          category,
          message: message.trim(),
          nps: npsTouched ? nps : null,
          contact_email: trimmedEmail || null,
          page_path: typeof window !== "undefined" ? window.location.pathname : null,
        });
        serverId = res.id;
        serverTs = res.submitted_at;
      } catch (err) {
        // Offline / backend down — fall through to localStorage so the
        // user's note isn't lost, then warn (not error) so the success
        // animation still plays.
        push(
          err instanceof ApiError ? err.message : "Saved locally — backend unreachable.",
          "info"
        );
      }

      const entry: FeedbackEntry = {
        id: serverId || crypto.randomUUID(),
        mood,
        category,
        message: message.trim(),
        nps: npsTouched ? nps : null,
        contact_email: trimmedEmail,
        submitted_at: serverTs,
        user_email: me?.email ?? null,
      };

      // 2) Mirror to localStorage so the user can see their history
      // immediately even before we build an admin "my feedback" view.
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const list: FeedbackEntry[] = raw ? JSON.parse(raw) : [];
        list.unshift(entry);
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(list.slice(0, 50))
        );
      } catch {
        /* storage full — non-fatal */
      }

      fireConfetti();
      window.setTimeout(() => {
        setSentEntry(entry);
        setSubmitting(false);
      }, 350);
    } catch {
      push("Couldn't send right now.", "error");
      setSubmitting(false);
    }
  }

  function reset() {
    setSentEntry(null);
    setMood(null);
    setCategory(null);
    setMessage("");
    setNps(8);
    setNpsTouched(false);
  }

  if (sentEntry) {
    return (
      <AppShell>
        <section
          className="crystal-glass feedback-flip-in rounded-3xl p-8 md:p-10 text-center relative overflow-hidden"
          style={{ perspective: "900px" }}
        >
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(124,58,237,0.35), transparent 70%)",
              filter: "blur(40px)",
            }}
            aria-hidden
          />
          <span
            className="material-symbols-outlined text-status-success text-[72px] block relative z-10"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          <h2 className="font-display-hero text-h2 md:text-h1 text-onboarding-navy m-0 mt-3 relative z-10">
            Thanks — got it.
          </h2>
          <p className="text-on-surface-variant max-w-md mx-auto mt-2 relative z-10">
            Your {CATEGORIES.find((c) => c.v === sentEntry.category)?.label.toLowerCase()} note
            is logged{sentEntry.nps !== null ? ` (NPS ${sentEntry.nps})` : ""}. We read every
            submission.
          </p>
          <div className="flex justify-center gap-3 mt-6 relative z-10 flex-wrap">
            <button
              type="button"
              onClick={reset}
              className="btn-capsule btn-capsule-primary"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Send another
            </button>
            <a
              href="/dashboard"
              className="btn-capsule glass-semi-clear text-primary"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to dashboard
            </a>
          </div>

        </section>
      </AppShell>
    );
  }

  const activeMoodMeta = mood ? MOODS.find((m) => m.v === mood)! : null;

  return (
    <AppShell>
      {/* Header */}
      <section className="crystal-glass rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div
          className="absolute -top-20 -left-16 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: "rgba(53,37,205,0.14)", filter: "blur(70px)" }}
          aria-hidden
        />
        <div
          className="absolute -bottom-20 -right-12 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "rgba(124,58,237,0.14)", filter: "blur(75px)" }}
          aria-hidden
        />
        <div className="relative z-10">
          <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">
            Feedback · we actually read this
          </span>
          <h1 className="font-display-hero text-h1-mobile md:text-h1 text-onboarding-navy m-0 mt-1">
            How was Clarifyd today?
          </h1>
          <p className="text-on-surface-variant max-w-xl mt-2 m-0">
            One mood, one category, a short note. Optional NPS + an email if
            you want a reply.
          </p>
        </div>
      </section>

      {/* The form card */}
      <form onSubmit={onSubmit} className="crystal-glass rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col gap-6 sm:gap-8">
        {/* MOOD */}
        <fieldset className="m-0 p-0 border-0">
          <legend className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-3">
            Mood
          </legend>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-3 md:flex md:items-end md:gap-5 md:flex-wrap">
            {MOODS.map((m) => {
              const selected = mood === m.v;
              return (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => setMood(m.v)}
                  aria-label={m.label}
                  aria-pressed={selected}
                  className="relative flex flex-col items-center gap-1 group focus:outline-none"
                  style={{
                    transition:
                      "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    transform: selected ? "translateY(-6px)" : "translateY(0)",
                  }}
                >
                  {selected ? (
                    <span
                      aria-hidden
                      className="absolute -inset-2 rounded-full pointer-events-none"
                      style={{
                        background: `radial-gradient(circle, ${m.halo} 0%, transparent 70%)`,
                        filter: "blur(8px)",
                      }}
                    />
                  ) : null}
                  <span
                    className="material-symbols-outlined"
                    style={{
                      // Smaller base + smaller "selected" bump on phones so
                      // 5 faces fit without horizontal scroll. Tailwind can't
                      // animate font-size at breakpoints — pick at runtime.
                      fontSize: selected ? "var(--mood-on, 48px)" : "var(--mood-off, 34px)",
                      color: selected ? m.color : "rgba(70,69,85,0.55)",
                      fontVariationSettings: selected ? "'FILL' 1" : "'FILL' 0",
                      transition:
                        "font-size 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.3s ease",
                    }}
                  >
                    {m.glyph}
                  </span>
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider transition-colors"
                    style={{
                      color: selected ? m.color : "rgba(70,69,85,0.7)",
                    }}
                  >
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* CATEGORY */}
        <fieldset className="m-0 p-0 border-0">
          <legend className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-3">
            Category
          </legend>
          {/* Grid on mobile (2 chips per row, last one full-width via odd-child rule).
              Auto-flowing pill row from sm: up. */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2 sm:p-1.5 sm:rounded-full sm:bg-white/40 sm:border sm:border-white/60">
            {CATEGORIES.map((c, idx) => {
              const selected = category === c.v;
              const isLastOdd =
                idx === CATEGORIES.length - 1 && CATEGORIES.length % 2 === 1;
              return (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => setCategory(c.v)}
                  aria-pressed={selected}
                  className={`
                    chip-bubbly inline-flex items-center justify-center gap-1.5
                    px-3 sm:px-4 py-3 sm:py-2 min-h-[44px] sm:min-h-0
                    rounded-full text-[11px] sm:text-[12px] font-bold uppercase tracking-wider
                    whitespace-nowrap
                    ${isLastOdd ? "col-span-2 sm:col-span-1" : ""}
                  `}
                  style={{
                    background: selected
                      ? "linear-gradient(135deg, #3525cd 0%, #7c3aed 100%)"
                      : "transparent",
                    boxShadow: selected
                      ? "0 6px 18px -6px rgba(124,58,237,0.55), inset 0 1px 0 rgba(255,255,255,0.35)"
                      : "none",
                    color: selected ? "#ffffff" : "rgba(70,69,85,0.85)",
                    transform: selected ? "scale(1)" : "scale(0.96)",
                    transition:
                      "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), " +
                      "background 0.3s ease, " +
                      "color 0.25s ease, " +
                      "box-shadow 0.3s ease",
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[16px]"
                    style={{ color: selected ? "#ffffff" : "rgba(70,69,85,0.85)" }}
                  >
                    {c.glyph}
                  </span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* MESSAGE */}
        <label className="flex flex-col gap-2">
          <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
            What happened? <span className="text-on-surface-variant/60">(≥ 6 chars)</span>
          </span>
          <div className="glass-field-strong">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                activeMoodMeta
                  ? activeMoodMeta.v >= 4
                    ? "Loved what? Be specific — saves us guessing what to keep."
                    : "Describe what tripped you up. Steps to reproduce help."
                  : "Describe the moment. The more specific, the better."
              }
              rows={5}
              maxLength={2000}
              style={{ lineHeight: 1.6 }}
            />
          </div>
          <span className="text-[11px] text-on-surface-variant/70 self-end">
            {message.length}/2000
          </span>
        </label>

        {/* NPS slider */}
        <fieldset className="m-0 p-0 border-0">
          <legend className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
            How likely to recommend?
            <span className="text-on-surface-variant/60 normal-case tracking-normal text-[11px] font-normal">
              optional · 0–10
            </span>
          </legend>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="font-display-hero text-2xl sm:text-3xl text-onboarding-navy w-9 sm:w-12 text-center shrink-0">
              {npsTouched ? nps : "—"}
            </span>
            <div className="flex-1 relative min-w-0">
              <div
                className="h-2 rounded-full"
                style={npsTrackStyle}
                aria-hidden
              />
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={nps}
                onChange={(e) => {
                  setNps(Number(e.target.value));
                  setNpsTouched(true);
                }}
                aria-label="NPS score 0 to 10"
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
              <div className="flex justify-between mt-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 gap-2">
                <span className="truncate">Detractor</span>
                <span className="truncate hidden xs:inline sm:inline">Passive</span>
                <span className="truncate">Promoter</span>
              </div>
            </div>
          </div>
        </fieldset>

        {/* CONTACT */}
        <label className="flex flex-col gap-2">
          <span className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant">
            Reply email <span className="text-on-surface-variant/60">(optional)</span>
          </span>
          <div className="glass-field-strong">
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="you@startup.com — leave blank to stay anonymous"
            />
          </div>
        </label>

        {/* SUBMIT */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <p className="text-[11px] text-on-surface-variant/70 m-0 max-w-sm order-2 sm:order-1">
            Stored in the Clarifyd database (logged-in &amp; anonymous both
            welcome). Admins can view via <code>/api/v1/feedback</code>.
          </p>
          <div className="relative self-end sm:self-auto order-1 sm:order-2" ref={burstRef}>
            <button
              type="submit"
              disabled={submitting || !mood || !category || message.trim().length < 6}
              className="btn-capsule btn-capsule-primary px-6 sm:px-7 w-full sm:w-auto disabled:opacity-50"
              style={{
                transition:
                  "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease",
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.96)";
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              }}
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              {submitting ? "Sending…" : "Send feedback"}
            </button>
          </div>
        </div>
      </form>
    </AppShell>
  );
}
