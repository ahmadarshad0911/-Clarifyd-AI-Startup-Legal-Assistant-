"use client";

/**
 * /feedback — Broadsheet · v6
 *
 * A dispatch slip the founder files to the Clarifyd editorial desk.
 *
 * Design language:
 *   - Sharp-edged ivory paper card sitting on bsd-paper-deep, red double-rule
 *     header, Geist Mono captions, Geist body, single arterial red CTA.
 *   - Sentiment row uses Phosphor duotone faces (NOT material glyphs) — the
 *     selected face animates with scale 0.97 → 1 and gets a red ring badge.
 *   - Category chips share styling with /dashboard jurisdiction chips.
 *   - Submit shows a red rule sweep + a "FILED" certificate plate that
 *     auto-dismisses on "File another".
 *
 * Motion principles (Emil):
 *   - transform + opacity only.
 *   - ease-out (0.23, 1, 0.32, 1) for entries, 140-220ms durations.
 *   - prefers-reduced-motion respected on every animated element.
 */

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  SmileyXEyes,
  SmileyMeh,
  Smiley,
  SmileyWink,
  SmileyNervous,
  Bug,
  Lightbulb,
  PaintBrush,
  Lightning,
  Heart,
  CheckCircle,
  ArrowRight,
  PaperPlaneRight,
} from "@phosphor-icons/react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";

type Mood = 1 | 2 | 3 | 4 | 5;
type Category = "bug" | "feature" | "ui" | "performance" | "praise";

const EOQ = [0.23, 1, 0.32, 1] as const;

const MOODS: Array<{
  v: Mood;
  Icon: typeof Smiley;
  label: string;
  color: string;
}> = [
  { v: 1, Icon: SmileyXEyes,   label: "Awful",     color: "var(--bsd-sev-critical)" },
  { v: 2, Icon: SmileyNervous, label: "Meh",       color: "var(--bsd-sev-high)" },
  { v: 3, Icon: SmileyMeh,     label: "Okay",      color: "var(--bsd-sev-medium)" },
  { v: 4, Icon: Smiley,        label: "Good",      color: "var(--bsd-sev-clean, #4f7d3f)" },
  { v: 5, Icon: SmileyWink,    label: "Brilliant", color: "var(--bsd-sev-clean, #4f7d3f)" },
];

const CATEGORIES: Array<{ v: Category; Icon: typeof Bug; label: string }> = [
  { v: "bug",         Icon: Bug,        label: "Bug" },
  { v: "feature",     Icon: Lightbulb,  label: "Feature idea" },
  { v: "ui",          Icon: PaintBrush, label: "UI / Design" },
  { v: "performance", Icon: Lightning,  label: "Performance" },
  { v: "praise",      Icon: Heart,      label: "Praise" },
];

const MAX_MESSAGE = 1500;
const MIN_MESSAGE = 6;

