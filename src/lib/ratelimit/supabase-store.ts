import type { SupabaseClient } from "@supabase/supabase-js";
import type { RateLimitStore } from "./types";

/**
 * Narrow, named error thrown only by rate-limit storage failures.
 * Lets `enforceOrderRateLimit` fail closed on genuine store problems
 * while letting programmer errors (TypeError, etc.) propagate as bugs.
 */
export class RateLimitStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitStoreError";
  }
}

export class SupabaseRateLimitStore implements RateLimitStore {
  constructor(private supa: Pick<SupabaseClient, "rpc">) {}

  async increment(bucket: string, windowStartEpochSec: number): Promise<number> {
    const { data, error } = await this.supa.rpc("increment_rate_limit", {
      p_bucket: bucket,
      p_window_start: windowStartEpochSec,
    });
    if (error) throw new RateLimitStoreError(`rate limit store error: ${error.message}`);
    if (typeof data !== "number") {
      throw new RateLimitStoreError("increment_rate_limit returned non-numeric result");
    }
    return data;
  }
}
