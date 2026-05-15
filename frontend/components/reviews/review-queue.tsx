"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import type {
  ReviewDecision,
  ReviewQueueItem,
  ReviewQueueState,
} from "../../lib/contracts";

const DECISIONS: ReviewDecision[] = ["accept", "request_change", "escalate"];

const TABS: { state: ReviewQueueState; label: string; icon: string }[] = [
  { state: "pending", label: "Pending", icon: "inbox" },
  { state: "in_review", label: "In review", icon: "rate_review" },
  { state: "resolved", label: "Resolved", icon: "task_alt" },
];

const RISK_PILL: Record<string, string> = {
  low: "bg-slate-200 text-slate-700",
  medium: "bg-status-info/10 text-status-info",
  high: "bg-status-warn/10 text-status-warn",
  critical: "bg-status-danger/10 text-status-danger",
};

export function ReviewQueue() {
  const { client, role, me } = useAuth();
  const { push } = useToast();
  const [filter, setFilter] = useState<ReviewQueueState>("pending");
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const canReview = role === "reviewer" || role === "admin";

  const refresh = useCallback(async () => {
    if (!canReview) return;
    setLoading(true);
    try {
      const res = await client.listReviews(filter);
      setItems(res.items);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Failed to load reviews.", "error");
    } finally {
      setLoading(false);
    }
  }, [canReview, client, filter, push]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!canReview) {
    return (
      <section className="crystal-glass rounded-3xl p-8">
        <h2 className="font-display-hero text-h2 text-onboarding-navy mb-2">Review queue</h2>
        <p className="text-on-surface-variant">Reviewer or admin role required.</p>
      </section>
    );
  }

  return (
    <section className="crystal-glass rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <span className="font-label-caps text-label-caps text-primary tracking-widest uppercase block mb-1">
            Reviewer workspace
          </span>
          <h2 className="font-display-hero text-h1-mobile lg:text-h1 text-onboarding-navy m-0">
            Review queue
          </h2>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="btn-capsule glass-semi-clear text-primary text-sm px-5"
        >
          <span
            className={`material-symbols-outlined text-[18px] ${loading ? "animate-spin" : ""}`}
          >
            {loading ? "progress_activity" : "refresh"}
          </span>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Segmented tabs */}
      <div
        className="flex gap-1.5 p-1.5 bg-white/40 border border-white/60 rounded-full mb-8 w-full sm:w-fit"
        role="tablist"
        aria-label="Queue state"
      >
        {TABS.map((t) => {
          const active = t.state === filter;
          return (
            <button
              key={t.state}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(t.state)}
              className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-5 py-2 rounded-full font-label-caps text-label-caps uppercase tracking-wider transition-all whitespace-nowrap ${
                active
                  ? "bg-gradient-to-r from-primary to-accent-violet text-white shadow-md"
                  : "text-on-surface-variant hover:text-primary hover:bg-white/50"
              }`}
            >
              <span className="material-symbols-outlined text-[16px] shrink-0">{t.icon}</span>
              <span className="truncate">{t.label}</span>
              {active ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/25 shrink-0">
                  {items.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {!items.length && !loading ? (
        <div className="flex flex-col items-center justify-center text-center py-12 gap-2">
          <span className="material-symbols-outlined text-primary/30 text-[48px]">
            inventory_2
          </span>
          <p className="text-on-surface-variant text-body-sm m-0">
            No {filter.replace(/_/g, " ")} items.
          </p>
        </div>
      ) : null}

      <ul className="flex flex-col gap-4 m-0 p-0 list-none">
        {items.map((item) => (
          <ReviewRow
            key={item.id}
            item={item}
            assigneeId={me?.id ?? null}
            onChanged={refresh}
          />
        ))}
      </ul>
    </section>
  );
}

function ReviewRow({
  item,
  assigneeId,
  onChanged,
}: {
  item: ReviewQueueItem;
  assigneeId: string | null;
  onChanged: () => void;
}) {
  const { client } = useAuth();
  const { push } = useToast();
  const [decision, setDecision] = useState<ReviewDecision>("accept");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const claimed = item.state === "in_review";
  const resolved = item.state === "resolved";
  const mineToDecide = claimed && item.assignee_id === assigneeId;

  async function claim() {
    setBusy(true);
    try {
      await client.claimReview(item.id);
      push("Claimed for review.", "success");
      onChanged();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Claim failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function decide() {
    setBusy(true);
    try {
      const out = await client.decideReview(item.id, {
        draft_id: item.draft_id,
        finding_id: item.finding_id,
        decision,
        reviewer_note: note || undefined,
      });
      push(
        `Decision recorded: ${out.decision}`,
        "success",
        out.not_legal_advice ? "Marked not legal advice." : undefined
      );
      onChanged();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Decision failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  const riskPill = RISK_PILL[item.risk_level] ?? "bg-slate-200 text-slate-700";
  const statePill = claimed
    ? "bg-status-info/10 text-status-info"
    : resolved
    ? "bg-status-success/10 text-status-success"
    : "bg-black/5 text-on-surface-variant";

  return (
    <li
      className={`rounded-2xl border border-white/60 bg-white/45 p-5 transition-all hover:bg-white/60 ${
        resolved ? "opacity-70" : ""
      }`}
    >
      <div className="mb-3">
        <strong className="font-h3 text-h3 text-on-surface capitalize block mb-2">
          {item.clause_name.replace(/_/g, " ")}
        </strong>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${riskPill}`}
          >
            {item.risk_level}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/5 text-on-surface-variant">
            conf {(item.confidence * 100).toFixed(0)}%
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statePill}`}
          >
            {item.state.replace(/_/g, " ")}
          </span>
          <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant min-w-0 sm:ml-auto">
            <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
              description
            </span>
            <span className="truncate">{item.document_name || "Untitled document"}</span>
          </span>
        </div>
      </div>

      {item.excerpt ? (
        <blockquote
          className="border-l-4 border-primary/30 bg-white/50 rounded-r-xl pl-4 pr-3 py-3 my-3 italic font-display-hero text-on-surface-variant text-body-sm leading-relaxed m-0"
        >
          &ldquo;{item.excerpt}&rdquo;
        </blockquote>
      ) : null}

      {item.explanation ? (
        <p className="text-body-sm text-on-surface/80 leading-relaxed mb-2">
          {item.explanation}
        </p>
      ) : null}

      {item.safer_language ? (
        <p className="text-body-sm text-on-surface mb-2">
          <strong className="text-status-success">Suggested clause: </strong>
          {item.safer_language}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/15 text-body-sm text-on-surface">
          <span className="material-symbols-outlined text-[15px] text-primary">gavel</span>
          <span className="text-on-surface-variant">Clause:</span>
          <span className="font-semibold capitalize">
            {item.clause_name.replace(/_/g, " ")}
          </span>
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/15 text-body-sm text-on-surface min-w-0 max-w-full">
          <span className="material-symbols-outlined text-[15px] text-primary shrink-0">description</span>
          <span className="text-on-surface-variant shrink-0">Document:</span>
          <span className="font-semibold truncate">{item.document_name || "Untitled document"}</span>
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/15 text-body-sm text-on-surface">
          <span className="material-symbols-outlined text-[15px] text-primary">tag</span>
          <span className="text-on-surface-variant">Finding:</span>
          <span className="font-semibold capitalize">
            {(item.finding_label || "finding").replace(/[-_]/g, " ")}
          </span>
        </span>
      </div>

      {resolved ? (
        <p className="text-body-sm text-on-surface-variant m-0">
          Resolved at{" "}
          {item.closed_at ? new Date(item.closed_at).toLocaleString() : "—"}.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {!claimed ? (
            <button
              type="button"
              onClick={claim}
              disabled={busy}
              className="btn-capsule btn-capsule-primary text-sm px-5"
            >
              Claim
            </button>
          ) : null}
          {(claimed && mineToDecide) || item.state === "pending" ? (
            <>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value as ReviewDecision)}
                disabled={busy}
                className="w-full sm:w-auto bg-white border border-white/70 rounded-full px-4 py-2 text-body-sm outline-none focus:ring-2 focus:ring-primary"
              >
                {DECISIONS.map((d) => (
                  <option key={d} value={d}>
                    {d.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Reviewer note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
                className="w-full sm:flex-1 sm:min-w-[160px] bg-white border border-white/70 rounded-full px-4 py-2 text-body-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={decide}
                disabled={busy}
                className="btn-capsule btn-capsule-primary text-sm px-5"
              >
                Decide
              </button>
            </>
          ) : null}
        </div>
      )}
    </li>
  );
}