export default function FeedbackPage() {
  const reduce = useReducedMotion() ?? false;
  const { client, me } = useAuth();
  const { push } = useToast();

  const [mood, setMood] = useState<Mood | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState("");
  const [nps, setNps] = useState<number>(7);
  const [npsTouched, setNpsTouched] = useState(false);
  const [email, setEmail] = useState(me?.email ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [filed, setFiled] = useState<{ id: string; at: string } | null>(null);

  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!filed) messageRef.current?.focus({ preventScroll: true });
  }, [filed]);

  const charsLeft = MAX_MESSAGE - message.length;
  const canSubmit =
    !!mood &&
    !!category &&
    message.trim().length >= MIN_MESSAGE &&
    !submitting;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !mood || !category) return;
    setSubmitting(true);
    try {
      const res = await client.submitFeedback({
        mood,
        category,
        message: message.trim(),
        nps: npsTouched ? nps : null,
        contact_email: email.trim() || null,
        page_path: typeof window !== "undefined" ? window.location.pathname : null,
      });
      setFiled({ id: res.id, at: res.submitted_at });
      push("Dispatch filed", "success", "Editor will read it personally.");
    } catch (err) {
      push(
        err instanceof ApiError
          ? err.message
          : "Could not file your dispatch. Try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setMood(null);
    setCategory(null);
    setMessage("");
    setNps(7);
    setNpsTouched(false);
    setFiled(null);
  }

  const npsAccent = useMemo(() => {
    if (nps <= 3) return "var(--bsd-sev-critical)";
    if (nps <= 6) return "var(--bsd-sev-high)";
    if (nps <= 8) return "var(--bsd-sev-medium)";
    return "var(--bsd-sev-clean)";
  }, [nps]);

  return (
    <AppShell>
      <section
        style={{
          paddingBottom: 22,
          borderBottom: "1px solid var(--bsd-hairline)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EOQ }}
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <span className="bsd-kicker">Reporter&apos;s notebook</span>
            <h1
              style={{
                margin: "10px 0 0",
                fontSize: "clamp(36px, 5vw, 60px)",
                fontWeight: 700,
                color: "var(--bsd-ink)",
                letterSpacing: "-0.03em",
                lineHeight: 1.02,
              }}
            >
              File a{" "}
              <span
                style={{
                  color: "var(--bsd-red)",
                  fontStyle: "italic",
                  fontWeight: 600,
                }}
              >
                dispatch.
              </span>
            </h1>
            <p
              style={{
                margin: "12px 0 0",
                color: "var(--bsd-body)",
                fontSize: 15.5,
                lineHeight: 1.6,
                maxWidth: 620,
              }}
            >
              Bugs, ideas, design nits, performance gripes, or a kind word —
              the editorial desk reads every one.
            </p>
          </div>
          <div
            className="cf-mono"
            style={{
              fontFamily: "Geist Mono, ui-monospace, monospace",
              fontSize: 10.5,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--bsd-muted)",
              fontWeight: 700,
            }}
          >
            DESK · CLARIFYD EDITORIAL
          </div>
        </motion.div>
      </section>

      <article
        style={{
          margin: "40px auto 80px",
          maxWidth: 760,
          width: "100%",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {filed ? (
            <Filed key="filed" id={filed.id} at={filed.at} onReset={resetForm} reduce={reduce} />
          ) : (
            <motion.form
              key="form"
              onSubmit={submit}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EOQ }}
              style={{
                background: "var(--bsd-paper)",
                border: "1px solid var(--bsd-rule)",
                borderRadius: 2,
                padding: "32px 36px 28px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: "var(--bsd-red)",
                }}
              />
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: 5,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: "var(--bsd-red)",
                  opacity: 0.4,
                }}
              />

              {/* Mood row */}
              <SectionHeader
                index="01"
                title="How did it feel?"
                hint="Pick the face that fits."
              />
              <div
                role="radiogroup"
                aria-label="Mood"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                  gap: 10,
                  marginBottom: 32,
                }}
              >
                {MOODS.map((m) => (
                  <MoodTile
                    key={m.v}
                    Icon={m.Icon}
                    label={m.label}
                    color={m.color}
                    active={mood === m.v}
                    onClick={() => setMood(m.v)}
                    reduce={reduce}
                  />
                ))}
              </div>

              {/* Category row */}
              <SectionHeader
                index="02"
                title="What's the angle?"
                hint="Choose one category."
              />
              <div
                role="radiogroup"
                aria-label="Category"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 32,
                }}
              >
                {CATEGORIES.map((c) => (
                  <CategoryChip
                    key={c.v}
                    Icon={c.Icon}
                    label={c.label}
                    active={category === c.v}
                    onClick={() => setCategory(c.v)}
                  />
                ))}
              </div>

              {/* Story */}
              <SectionHeader
                index="03"
                title="Your dispatch."
                hint={`${MIN_MESSAGE}+ characters. The more concrete, the better.`}
              />
              <div style={{ position: "relative", marginBottom: 32 }}>
                <textarea
                  ref={messageRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                  rows={6}
                  placeholder="What happened, when, and what you expected instead."
                  style={{
                    width: "100%",
                    background: "var(--bsd-paper-low, var(--bsd-paper))",
                    border: "1px solid var(--bsd-rule)",
                    borderRadius: 2,
                    padding: "14px 16px",
                    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: "var(--bsd-ink)",
                    outline: "none",
                    transition: "border-color 200ms ease",
                    resize: "vertical",
                    minHeight: 140,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--bsd-red)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--bsd-rule)";
                  }}
                />
                <div
                  className="cf-mono"
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 12,
                    fontFamily: "Geist Mono, ui-monospace, monospace",
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color:
                      charsLeft < 0
                        ? "var(--bsd-red)"
                        : "var(--bsd-muted)",
                    fontWeight: 700,
                    pointerEvents: "none",
                  }}
                >
                  {charsLeft} chars
                </div>
              </div>

              {/* NPS slider */}
              <SectionHeader
                index="04"
                title="Would you recommend Clarifyd?"
                hint="Optional. 0 = never, 10 = always."
              />
              <div style={{ marginBottom: 32 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 8,
                  }}
                >
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
                    aria-label="Recommendation score"
                    className="bsd-range"
                    style={{
                      flex: 1,
                      ["--bsd-range-fill" as unknown as string]: `${(nps / 10) * 100}%`,
                      ["--bsd-range-color" as unknown as string]: npsAccent,
                    }}
                  />
                  <div
                    className="cf-mono tabular-nums"
                    style={{
                      width: 42,
                      textAlign: "center",
                      fontFamily: "Geist Mono, ui-monospace, monospace",
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                      color: npsTouched
                        ? npsAccent
                        : "var(--bsd-muted)",
                      border: `1px solid ${npsTouched ? npsAccent : "var(--bsd-rule)"}`,
                      padding: "6px 0",
                      borderRadius: 2,
                      transition: "color 200ms ease, border-color 200ms ease",
                    }}
                  >
                    {npsTouched ? nps : "—"}
                  </div>
                </div>
                <div
                  className="cf-mono"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 9.5,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--bsd-muted)",
                    fontWeight: 700,
                  }}
                >
                  <span>0 · Never</span>
                  <span>10 · Always</span>
                </div>
              </div>

              {/* Contact */}
              <SectionHeader
                index="05"
                title="Reply to?"
                hint="Optional. We&apos;ll only use it to follow up on this dispatch."
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@startup.com"
                autoComplete="email"
                style={{
                  width: "100%",
                  background: "var(--bsd-paper-low, var(--bsd-paper))",
                  border: "1px solid var(--bsd-rule)",
                  borderRadius: 2,
                  padding: "12px 14px",
                  fontFamily:
                    "Geist Mono, ui-monospace, monospace",
                  fontSize: 13,
                  color: "var(--bsd-ink)",
                  outline: "none",
                  transition: "border-color 200ms ease",
                  marginBottom: 36,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--bsd-red)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--bsd-rule)";
                }}
              />

              {/* Submit */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  borderTop: "1px solid var(--bsd-hairline)",
                  paddingTop: 18,
                }}
              >
                <div
                  className="cf-mono"
                  style={{
                    fontFamily: "Geist Mono, ui-monospace, monospace",
                    fontSize: 10.5,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--bsd-muted)",
                    fontWeight: 700,
                  }}
                >
                  {canSubmit
                    ? "Ready to file"
                    : "Pick a face · pick a category · write 6+ chars"}
                </div>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="cursor-pointer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 24px",
                    background: canSubmit ? "var(--bsd-red)" : "var(--bsd-rule)",
                    border: `1px solid ${canSubmit ? "var(--bsd-red)" : "var(--bsd-rule)"}`,
                    color: "var(--bsd-paper)",
                    fontFamily: "Geist Mono, ui-monospace, monospace",
                    fontSize: 11.5,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    opacity: canSubmit ? 1 : 0.6,
                    borderRadius: 2,
                    outline: "none",
                    transition:
                      "background 160ms ease, transform 100ms ease, box-shadow 160ms ease",
                  }}
                  onMouseDown={(e) => {
                    if (!canSubmit) return;
                    e.currentTarget.style.transform = "scale(0.97)";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  {submitting ? "Filing…" : "File the dispatch"}
                  <PaperPlaneRight weight="bold" size={12} />
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </article>
    </AppShell>
  );
}

