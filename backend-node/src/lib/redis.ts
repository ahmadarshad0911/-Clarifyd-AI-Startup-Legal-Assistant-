import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

export const redis = Redis.fromEnv();

const PLAN_LIMITS: Record<string, number> = {
  free: Number(process.env.FREE_TIER_SCAN_LIMIT ?? 3),
  starter: 15,
  pro: 50,
  business: 200,
};

const limiters = new Map<string, Ratelimit>();
const limiterFor = (plan: string) => {
  if (!limiters.has(plan)) {
    limiters.set(
      plan,
      new Ratelimit({
        redis,
        limiter: Ratelimit.tokenBucket(PLAN_LIMITS[plan] ?? PLAN_LIMITS.free, '30d', PLAN_LIMITS[plan] ?? PLAN_LIMITS.free),
        prefix: `clarifyd:scan:${plan}`,
        analytics: true,
      }),
    );
  }
  return limiters.get(plan)!;
};

export async function checkScanLimitRedis(userId: string, plan: string) {
  const r = await limiterFor(plan).limit(userId);
  return { allowed: r.success, used: PLAN_LIMITS[plan] - r.remaining, limit: PLAN_LIMITS[plan], reset: r.reset };
}
