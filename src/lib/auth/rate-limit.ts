/**
 * Magic-link rate limit policy: 3 requests / 5 min per IP, keyed
 * `magic-link:<ip>`. Uses the Supabase store in production (when service
 * role is configured) and falls back to an in-process MemoryRateLimitStore
 * in dev so local testing works without a database.
 */

import { getSupabaseServer } from "@/lib/supabase/server";
import { MemoryRateLimitStore } from "@/lib/ratelimit/memory-store";
import { SupabaseRateLimitStore, RateLimitStoreError } from "@/lib/ratelimit/supabase-store";
import { checkAndIncrement } from "@/lib/ratelimit/window";
import type { RateLimitStore } from "@/lib/ratelimit/types";

export const MAGIC_LINK_RATE_LIMIT = {
  limit: 3,
  windowSeconds: 5 * 60,
} as const;

export type MagicLinkRateLimitResult =
  | { allowed: true }
  | { allowed: false; error: string; retryAfter: number };

// Module-level dev store keeps counts across calls within a single
// process. In serverless this resets per cold-start; that's fine for
// dev — production goes through Supabase.
const devStore: RateLimitStore = new MemoryRateLimitStore();

export async function enforceMagicLinkRateLimit(
  ip: string,
  nowEpochSec?: number
): Promise<MagicLinkRateLimitResult> {
  const svc = getSupabaseServer();
  const store: RateLimitStore = svc ? new SupabaseRateLimitStore(svc) : devStore;
  try {
    const res = await checkAndIncrement({
      bucket: `magic-link:${ip}`,
      limit: MAGIC_LINK_RATE_LIMIT.limit,
      windowSeconds: MAGIC_LINK_RATE_LIMIT.windowSeconds,
      store,
      nowEpochSec,
    });
    if (res.allowed) return { allowed: true };
    return {
      allowed: false,
      error: "Too many requests. Try again in a few minutes.",
      retryAfter: res.retryAfter ?? MAGIC_LINK_RATE_LIMIT.windowSeconds,
    };
  } catch (err) {
    // Fail closed on storage errors only; programmer bugs propagate.
    if (err instanceof RateLimitStoreError) {
      return {
        allowed: false,
        error: "Sign-in service temporarily unavailable. Please try again in a few minutes.",
        retryAfter: 60,
      };
    }
    throw err;
  }
}
