import { describe, it, expect, vi } from "vitest";
import { SupabaseRateLimitStore } from "../supabase-store";

function makeSupaMock(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(response);
  return { rpc } as unknown as ConstructorParameters<typeof SupabaseRateLimitStore>[0];
}

describe("SupabaseRateLimitStore", () => {
  it("calls the increment_rate_limit RPC with bucket + window", async () => {
    const supa = makeSupaMock({ data: 3, error: null });
    const store = new SupabaseRateLimitStore(supa);
    const result = await store.increment("ip:1.2.3.4", 1_000_000);
    expect(result).toBe(3);
    // biome-ignore lint/suspicious/noExplicitAny: checking the mock call args
    const rpcMock = (supa as unknown as { rpc: any }).rpc;
    expect(rpcMock).toHaveBeenCalledWith("increment_rate_limit", {
      p_bucket: "ip:1.2.3.4",
      p_window_start: 1_000_000,
    });
  });

  it("throws if the RPC returns an error", async () => {
    const supa = makeSupaMock({ data: null, error: { message: "permission denied" } });
    const store = new SupabaseRateLimitStore(supa);
    await expect(store.increment("x", 0)).rejects.toThrow(/permission denied/);
  });

  it("throws if the RPC returns a non-numeric result", async () => {
    const supa = makeSupaMock({ data: "not a number", error: null });
    const store = new SupabaseRateLimitStore(supa);
    await expect(store.increment("x", 0)).rejects.toThrow(/non-numeric/);
  });

  it("throws if the RPC returns null data and null error", async () => {
    const supa = makeSupaMock({ data: null, error: null });
    const store = new SupabaseRateLimitStore(supa);
    await expect(store.increment("x", 0)).rejects.toThrow();
  });
});