function SectionHeader({
  index,
  title,
  hint,
}: {
  index: string;
  title: string;
  hint: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 4,
        }}
      >
        <span
          className="cf-mono"
          style={{
            fontFamily: "Geist Mono, ui-monospace, monospace",
            fontSize: 11,
            letterSpacing: "0.20em",
            color: "var(--bsd-red)",
            fontWeight: 800,
          }}
        >
          {index}
        </span>
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "var(--bsd-ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h2>
      </div>
      <p
        className="cf-mono"
        style={{
          margin: "0 0 0 30px",
          fontFamily: "Geist Mono, ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "0.04em",
          color: "var(--bsd-muted)",
        }}
      >
        {hint}
      </p>
    </div>
  );
}

function MoodTile({
  Icon,
  label,
  color,
  active,
  onClick,
  reduce,
}: {
  Icon: typeof Smiley;
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  reduce: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className="cursor-pointer"
      style={{
        background: active
          ? `color-mix(in oklch, ${color} 10%, var(--bsd-paper))`
          : "var(--bsd-paper-low, var(--bsd-paper))",
        border: `1px solid ${active ? color : "var(--bsd-rule)"}`,
        borderRadius: 2,
        padding: "14px 6px 10px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        outline: "none",
        transition:
          "background 160ms ease, border-color 160ms ease, transform 100ms ease",
      }}
      onMouseDown={(e) => {
        if (reduce) return;
        e.currentTarget.style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseEnter={(e) => {
        if (active) return;
        e.currentTarget.style.borderColor = "var(--bsd-rule-hi)";
      }}
      onMouseLeave={(e) => {
        if (active) return;
        e.currentTarget.style.borderColor = "var(--bsd-rule)";
      }}
    >
      <motion.span
        animate={{ scale: active ? 1.06 : 1 }}
        transition={{ duration: 0.18, ease: EOQ }}
        style={{ display: "inline-flex" }}
      >
        <Icon weight="duotone" size={26} color={color} />
      </motion.span>
      <span
        className="cf-mono"
        style={{
          fontFamily: "Geist Mono, ui-monospace, monospace",
          fontSize: 9.5,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: active ? color : "var(--bsd-muted)",
          fontWeight: 700,
        }}
      >
        {label}
      </span>
    </button>
  );
}

function CategoryChip({
  Icon,
  label,
  active,
  onClick,
}: {
  Icon: typeof Bug;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className="cursor-pointer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: active ? "var(--bsd-red-soft)" : "transparent",
        border: `1px solid ${active ? "var(--bsd-red)" : "var(--bsd-rule)"}`,
        borderRadius: 2,
        padding: "8px 12px",
        cursor: "pointer",
        outline: "none",
        color: active ? "var(--bsd-red)" : "var(--bsd-body)",
        fontFamily: "Geist Mono, ui-monospace, monospace",
        fontSize: 11,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        fontWeight: 700,
        transition:
          "background 160ms ease, border-color 160ms ease, color 160ms ease, transform 100ms ease",
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <Icon weight="duotone" size={13} />
      {label}
    </button>
  );
}

function Filed({
  id,
  at,
  onReset,
  reduce,
}: {
  id: string;
  at: string;
  onReset: () => void;
  reduce: boolean;
}) {
  return (
    <motion.section
      key="filed"
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: 0.34, ease: EOQ }}
      style={{
        position: "relative",
        background: "var(--bsd-paper)",
        border: "1px solid var(--bsd-ink)",
        borderRadius: 2,
        padding: "44px 40px 36px",
        overflow: "hidden",
      }}
    >
      <motion.div
        aria-hidden
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.42, ease: EOQ }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: "var(--bsd-red)",
          transformOrigin: "left center",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 7,
          left: 0,
          right: 0,
          height: 1,
          background: "var(--bsd-red)",
          opacity: 0.45,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <CheckCircle weight="duotone" size={20} color="var(--bsd-red)" />
        <span
          className="cf-mono"
          style={{
            fontFamily: "Geist Mono, ui-monospace, monospace",
            fontSize: 10.5,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--bsd-red)",
            fontWeight: 800,
          }}
        >
          Filed · Edition {new Date(at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </span>
      </div>

      <h2
        style={{
          margin: 0,
          fontSize: "clamp(28px, 4vw, 40px)",
          fontWeight: 700,
          color: "var(--bsd-ink)",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        Dispatch{" "}
        <span
          style={{
            color: "var(--bsd-red)",
            fontStyle: "italic",
            fontWeight: 600,
          }}
        >
          received.
        </span>
      </h2>

      <p
        style={{
          margin: "14px 0 0",
          fontSize: 15.5,
          lineHeight: 1.6,
          color: "var(--bsd-body)",
          maxWidth: 560,
        }}
      >
        The editorial desk has your note. Bug reports get triaged within 24
        hours. Feature ideas are reviewed at the weekly editorial meeting.
      </p>

      <dl
        style={{
          marginTop: 28,
          paddingTop: 18,
          borderTop: "1px solid var(--bsd-hairline)",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "12px 24px",
          fontFamily: "Geist Mono, ui-monospace, monospace",
        }}
      >
        <DL label="Dispatch ID" value={id.slice(0, 12) + "…"} />
        <DL
          label="Filed at"
          value={new Date(at).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
      </dl>

      <button
        type="button"
        onClick={onReset}
        className="cursor-pointer"
        style={{
          marginTop: 36,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "11px 22px",
          background: "transparent",
          border: "1px solid var(--bsd-ink)",
          color: "var(--bsd-ink)",
          fontFamily: "Geist Mono, ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          fontWeight: 700,
          cursor: "pointer",
          borderRadius: 2,
          outline: "none",
          transition: "background 160ms ease, color 160ms ease, transform 100ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bsd-ink)";
          e.currentTarget.style.color = "var(--bsd-paper)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--bsd-ink)";
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "scale(0.97)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        File another
        <ArrowRight weight="bold" size={12} />
      </button>
    </motion.section>
  );
}

function DL({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        style={{
          fontSize: 9.5,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--bsd-muted)",
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontSize: 13,
          color: "var(--bsd-ink)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </dd>
    </div>
  );
}
