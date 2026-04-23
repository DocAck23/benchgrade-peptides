export interface RateLimitStore {
  /**
   * Atomically increment the counter for (bucket, windowStart) and
   * return the resulting count. Implementations must be race-safe.
   */
  increment(bucket: string, windowStartEpochSec: number): Promise<number>;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window rolls over, iff blocked. */
  retryAfter?: number;
  /** Current count within the window; included for observability. */
  count: number;
}
