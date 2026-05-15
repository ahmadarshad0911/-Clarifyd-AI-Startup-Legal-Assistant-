"use client";

import { FormEvent, useState } from "react";

import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { removeRecent } from "../../lib/recent";
import { useToast } from "../../lib/toast";

export function SoftDeleteForm() {
  const { client } = useAuth();
  const { push } = useToast();
  const [draftId, setDraftId] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftId.trim()) return;
    setBusy(true);
    try {
      const res = await client.softDeleteDraft(draftId.trim());
      push(`Soft-deleted draft ${res.draft_id.slice(0, 8)}…`, "success", `at ${res.deleted_at}`);
      removeRecent(res.draft_id);
      setDraftId("");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Delete failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <header style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <h2>Soft-delete draft</h2>
        <span className="muted">retention 365 days · dedup skips deleted</span>
      </header>
      <p className="muted">
        Marks <code>deleted_at</code> on the draft row. Re-uploading the same file produces a new draft id (proves dedup respects the deletion).
      </p>
      <form onSubmit={onSubmit} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="draft_id"
          value={draftId}
          onChange={(e) => setDraftId(e.target.value)}
          style={{ flex: 1, minWidth: 280 }}
        />
        <button type="submit" className="danger" disabled={busy || !draftId.trim()}>
          {busy ? "Deleting…" : "Soft-delete"}
        </button>
      </form>
    </section>
  );
}
