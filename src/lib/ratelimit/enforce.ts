import type { RateLimitStore } from "./types";
import { checkAndIncrement } from "./window";
import { RateLimitStoreError } from "./supabase-store";

export const ORDER_RATE_LIMIT = {
  limit: 5,
  windowSeconds: 3600,
} as const;

export type EnforceResult =
  | { allowed: true }
  | { allowed: false; error: string; retryAfter: number };

export async function enforceOrderRateLimit(
  store: RateLimitStore,
  ip: string,
  nowEpochSec?: number
): Promise<EnforceResult> {
  try {
    const res = await checkAndIncrement({
      bucket: `order:${ip}`,
      limit: ORDER_RATE_LIMIT.limit,
      windowSeconds: ORDER_RATE_LIMIT.windowSeconds,
      store,
      nowEpochSec,
    });
    if (res.allowed) return { allowed: true };
    return {
      allowed: false,
      error: `Too many submissions. Please try again in a few minutes.`,
      retryAfter: res.retryAfter ?? ORDER_RATE_LIMIT.windowSeconds,
    };
  } catch (err) {
    // Fail closed on store errors only. Programmer bugs (TypeError,
    // ReferenceError, etc.) must propagate so they surface in logs
    // instead of degrading silently into "service unavailable".
    if (err instanceof RateLimitStoreError) {
      return {
        allowed: false,
        error: "Order service temporarily unavailable. Please try again in a few minutes.",
        retryAfter: 60,
      };
    }
    throw err;
  }
}
