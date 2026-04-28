import { describe, it, expect, vi, beforeEach } from "vitest";

interface LedgerInsert {
  user_id: string;
  kind: string;
  tier_delta: number;
  balance_delta: number;
  source_order_id: string | null;
  source_referral_user_id: string | null;
  bucket_month?: string;
  note?: string | null;
}

interface PriorRow {
  source_order_id: string | null;
  user_id: string;
  kind: string;
  tier_delta: number;
  balance_delta: number;
  bucket_month?: string;
  source_referral_user_id?: string | null;
}

// vi.hoisted lifts state above the vi.mock factories so the mocks can
// reference it without TDZ errors.
const state = vi.hoisted(() => ({
  ledgerInserts: [] as LedgerInsert[],
  priorRows: [] as PriorRow[],
  referrerLookupResult: null as { referrer_user_id: string | null } | null,
  userRewardsBalance: 0,
  recomputeCalls: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => ({
    from: (table: string) => {
      if (table === "points_ledger") {
        return {
          select: () => ({
            eq: (_c1: string, v1: string) => ({
              eq: (c2: string, v2: string) => ({
                limit: () => ({
                  async maybeSingle() {
                    const match = state.priorRows.find(
                      (r) =>
                        r.source_order_id === v1 &&
                        (c2 === "kind" ? r.kind === v2 : true),
                    );
                    return { data: match ?? null, error: null };
                  },
                }),
                eq: (c3: string, v3: string) => ({
                  limit: () => ({
                    async maybeSingle() {
                      const match = state.priorRows.find(
                        (r) =>
                          r.user_id === v1 &&
                          r.kind === v2 &&
                          (c3 === "source_referral_user_id"
                            ? r.source_referral_user_id === v3
                            : true),
                      );
                      return { data: match ?? null, error: null };
                    },
                  }),
                }),
              }),
              in: () => ({
                async then(
                  resolve: (v: { data: PriorRow[]; error: null }) => void,
                ) {
                  resolve({ data: state.priorRows, error: null });
                },
              }),
            }),
          }),
          insert: (payload: LedgerInsert) => {
            state.ledgerInserts.push(payload);
            return { error: null };
          },
        };
      }
      if (table === "user_rewards") {
        return {
          select: () => ({
            eq: () => ({
              async maybeSingle() {
                return {
                  data: { available_balance: state.userRewardsBalance },
                  error: null,
                };
              },
            }),
          }),
        };
      }
      if (table === "referrals") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  async maybeSingle() {
                    return { data: state.referrerLookupResult, error: null };
                  },
                }),
              }),
            }),
          }),
        };
      }
      return {} as never;
    },
  }),
}));

vi.mock("@/app/actions/rewards", () => ({
  creditPoints: async (input: LedgerInsert) => {
    state.ledgerInserts.push({
      user_id: input.user_id,
      kind: input.kind,
      tier_delta: input.tier_delta,
      balance_delta: input.balance_delta,
      source_order_id: input.source_order_id ?? null,
      source_referral_user_id: input.source_referral_user_id ?? null,
    });
    return { ok: true as const };
  },
  recomputeRewards: async (userId: string) => {
    state.recomputeCalls.push(userId);
    return { ok: true as const };
  },
}));

import {
  awardPointsForFundedOrder,
  reversePointsForOrder,
} from "../order-hooks";

beforeEach(() => {
  state.ledgerInserts.length = 0;
  state.priorRows = [];
  state.referrerLookupResult = null;
  state.userRewardsBalance = 0;
  state.recomputeCalls.length = 0;
});

