"use client";

import { useEffect, useState } from "react";

import { listRecent, type RecentDraft } from "../../lib/recent";

type Props = {
  value: string;
  onChange: (draftId: string) => void;
  label?: string;
};

export function DraftPicker({ value, onChange, label = "Draft" }: Props) {
  const [recents, setRecents] = useState<RecentDraft[]>([]);

  useEffect(() => {
    setRecents(listRecent());
  }, []);

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <span className="muted">{label}</span>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="draft_id"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, minWidth: 280 }}
        />
        {recents.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && onChange(e.target.value)}
            aria-label="Recent drafts"
          >
            <option value="">Recent…</option>
            {recents.map((r) => (
              <option key={r.draft_id} value={r.draft_id}>
                {r.file_name} ({r.draft_id.slice(0, 8)}…)
              </option>
            ))}
          </select>
        )}
      </div>
    </label>
  );
}
