import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks. generateMyReferralCode reads via cookie-scoped client (auth check)
// then INSERTs via service-role (RLS deny-by-default for inserts).
// claimReferralOnOrder is service-role only — invoked from inside submitOrder.
// redeemFreeVialEntitlement is cookie-scoped — RLS gates ownership.
// ---------------------------------------------------------------------------

const cookieFrom = vi.fn();
const cookieGetUser = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createServerSupabase: async () => ({
    from: cookieFrom,
    auth: { getUser: cookieGetUser },
  }),
}));

const serviceFrom = vi.fn();
const adminGetUserById = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => ({
    from: serviceFrom,
    auth: { admin: { getUserById: adminGetUserById } },
  }),
}));

import {
  generateMyReferralCode,
  claimReferralOnOrder,
  redeemFreeVialEntitlement,
} from "../referrals";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const ENT_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  cookieFrom.mockReset();
  cookieGetUser.mockReset();
  serviceFrom.mockReset();
  adminGetUserById.mockReset();
});

describe("generateMyReferralCode (I-REF-4 RLS pre-check, code minting)", () => {
  it("returns existing code if user already has one", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    cookieFrom.mockImplementation((table: string) => {
      expect(table).toBe("referral_codes");
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { code: "ABCD123", owner_user_id: USER_ID },
              error: null,
            })),
          })),
        })),
      };
    });
    const res = await generateMyReferralCode();
    expect(res.ok).toBe(true);
    expect(res.code).toBe("ABCD123");
    // Service-role insert never called.
    expect(serviceFrom).not.toHaveBeenCalled();
  });

  it("mints a new code and INSERTs via service-role when none exists", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    cookieFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    }));
    let insertPayload: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation((table: string) => {
      expect(table).toBe("referral_codes");
      return {
        insert: vi.fn((payload: Record<string, unknown>) => {
          insertPayload = payload;
          return Promise.resolve({ data: null, error: null });
        }),
      };
    });

    const res = await generateMyReferralCode();
    expect(res.ok).toBe(true);
    expect(res.code).toBeTruthy();
    expect(/^[A-Z0-9]{4,12}$/.test(res.code!)).toBe(true);
    expect(insertPayload!.owner_user_id).toBe(USER_ID);
  });

  it("unauthenticated → error, no DB", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await generateMyReferralCode();
    expect(res.ok).toBe(false);
    expect(cookieFrom).not.toHaveBeenCalled();
  });
});

