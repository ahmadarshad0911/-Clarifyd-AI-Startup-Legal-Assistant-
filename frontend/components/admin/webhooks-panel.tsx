"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { WebhookView } from "../../lib/contracts";
import { useToast } from "../../lib/toast";

const EVENTS = [
  "upload.created",
  "reasoning.evaluate",
  "review.decide",
  "export.ready",
  "compliance.flagged",
] as const;

export function WebhooksPanel() {
  const { client } = useAuth();
  const { push } = useToast();
  const [items, setItems] = useState<WebhookView[]>([]);
  const [url, setUrl] = useState("");
  const [event, setEvent] = useState<string>(EVENTS[0]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await client.listWebhooks();
      setItems(r.items);
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Load failed.", "error");
    }
  }, [client, push]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    try {
      await client.createWebhook(url.trim(), event);
      setUrl("");
      push("Webhook registered.", "success");
      await refresh();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Create failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await client.deleteWebhook(id);
      push("Webhook deleted.", "success");
      await refresh();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Delete failed.", "error");
    }
  }

  return (
    <section className="card">
      <header style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
        <h2>Webhooks</h2>
        <span className="muted">PRD §4.11 · admin only</span>
      </header>
      <form onSubmit={onCreate} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          type="url"
          placeholder="https://example.com/hook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ flex: 1, minWidth: 260 }}
        />
        <select value={event} onChange={(e) => setEvent(e.target.value)}>
          {EVENTS.map((ev) => (
            <option key={ev} value={ev}>
              {ev}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy || !url.trim()}>
          {busy ? "Registering…" : "Register"}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="muted" style={{ marginTop: "0.75rem" }}>No webhooks registered.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: "0.75rem" }}>
          {items.map((h) => (
            <li
              key={h.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.4rem 0",
                borderBottom: "1px solid rgba(15,23,42,0.06)",
              }}
            >
              <span>
                <code>{h.event}</code> → {h.url}
              </span>
              <button type="button" className="ghost danger" onClick={() => onDelete(h.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
