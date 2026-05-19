import { readJSON, writeJSON, removeKey } from "./user-storage";

const KEY = "clarifyd.recent-drafts";
const MAX = 8;

export type RecentDraft = {
  draft_id: string;
  file_name: string;
  highest_risk: string;
  findings_count: number;
  uploaded_at: string;
};

export function listRecent(): RecentDraft[] {
  const v = readJSON<RecentDraft[]>(KEY, []);
  return Array.isArray(v) ? v : [];
}

export function pushRecent(item: RecentDraft): RecentDraft[] {
  const all = listRecent().filter((r) => r.draft_id !== item.draft_id);
  const next = [item, ...all].slice(0, MAX);
  writeJSON(KEY, next);
  return next;
}

export function removeRecent(draftId: string): RecentDraft[] {
  const next = listRecent().filter((r) => r.draft_id !== draftId);
  writeJSON(KEY, next);
  return next;
}

export function clearRecent(): void {
  removeKey(KEY);
}
