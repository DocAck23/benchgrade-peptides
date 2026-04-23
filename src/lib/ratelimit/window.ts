import type { RateLimitResult, RateLimitStore } from "./types";

export interface CheckArgs {
  bucket: string;
  limit: number;
  windowSeconds: number;
  store: RateLimitStore;
  nowEpochSec?: number;
}

export async function checkAndIncrement({
  bucket,
  limit,
  windowSeconds,
  store,
  nowEpochSec,
}: CheckArgs): Promise<RateLimitResult> {
  if (limit <= 0) throw new Error("limit must be positive");
  if (windowSeconds <= 0) throw new Error("windowSeconds must be positive");

  const now = nowEpochSec ?? Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const count = await store.increment(bucket, windowStart);

  if (count <= limit) return { allowed: true, count };
  const retryAfter = Math.max(1, windowStart + windowSeconds - now);
  return { allowed: false, count, retryAfter };
}
