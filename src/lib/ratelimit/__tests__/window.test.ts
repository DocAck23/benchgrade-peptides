import { describe, it, expect, beforeEach } from "vitest";
import { checkAndIncrement } from "../window";
import { MemoryRateLimitStore } from "../memory-store";
import type { RateLimitStore } from "../types";

describe("checkAndIncrement — fixed-window limiter", () => {
  let store: MemoryRateLimitStore;
  beforeEach(() => {
    store = new MemoryRateLimitStore();
  });

  it("allows the first call", async () => {
    const res = await checkAndIncrement({
      bucket: "ip:1.2.3.4",
      limit: 5,
      windowSeconds: 3600,
      store,
      nowEpochSec: 1_000_000,
    });
    expect(res.allowed).toBe(true);
    expect(res.count).toBe(1);
    expect(res.retryAfter).toBeUndefined();
  });

  it("allows calls up to and including the limit", async () => {
    const args = { bucket: "ip:1.2.3.4", limit: 3, windowSeconds: 60, store, nowEpochSec: 1_000_000 };
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await checkAndIncrement(args));
    expect(results.every((r) => r.allowed)).toBe(true);
    expect(results.map((r) => r.count)).toEqual([1, 2, 3]);
  });

  it("blocks calls past the limit with a retryAfter > 0", async () => {
    const args = { bucket: "ip:1.2.3.4", limit: 2, windowSeconds: 60, store, nowEpochSec: 1_000_030 };
    await checkAndIncrement(args);
    await checkAndIncrement(args);
    const blocked = await checkAndIncrement(args);
    expect(blocked.allowed).toBe(false);
    expect(blocked.count).toBe(3);
    // nowEpochSec=1_000_030 with windowSeconds=60 → windowStart=999_960, windowEnd=1_000_020.
    // Wait that's in the past. Let me redo: 1_000_030 / 60 = 16667.166..., floor = 16667, *60 = 1_000_020. windowEnd = 1_000_080. retry = 50.
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it("allows calls again after the window rolls over", async () => {
    const bucket = "ip:1.2.3.4";
    const windowSeconds = 60;
    const store = new MemoryRateLimitStore();

    // Fill the first window
    for (let i = 0; i < 3; i++) {
      await checkAndIncrement({ bucket, limit: 2, windowSeconds, store, nowEpochSec: 1_000_000 });
    }
    // Advance past window boundary
    const fresh = await checkAndIncrement({
      bucket,
      limit: 2,
      windowSeconds,
      store,
      nowEpochSec: 1_000_000 + windowSeconds + 1,
    });
    expect(fresh.allowed).toBe(true);
    expect(fresh.count).toBe(1);
  });

  it("propagates store errors so the caller can decide fail-open vs fail-closed", async () => {
    const broken: RateLimitStore = {
      async increment() {
        throw new Error("db down");
      },
    };
    await expect(
      checkAndIncrement({
        bucket: "ip:1.2.3.4",
        limit: 5,
        windowSeconds: 60,
        store: broken,
      })
    ).rejects.toThrow("db down");
  });

  it("rejects non-positive limit and window", async () => {
    await expect(
      checkAndIncrement({ bucket: "x", limit: 0, windowSeconds: 60, store })
    ).rejects.toThrow();
    await expect(
      checkAndIncrement({ bucket: "x", limit: 5, windowSeconds: 0, store })
    ).rejects.toThrow();
  });

  it("isolates counters by bucket", async () => {
    const args = { limit: 1, windowSeconds: 60, store, nowEpochSec: 1_000_000 };
    const a = await checkAndIncrement({ ...args, bucket: "ip:a" });
    const b = await checkAndIncrement({ ...args, bucket: "ip:b" });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });
});
