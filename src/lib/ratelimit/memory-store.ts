import type { RateLimitStore } from "./types";

export class MemoryRateLimitStore implements RateLimitStore {
  private counters = new Map<string, number>();

  async increment(bucket: string, windowStartEpochSec: number): Promise<number> {
    const key = `${bucket}:${windowStartEpochSec}`;
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }
}
