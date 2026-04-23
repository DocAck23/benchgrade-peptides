import { describe, it, expect } from "vitest";
import { enforceOrderRateLimit, ORDER_RATE_LIMIT } from "../enforce";
import { MemoryRateLimitStore } from "../memory-store";
import { RateLimitStoreError } from "../supabase-store";
import type { RateLimitStore } from "../types";

describe("enforceOrderRateLimit", () => {
  it("allows up to the configured limit from a single IP", async () => {
    const store = new MemoryRateLimitStore();
    const now = 1_000_000;
    for (let i = 0; i < ORDER_RATE_LIMIT.limit; i++) {
      const res = await enforceOrderRateLimit(store, "1.2.3.4", now);
      expect(res.allowed).toBe(true);
    }
  });

  it("blocks the (limit+1)th submission and includes retryAfter matching window end", async () => {
    const store = new MemoryRateLimitStore();
    const windowSeconds = ORDER_RATE_LIMIT.windowSeconds;
    // Pick `now` 30 seconds into a window boundary so retryAfter math is deterministic.
    const windowStart = 1_000_000 - (1_000_000 % windowSeconds);
    const now = windowStart + 30;
    const expectedRetry = windowSeconds - 30;
    for (let i = 0; i < ORDER_RATE_LIMIT.limit; i++) {
      await enforceOrderRateLimit(store, "1.2.3.4", now);
    }
    const blocked = await enforceOrderRateLimit(store, "1.2.3.4", now);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfter).toBe(expectedRetry);
      expect(blocked.error).toMatch(/too many/i);
    }
  });

  it("fails closed only on store errors (RateLimitStoreError), not on programmer errors", async () => {
    const storeThatRaisesStoreError: RateLimitStore = {
      async increment() {
        throw new RateLimitStoreError("supabase down");
      },
    };
    const res = await enforceOrderRateLimit(storeThatRaisesStoreError, "1.2.3.4", 1_000_000);
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.error).toMatch(/unavailable|try again/i);
    }
  });

  it("re-throws non-store errors (programmer bugs) so they surface as 500s", async () => {
    const storeThatRaisesProgrammerError: RateLimitStore = {
      async increment() {
        throw new TypeError("cannot read property of undefined");
      },
    };
    await expect(
      enforceOrderRateLimit(storeThatRaisesProgrammerError, "1.2.3.4", 1_000_000)
    ).rejects.toThrow(TypeError);
  });

  it("treats 'unknown' IP as a single shared bucket (conservative)", async () => {
    const store = new MemoryRateLimitStore();
    const now = 1_000_000;
    for (let i = 0; i < ORDER_RATE_LIMIT.limit; i++) {
      await enforceOrderRateLimit(store, "unknown", now);
    }
    const blocked = await enforceOrderRateLimit(store, "unknown", now);
    expect(blocked.allowed).toBe(false);
  });

  it("does not share buckets across distinct IPs", async () => {
    const store = new MemoryRateLimitStore();
    const now = 1_000_000;
    for (let i = 0; i < ORDER_RATE_LIMIT.limit; i++) {
      await enforceOrderRateLimit(store, "1.1.1.1", now);
    }
    const other = await enforceOrderRateLimit(store, "2.2.2.2", now);
    expect(other.allowed).toBe(true);
  });

  it("namespaces bucket with 'order:' so future limiters don't collide", async () => {
    const calls: Array<[string, number]> = [];
    const spyStore: RateLimitStore = {
      async increment(bucket, windowStart) {
        calls.push([bucket, windowStart]);
        return 1;
      },
    };
    await enforceOrderRateLimit(spyStore, "1.2.3.4", 1_000_000);
    expect(calls[0][0]).toBe("order:1.2.3.4");
  });
});
