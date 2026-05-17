"use client";

import { FormEvent, useEffect, useState } from "react";

import { DraftPicker } from "../../components/common/draft-picker";
import { DarkAppShell as AppShell } from "../../components/shell/dark-app-shell";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { CommentView } from "../../lib/contracts";
import { useToast } from "../../lib/toast";

export default function CommentsPage() {
  const { client } = useAuth();
  const { push } = useToast();
  const [draftId, setDraftId] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<CommentView[]>([]);

  async function load(id: string) {
    if (!id.trim()) {
      setItems([]);
      return;
    }
    try {
      const r = await client.listComments(id.trim());
      setItems(r.items);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Load failed.", "error");
    }
  }

  useEffect(() => {
    void load(draftId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  async function onPost(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draftId.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await client.createComment(draftId.trim(), body.trim());
      setBody("");
      push("Comment added.", "success");
      await load(draftId);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Post failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <section className="card">
        <h2>Comments</h2>
        <p className="muted">Annotate a draft. Reviewer+ can post; viewer+ can read.</p>
        <DraftPicker value={draftId} onChange={setDraftId} />
        <form onSubmit={onPost} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
          <textarea
            rows={3}
            placeholder="Comment body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button type="submit" disabled={busy || !draftId.trim() || !body.trim()}>
            {busy ? "Posting…" : "Post"}
          </button>
        </form>
      </section>

      <section className="card">
        <h3>Thread ({items.length})</h3>
        {items.length === 0 ? (
          <p className="muted">No comments.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {items.map((c) => (
              <li key={c.id} className="card" style={{ padding: "0.6rem", marginBottom: "0.4rem" }}>
                <p>{c.body}</p>
                <p className="muted" style={{ fontSize: "0.8rem" }}>
                  by {c.author_id.slice(0, 8)}… · {c.created_at}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
