// Regulation feed monitoring. Supports RSS, Atom, and JSON (Federal Register).
// Default sources: Federal Register (FTC + SEC rule changes).

import { and, eq, gt } from 'drizzle-orm';
import { db, schema } from '@/db';

interface FeedItem {
  id: string;
  title: string;
  publishedAt?: string;
  url?: string;
}

const stripCdata = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();

async function fetchRssAtom(url: string): Promise<FeedItem[]> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': process.env.REG_USER_AGENT ?? 'Clarifyd Backend ahmed@clarifyd.dev',
    },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const items: FeedItem[] = [];

  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const id =
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] ??
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] ??
      '';
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? '';
    const publishedAt = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)?.[1] ?? '';
    const cleanId = stripCdata(id);
    if (cleanId) items.push({ id: cleanId, title: stripCdata(title), publishedAt: stripCdata(publishedAt) });
  }
  for (const m of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)) {
    const block = m[1];
    const id =
      block.match(/<id[^>]*>([\s\S]*?)<\/id>/)?.[1] ??
      block.match(/<link[^>]*href="([^"]+)"/)?.[1] ??
      '';
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? '';
    const publishedAt =
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/)?.[1] ??
      block.match(/<published[^>]*>([\s\S]*?)<\/published>/)?.[1] ??
      '';
    const cleanId = stripCdata(id);
    if (cleanId) items.push({ id: cleanId, title: stripCdata(title), publishedAt: stripCdata(publishedAt) });
  }
  return items;
}

interface FedRegDoc {
  document_number: string;
  title: string;
  publication_date?: string;
  html_url?: string;
}

async function fetchFederalRegister(agency: string): Promise<FeedItem[]> {
  const url = `https://www.federalregister.gov/api/v1/documents.json?conditions%5Bagencies%5D%5B%5D=${encodeURIComponent(
    agency,
  )}&per_page=50&order=newest`;
  const res = await fetch(url, {
    headers: { 'User-Agent': process.env.REG_USER_AGENT ?? 'Clarifyd Backend ahmed@clarifyd.dev' },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { results?: FedRegDoc[] };
  return (json.results ?? []).map((d) => ({
    id: d.document_number,
    title: d.title,
    publishedAt: d.publication_date,
    url: d.html_url,
  }));
}

export type Source =
  | { source: string; kind: 'rss' | 'atom'; url: string }
  | { source: string; kind: 'fedreg'; agency: string };

export const DEFAULT_SOURCES: Source[] = [
  { source: 'fedreg-ftc', kind: 'fedreg', agency: 'federal-trade-commission' },
  { source: 'fedreg-sec', kind: 'fedreg', agency: 'securities-and-exchange-commission' },
];

export async function diffRegulationSource(s: Source) {
  const items = s.kind === 'fedreg' ? await fetchFederalRegister(s.agency) : await fetchRssAtom(s.url);
  let newCount = 0;
  for (const it of items) {
    const exists = await db
      .select({ id: schema.regulationSnapshots.id })
      .from(schema.regulationSnapshots)
      .where(and(eq(schema.regulationSnapshots.source, s.source), eq(schema.regulationSnapshots.itemId, it.id)))
      .limit(1);
    if (exists.length === 0) {
      await db.insert(schema.regulationSnapshots).values({
        source: s.source,
        feedUrl: s.kind === 'fedreg' ? `fedreg:${s.agency}` : s.url,
        itemId: it.id,
        title: it.title,
        publishedAt: it.publishedAt ? new Date(it.publishedAt) : null,
        payload: it,
      });
      newCount++;
    }
  }
  return { fetched: items.length, new: newCount };
}

// Mark affected scans + create regulation-flag deadlines.
// MVP: flag every recent scan; refine to clause-type-specific matching post-MVP.
export async function flagAffectedScans(_source: string) {
  const recentScans = await db
    .select({ id: schema.scans.id, contractId: schema.scans.contractId })
    .from(schema.scans)
    .where(gt(schema.scans.finishedAt, new Date(Date.now() - 90 * 86400_000)));
  for (const s of recentScans) {
    if (!s.contractId) continue;
    const [c] = await db.select().from(schema.contracts).where(eq(schema.contracts.id, s.contractId));
    if (!c?.userId) continue;
    await db.insert(schema.deadlines).values({
      userId: c.userId,
      contractId: c.id,
      kind: 'regulation-flag',
      label: 'Regulation update — re-scan recommended',
      dueAt: new Date(Date.now() + 7 * 86400_000),
    });
  }
}
