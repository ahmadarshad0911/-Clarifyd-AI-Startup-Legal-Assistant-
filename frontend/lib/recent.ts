const KEY = "clarifyd.recent-drafts";
const MAX = 8;

export type RecentDraft = {
  draft_id: string;
  file_name: string;
  highest_risk: string;
  findings_count: number;
  uploaded_at: string;
};

function read(): RecentDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: RecentDraft[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
}

export function listRecent(): RecentDraft[] {
  return read();
}

export function pushRecent(item: RecentDraft): RecentDraft[] {
  const all = read().filter((r) => r.draft_id !== item.draft_id);
  const next = [item, ...all].slice(0, MAX);
  write(next);
  return next;
}

export function removeRecent(draftId: string): RecentDraft[] {
  const next = read().filter((r) => r.draft_id !== draftId);
  write(next);
  return next;
}

export function clearRecent(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
