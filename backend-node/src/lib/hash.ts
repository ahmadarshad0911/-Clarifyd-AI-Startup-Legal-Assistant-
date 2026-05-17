import { createHash } from 'node:crypto';

export const sha256 = (input: string | Buffer): string =>
  createHash('sha256').update(input).digest('hex');

// Canonicalize JSON for deterministic hashing (sort keys).
export const canonicalJson = (value: unknown): string => {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = sort((v as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(sort(value));
};
