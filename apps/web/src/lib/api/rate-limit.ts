interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** In-process limiter (Docker / local). Resets on process restart. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** KV-backed limiter shared across Worker isolates. */
export async function kvRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const kvKey = `rl:${key}`;
  const now = Date.now();
  const existing = await kv.get<{ count: number; resetAt: number }>(kvKey, "json");

  if (!existing || now > existing.resetAt) {
    const ttl = Math.max(60, Math.ceil(windowMs / 1000));
    await kv.put(kvKey, JSON.stringify({ count: 1, resetAt: now + windowMs }), {
      expirationTtl: ttl,
    });
    return true;
  }

  if (existing.count >= limit) return false;

  const ttl = Math.max(60, Math.ceil((existing.resetAt - now) / 1000));
  await kv.put(
    kvKey,
    JSON.stringify({ count: existing.count + 1, resetAt: existing.resetAt }),
    { expirationTtl: ttl },
  );
  return true;
}
