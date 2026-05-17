type Counts = { critical: number; high: number; medium: number; clean: number };

// 100 - (10*critical + 4*high + 1*medium), clamped 0-100.
export const computeHealthScore = (c: Counts): number => {
  const raw = 100 - (10 * c.critical + 4 * c.high + c.medium);
  return Math.max(0, Math.min(100, raw));
};