describe("awardPointsForFundedOrder", () => {
  it("does nothing for guest orders (no customer_user_id)", async () => {
    await awardPointsForFundedOrder({
      order_id: "ord-1",
      customer_user_id: null,
      total_cents: 10_000,
      subtotal_cents: 10_000,
    });
    expect(state.ledgerInserts).toHaveLength(0);
  });

  it("does nothing when amount is zero or negative", async () => {
    await awardPointsForFundedOrder({
      order_id: "ord-1",
      customer_user_id: "cust",
      total_cents: 0,
      subtotal_cents: 0,
    });
    expect(state.ledgerInserts).toHaveLength(0);
  });

  it("credits own-spend points based on total_cents (post-discount)", async () => {
    await awardPointsForFundedOrder({
      order_id: "ord-1",
      customer_user_id: "cust",
      total_cents: 20_000,
      subtotal_cents: 22_000,
    });
    const own = state.ledgerInserts.find((r) => r.kind === "earn_own_spend");
    expect(own).toBeDefined();
    expect(own?.user_id).toBe("cust");
    expect(own?.tier_delta).toBe(200);
    expect(own?.balance_delta).toBe(200);
    expect(own?.source_order_id).toBe("ord-1");
  });

  it("falls back to subtotal_cents when total_cents is null", async () => {
    await awardPointsForFundedOrder({
      order_id: "ord-2",
      customer_user_id: "cust",
      total_cents: null,
      subtotal_cents: 15_000,
    });
    const own = state.ledgerInserts.find((r) => r.kind === "earn_own_spend");
    expect(own?.tier_delta).toBe(150);
  });

  it("credits referrer 10× referee spend + 100pt first-order bonus when referrer present", async () => {
    await awardPointsForFundedOrder({
      order_id: "ord-3",
      customer_user_id: "cust",
      referrer_user_id: "refr",
      total_cents: 10_000,
      subtotal_cents: 10_000,
    });
    const own = state.ledgerInserts.find((r) => r.kind === "earn_own_spend");
    const ref = state.ledgerInserts.find((r) => r.kind === "earn_referee_spend");
    const bonus = state.ledgerInserts.find((r) => r.kind === "earn_referee_first");
    expect(own?.tier_delta).toBe(100);
    expect(ref?.user_id).toBe("refr");
    expect(ref?.tier_delta).toBe(1_000);
    expect(ref?.source_referral_user_id).toBe("cust");
    expect(bonus?.tier_delta).toBe(100);
    expect(bonus?.user_id).toBe("refr");
  });

  it("looks up the referrer via the referrals table when not passed in", async () => {
    state.referrerLookupResult = { referrer_user_id: "looked-up-refr" };
    await awardPointsForFundedOrder({
      order_id: "ord-4",
      customer_user_id: "cust",
      total_cents: 5_000,
      subtotal_cents: 5_000,
    });
    const ref = state.ledgerInserts.find((r) => r.kind === "earn_referee_spend");
    expect(ref?.user_id).toBe("looked-up-refr");
    expect(ref?.tier_delta).toBe(500);
  });

  it("never self-credits when referrer_user_id equals customer_user_id", async () => {
    await awardPointsForFundedOrder({
      order_id: "ord-5",
      customer_user_id: "cust",
      referrer_user_id: "cust",
      total_cents: 10_000,
      subtotal_cents: 10_000,
    });
    expect(
      state.ledgerInserts.filter((r) => r.kind === "earn_referee_spend"),
    ).toHaveLength(0);
    expect(
      state.ledgerInserts.filter((r) => r.kind === "earn_referee_first"),
    ).toHaveLength(0);
  });

  it("skips own-spend insert if a prior row exists (idempotency)", async () => {
    state.priorRows = [
      {
        source_order_id: "ord-6",
        user_id: "cust",
        kind: "earn_own_spend",
        tier_delta: 200,
        balance_delta: 200,
      },
    ];
    await awardPointsForFundedOrder({
      order_id: "ord-6",
      customer_user_id: "cust",
      total_cents: 20_000,
      subtotal_cents: 20_000,
    });
    expect(
      state.ledgerInserts.filter((r) => r.kind === "earn_own_spend"),
    ).toHaveLength(0);
  });
});

describe("reversePointsForOrder", () => {
  it("does nothing if no prior credits exist for the order", async () => {
    state.priorRows = [];
    await reversePointsForOrder("ord-x");
    expect(state.ledgerInserts).toHaveLength(0);
  });

  it("does not reverse twice — checks for existing reversal row first", async () => {
    state.priorRows = [
      {
        source_order_id: "ord-7",
        user_id: "cust",
        kind: "reversal",
        tier_delta: -200,
        balance_delta: -200,
      },
    ];
    await reversePointsForOrder("ord-7");
    expect(state.ledgerInserts).toHaveLength(0);
  });

  it("inserts a single reversal that negates own-spend earnings", async () => {
    state.priorRows = [
      {
        source_order_id: "ord-8",
        user_id: "cust",
        kind: "earn_own_spend",
        tier_delta: 200,
        balance_delta: 200,
        bucket_month: "2026-04-01",
      },
    ];
    state.userRewardsBalance = 200;
    await reversePointsForOrder("ord-8");
    expect(state.ledgerInserts).toHaveLength(1);
    expect(state.ledgerInserts[0].kind).toBe("reversal");
    expect(state.ledgerInserts[0].tier_delta).toBe(-200);
    expect(state.ledgerInserts[0].balance_delta).toBe(-200);
    expect(state.ledgerInserts[0].user_id).toBe("cust");
    expect(state.recomputeCalls).toContain("cust");
  });

  it("clamps balance reversal to current balance — no negative balance", async () => {
    state.priorRows = [
      {
        source_order_id: "ord-9",
        user_id: "cust",
        kind: "earn_own_spend",
        tier_delta: 200,
        balance_delta: 200,
        bucket_month: "2026-04-01",
      },
    ];
    state.userRewardsBalance = 50;
    await reversePointsForOrder("ord-9");
    expect(state.ledgerInserts[0].tier_delta).toBe(-200);
    expect(state.ledgerInserts[0].balance_delta).toBe(-50);
  });

  it("groups multi-user reversals (own + referrer) into separate rows", async () => {
    state.priorRows = [
      {
        source_order_id: "ord-10",
        user_id: "cust",
        kind: "earn_own_spend",
        tier_delta: 100,
        balance_delta: 100,
        bucket_month: "2026-04-01",
      },
      {
        source_order_id: "ord-10",
        user_id: "refr",
        kind: "earn_referee_spend",
        tier_delta: 1000,
        balance_delta: 1000,
        bucket_month: "2026-04-01",
      },
      {
        source_order_id: "ord-10",
        user_id: "refr",
        kind: "earn_referee_first",
        tier_delta: 100,
        balance_delta: 100,
        bucket_month: "2026-04-01",
      },
    ];
    state.userRewardsBalance = 9999;
    await reversePointsForOrder("ord-10");
    expect(state.ledgerInserts).toHaveLength(2);
    const custRev = state.ledgerInserts.find((r) => r.user_id === "cust");
    const refrRev = state.ledgerInserts.find((r) => r.user_id === "refr");
    expect(custRev?.tier_delta).toBe(-100);
    expect(refrRev?.tier_delta).toBe(-1100);
  });
});