describe("claimReferralOnOrder (I-REF-1, I-REF-3, I-CHECKOUT-REF-1)", () => {
  it("happy path → links order, returns ten_percent_off_applied=true", async () => {
    let insertedReferral: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation((table: string) => {
      if (table === "referral_codes") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { code: "GOODCODE", owner_user_id: "owner-uuid" },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "orders") {
        // First-time-buyer guard: count of prior orders for this email.
        return {
          select: vi.fn(() => ({
            ilike: vi.fn(async () => ({ data: [], count: 0, error: null })),
          })),
        };
      }
      if (table === "referrals") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            insertedReferral = payload;
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    adminGetUserById.mockResolvedValue({
      data: { user: { id: "owner-uuid", email: "owner@example.com" } },
      error: null,
    });

    const res = await claimReferralOnOrder({
      customer_email: "newbie@example.com",
      cookie_code: "GOODCODE",
      order_id: ORDER_ID,
    });
    expect(res.ok).toBe(true);
    expect(res.ten_percent_off_applied).toBe(true);
    expect(insertedReferral!.code).toBe("GOODCODE");
    expect(insertedReferral!.referee_email).toBe("newbie@example.com");
    expect(insertedReferral!.first_order_id).toBe(ORDER_ID);
    expect(insertedReferral!.status).toBe("pending");
  });

  it("I-REF-3: self-referral blocked silently (case-insensitive)", async () => {
    serviceFrom.mockImplementation((table: string) => {
      if (table === "referral_codes") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { code: "SELFER", owner_user_id: "owner-uuid" },
                error: null,
              })),
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    adminGetUserById.mockResolvedValue({
      data: { user: { id: "owner-uuid", email: "Owner@Example.com" } },
      error: null,
    });

    const res = await claimReferralOnOrder({
      customer_email: "owner@example.com",
      cookie_code: "SELFER",
      order_id: ORDER_ID,
    });
    expect(res.ok).toBe(true);
    expect(res.ten_percent_off_applied).toBe(false);
  });

  it("repeat-buyer → no discount", async () => {
    serviceFrom.mockImplementation((table: string) => {
      if (table === "referral_codes") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { code: "GOODCODE", owner_user_id: "owner-uuid" },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            ilike: vi.fn(async () => ({
              data: [{ order_id: "x" }],
              count: 1,
              error: null,
            })),
          })),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    adminGetUserById.mockResolvedValue({
      data: { user: { id: "owner-uuid", email: "owner@example.com" } },
      error: null,
    });

    const res = await claimReferralOnOrder({
      customer_email: "newbie@example.com",
      cookie_code: "GOODCODE",
      order_id: ORDER_ID,
    });
    expect(res.ok).toBe(true);
    expect(res.ten_percent_off_applied).toBe(false);
  });

  it("unknown code → no discount", async () => {
    serviceFrom.mockImplementation((table: string) => {
      if (table === "referral_codes") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    const res = await claimReferralOnOrder({
      customer_email: "newbie@example.com",
      cookie_code: "BOGUSCO",
      order_id: ORDER_ID,
    });
    expect(res.ok).toBe(true);
    expect(res.ten_percent_off_applied).toBe(false);
  });

  it("null cookie_code → no discount, no DB", async () => {
    const res = await claimReferralOnOrder({
      customer_email: "newbie@example.com",
      cookie_code: null,
      order_id: ORDER_ID,
    });
    expect(res.ok).toBe(true);
    expect(res.ten_percent_off_applied).toBe(false);
    expect(serviceFrom).not.toHaveBeenCalled();
  });
});

describe("redeemFreeVialEntitlement (I-ENTITLEMENT-1)", () => {
  it("atomic UPDATE: status='redeemed' filtered on status='available' AND owner", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    let updatePayload: Record<string, unknown> | null = null;
    const select = vi.fn(async () => ({
      data: [{ id: ENT_ID }],
      error: null,
    }));
    // Builder for UPDATE on free_vial_entitlements
    const eq3 = vi.fn(() => ({ select }));
    const eq2 = vi.fn(() => ({ eq: eq3 }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    cookieFrom.mockImplementation((table: string) => {
      if (table === "free_vial_entitlements") {
        // First call: SELECT to validate size_mg matches selected_sku.
        // Second call: UPDATE.
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: ENT_ID, size_mg: 5, status: "available" },
                error: null,
              })),
            })),
          })),
          update: vi.fn((payload: Record<string, unknown>) => {
            updatePayload = payload;
            return { eq: eq1 };
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    // BGP-GLP1S-5 is a 5mg vial in the catalog.
    const res = await redeemFreeVialEntitlement({
      entitlement_id: ENT_ID,
      selected_sku: "BGP-GLP1S-5",
      order_id: ORDER_ID,
    });
    expect(res.ok).toBe(true);
    expect(updatePayload!.status).toBe("redeemed");
    expect(updatePayload!.redeemed_order_id).toBe(ORDER_ID);
    expect(typeof updatePayload!.redeemed_at).toBe("string");
  });

  it("unauthenticated → error", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await redeemFreeVialEntitlement({
      entitlement_id: ENT_ID,
      selected_sku: "BGP-GLP1S-5",
      order_id: ORDER_ID,
    });
    expect(res.ok).toBe(false);
  });

  it("size mismatch → rejected before UPDATE", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    const updateSpy = vi.fn();
    cookieFrom.mockImplementation((table: string) => {
      if (table === "free_vial_entitlements") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: ENT_ID, size_mg: 10, status: "available" },
                error: null,
              })),
            })),
          })),
          update: updateSpy,
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    // Customer picked a 5mg vial but entitlement is for 10mg.
    const res = await redeemFreeVialEntitlement({
      entitlement_id: ENT_ID,
      selected_sku: "BGP-GLP1S-5",
      order_id: ORDER_ID,
    });
    expect(res.ok).toBe(false);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rowcount=0 → 'not available' error", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    const select = vi.fn(async () => ({ data: [], error: null }));
    const eq3 = vi.fn(() => ({ select }));
    const eq2 = vi.fn(() => ({ eq: eq3 }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    cookieFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { id: ENT_ID, size_mg: 5, status: "available" },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({ eq: eq1 })),
    }));
    const res = await redeemFreeVialEntitlement({
      entitlement_id: ENT_ID,
      selected_sku: "BGP-GLP1S-5",
      order_id: ORDER_ID,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not available/i);
  });
});
