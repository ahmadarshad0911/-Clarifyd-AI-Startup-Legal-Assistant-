import { and, count, eq, gte } from 'drizzle-orm';
import { db, schema } from '@/db';

const PLAN_LIMITS: Record<string, number> = {
  free: Number(process.env.FREE_TIER_SCAN_LIMIT ?? 3),
  starter: 15,
  pro: 50,
  business: 200,
};

export async function checkScanLimit(userId: string, plan: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [{ value }] = await db
    .select({ value: count() })
    .from(schema.scans)
    .innerJoin(schema.contracts, eq(schema.scans.contractId, schema.contracts.id))
    .where(and(eq(schema.contracts.userId, userId), gte(schema.scans.startedAt, since)));
  return { allowed: value < limit, used: value, limit };
}
