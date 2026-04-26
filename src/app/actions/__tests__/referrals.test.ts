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

const sendReferralEarnedMock = vi.fn(async (_a: unknown, _b: unknown) => ({
  ok: true,
}));
vi.mock("@/lib/email/notifications/send-referral-emails", () => ({
  sendReferralEarned: (a: unknown, b: unknown) => sendReferralEarnedMock(a, b),
}));

import {
  generateMyReferralCode,
  claimReferralOnOrder,
  redeemFreeVialEntitlement,
  transitionReferralOnShipped,
} from "../referrals";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const ENT_ID = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  cookieFrom.mockReset();
  cookieGetUser.mockReset();
  serviceFrom.mockReset();
  adminGetUserById.mockReset();
  sendReferralEarnedMock.mockReset().mockResolvedValue({ ok: true });
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
        // First-time-buyer guard: count of prior orders for this email,
        // excluding the current order_id (codex H4 fix).
        return {
          select: vi.fn(() => ({
            ilike: vi.fn(() => ({
              neq: vi.fn(async () => ({ data: [], count: 0, error: null })),
            })),
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
            ilike: vi.fn(() => ({
              neq: vi.fn(async () => ({
                data: [{ order_id: "x" }],
                count: 1,
                error: null,
              })),
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

// ---------------------------------------------------------------------------
// transitionReferralOnShipped — codex review #3 H5
// ---------------------------------------------------------------------------
describe("transitionReferralOnShipped (codex H5)", () => {
  it("flips pending → shipped, mints free-vial entitlement for non-affiliate referrer", async () => {
    let updatedRefStatus: Record<string, unknown> | null = null;
    let entitlementInsert: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation((table: string) => {
      if (table === "referrals") {
        return {
          select: vi.fn((_cols: string, opts?: { count?: string }) => {
            if (opts?.count === "exact") {
              return {
                eq: vi.fn(() => ({
                  in: vi.fn(() =>
                    Promise.resolve({ data: [], count: 1, error: null })
                  ),
                })),
              };
            }
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "ref-1",
                      referrer_user_id: "referrer-uuid",
                      status: "pending",
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }),
          update: vi.fn((p: Record<string, unknown>) => {
            updatedRefStatus = p;
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(async () => ({
                    data: [{ id: "ref-1" }],
                    error: null,
                  })),
                })),
              })),
            };
          }),
        };
      }
      if (table === "affiliates") {
        // Referrer is NOT an affiliate.
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        };
      }
      if (table === "free_vial_entitlements") {
        return {
          insert: vi.fn((p: Record<string, unknown>) => {
            entitlementInsert = p;
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: "ent-1" },
                  error: null,
                })),
              })),
            };
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    adminGetUserById.mockResolvedValue({
      data: { user: { id: "referrer-uuid", email: "referrer@example.com" } },
      error: null,
    });

    // Inject a referee_email lookup mock by reusing the referrals select
    // path (the second .maybeSingle on referrals).
    const res = await transitionReferralOnShipped(ORDER_ID);
    expect(res.ok).toBe(true);
    expect(res.entitlement_id).toBe("ent-1");
    expect(updatedRefStatus!.status).toBe("shipped");
    expect(entitlementInsert!.customer_user_id).toBe("referrer-uuid");
    expect(entitlementInsert!.size_mg).toBe(5);
    expect(entitlementInsert!.source).toBe("referral");
    expect(entitlementInsert!.source_referral_id).toBe("ref-1");
    expect(entitlementInsert!.status).toBe("available");
  });

  it("affiliate referrer → no entitlement, no double-dip", async () => {
    let entitlementInsertCalled = false;
    serviceFrom.mockImplementation((table: string) => {
      if (table === "referrals") {
        return {
          select: vi.fn((_cols: string, opts?: { count?: string }) => {
            if (opts?.count === "exact") {
              return {
                eq: vi.fn(() => ({
                  in: vi.fn(() =>
                    Promise.resolve({ data: [], count: 1, error: null })
                  ),
                })),
              };
            }
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: "ref-1",
                      referrer_user_id: "referrer-uuid",
                      status: "pending",
                    },
                    error: null,
                  })),
                })),
              })),
            };
          }),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(async () => ({
                  data: [{ id: "ref-1" }],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === "affiliates") {
        // Referrer IS an affiliate.
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: { id: "aff-1" },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "free_vial_entitlements") {
        entitlementInsertCalled = true;
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    adminGetUserById.mockResolvedValue({
      data: { user: { id: "referrer-uuid", email: "referrer@example.com" } },
      error: null,
    });

    const res = await transitionReferralOnShipped(ORDER_ID);
    expect(res.ok).toBe(true);
    expect(res.entitlement_id).toBeUndefined();
    expect(entitlementInsertCalled).toBe(false);
  });

  it("idempotent: no pending referral → ok no-op", async () => {
    serviceFrom.mockImplementation((table: string) => {
      if (table === "referrals") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
          })),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    const res = await transitionReferralOnShipped(ORDER_ID);
    expect(res.ok).toBe(true);
    expect(res.entitlement_id).toBeUndefined();
  });
});
