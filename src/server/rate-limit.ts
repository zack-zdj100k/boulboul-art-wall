import "server-only";
import { tooManyRequests } from "@/server/http";

// Fixed-window in-memory limiter. Good enough for a single Node instance; for several
// instances, back this with Redis/Postgres behind the same `rateLimit()` signature.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  if (process.env.NODE_ENV === "test") return;
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) throw tooManyRequests();
}
