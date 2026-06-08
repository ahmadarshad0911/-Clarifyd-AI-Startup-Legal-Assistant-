"use client";

/**
 * /library — workflow cross-cutting (Library).
 *
 * Browseable startup-template catalog. Click "Use template" → routes to
 * /copilot with template=<id> query param.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Books } from "@phosphor-icons/react";

import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { BroadsheetSearch } from "../../components/broadsheet-search";
import { STARTUP_TEMPLATES, type StartupTemplate } from "../../lib/startup-templates";

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");

  const templates = useMemo(() => Object.values(STARTUP_TEMPLATES), []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => set.add(t.category));
    return ["all", ...Array.from(set).sort()];
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (cat !== "all" && t.category !== cat) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    });
  }, [templates, cat, query]);

  return (
    <AppShell>
      <motion.header
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="cf-eyebrow" style={{ color: "var(--brand-500)", display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Books weight="duotone" size={14} aria-hidden />
          Library
        </div>
        <h1 style={{ marginTop: 8, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Startup templates. <span style={{ color: "var(--brand-500)" }}>Drop-in ready.</span>
        </h1>
        <p style={{ marginTop: 8, color: "var(--ink-secondary)", fontSize: 14.5, maxWidth: 560 }}>
          NDAs, SAFEs, employment offers, MSAs. Clarifyd AI fills the placeholders from a 6-question chat.
        </p>
      </motion.header>

      <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", maxWidth: 520 }}>
          <BroadsheetSearch
            label="Index of templates"
            placeholder="Type a term — NDA, SAFE, offer letter…"
            value={query}
            onChange={setQuery}
            meta={`${filtered.length} of ${templates.length}`}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {categories.map((c) => {
            const active = cat === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className="cursor-pointer cf-mono"
                style={{
                  background: active ? "var(--brand-500)" : "var(--bg-elevated-1)",
                  color: active ? "var(--ink-on-brand)" : "var(--ink-secondary)",
                  border: `1px solid ${active ? "var(--brand-500)" : "var(--border-strong)"}`,
                  padding: "7px 12px",
                  fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
                  borderRadius: "var(--r-sm)",
                  transition: "background 200ms var(--ease-out), color 200ms var(--ease-out), border-color 200ms var(--ease-out)",
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <section style={{ marginTop: 28 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, background: "var(--bg-elevated-1)", border: "1px solid var(--border-hairline)", borderRadius: "var(--r-md)", textAlign: "center", color: "var(--ink-muted)" }}>
            <BookOpen weight="duotone" size={32} color="var(--ink-muted)" />
            <p style={{ marginTop: 10, fontSize: 14, fontStyle: "italic" }}>No templates match.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {filtered.map((t, i) => (
              <TemplateCard key={t.id} t={t} delay={i * 0.04} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function TemplateCard({ t, delay }: { t: StartupTemplate; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1], delay }}
      style={{
        background: "var(--bg-elevated-1)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-md)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "border-color 200ms var(--ease-out), transform 200ms var(--ease-out)",
      }}
      whileHover={{ y: -2, borderColor: "var(--brand-500)" } as any}
    >
      <div className="cf-eyebrow" style={{ color: "var(--brand-500)" }}>{t.category}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: "var(--ink-primary)", letterSpacing: "-0.01em" }}>
        {t.name}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 2 }}>
        {t.terms.length} input{t.terms.length === 1 ? "" : "s"}
      </div>
      <div style={{ flex: 1 }} />
      <Link
        href={`/copilot?template=${encodeURIComponent(t.id)}`}
        className="cursor-pointer"
        style={{
          marginTop: 8,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12.5,
          color: "var(--ink-primary)",
          fontWeight: 500,
          letterSpacing: "-0.005em",
        }}
      >
        Use template <ArrowRight weight="bold" size={12} color="var(--brand-500)" />
      </Link>
    </motion.div>
  );
}
