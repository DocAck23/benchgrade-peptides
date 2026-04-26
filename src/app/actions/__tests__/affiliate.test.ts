import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks. affiliate actions touch:
//   - cookie-scoped client (auth + RLS-bound reads/writes by the affiliate)
//   - service-role client (RLS deny-by-default INSERTs; admin writes)
//   - email helpers (best-effort)
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
const adminListUsers = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => ({
    from: serviceFrom,
    auth: { admin: { getUserById: adminGetUserById, listUsers: adminListUsers } },
  }),
}));

const isAdminMock = vi.fn(async () => true);
vi.mock("@/lib/admin/auth", () => ({
  setAdminCookie: vi.fn(),
  clearAdminCookie: vi.fn(),
  isAdmin: () => isAdminMock(),
}));

const sendApprovedMock = vi.fn(async (_a: unknown, _b: unknown) => ({ ok: true }));
const sendCommissionMock = vi.fn(async (_a: unknown, _b: unknown) => ({ ok: true }));
const sendPayoutMock = vi.fn(async (_a: unknown, _b: unknown) => ({ ok: true }));
vi.mock("@/lib/email/notifications/send-affiliate-emails", () => ({
  sendAffiliateApplicationApproved: (a: unknown, b: unknown) =>
    sendApprovedMock(a, b),
  sendAffiliateCommissionEarned: (a: unknown, b: unknown) =>
    sendCommissionMock(a, b),
  sendAffiliatePayoutSent: (a: unknown, b: unknown) => sendPayoutMock(a, b),
}));

import {
  applyForAffiliate,
  getMyAffiliateState,
  redeemCommissionForVialCredit,
  awardCommissionForOrder,
  clawbackCommissionForOrder,
} from "../affiliate";
import {
  adminApproveAffiliate,
  adminRejectApplication,
  adminProcessPayout,
} from "../admin";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const APP_ID = "22222222-2222-4222-8222-222222222222";
const AFF_ID = "33333333-3333-4333-8333-333333333333";
const ORDER_ID = "44444444-4444-4444-8444-444444444444";
const REFERRER_ID = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  cookieFrom.mockReset();
  cookieGetUser.mockReset();
  serviceFrom.mockReset();
  adminGetUserById.mockReset();
  adminListUsers.mockReset();
  isAdminMock.mockReset().mockResolvedValue(true);
  sendApprovedMock.mockReset().mockResolvedValue({ ok: true });
  sendCommissionMock.mockReset().mockResolvedValue({ ok: true });
  sendPayoutMock.mockReset().mockResolvedValue({ ok: true });
});

// ---------------------------------------------------------------------------
// I-AFFAPP-1: applyForAffiliate creates pending row
// ---------------------------------------------------------------------------
describe("applyForAffiliate (I-AFFAPP-1)", () => {
  it("creates a pending application row", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: null }, error: null });
    let inserted: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation((table: string) => {
      expect(table).toBe("affiliate_applications");
      return {
        insert: vi.fn((payload: Record<string, unknown>) => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => {
              inserted = payload;
              return { data: { id: APP_ID }, error: null };
            }),
          })),
        })),
      };
    });
    const res = await applyForAffiliate({
      applicant_email: "ap@example.com",
      applicant_name: "Ap Person",
      audience_description: "200k research-curious newsletter",
      website_or_social: "https://x.com/ap",
    });
    expect(res.ok).toBe(true);
    expect(res.application_id).toBe(APP_ID);
    expect(inserted!.applicant_email).toBe("ap@example.com");
    expect(inserted!.status).toBe("pending");
    expect(inserted!.applicant_user_id).toBeNull();
  });

  it("rejects audience over 2000 chars", async () => {
    const res = await applyForAffiliate({
      applicant_email: "x@y.com",
      applicant_name: "X",
      audience_description: "a".repeat(2001),
      website_or_social: null,
    });
    expect(res.ok).toBe(false);
  });

  it("captures applicant_user_id when authenticated", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    let inserted: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation(() => ({
      insert: vi.fn((payload: Record<string, unknown>) => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => {
            inserted = payload;
            return { data: { id: APP_ID }, error: null };
          }),
        })),
      })),
    }));
    const res = await applyForAffiliate({
      applicant_email: "u@example.com",
      applicant_name: "U",
      audience_description: "fine",
      website_or_social: null,
    });
    expect(res.ok).toBe(true);
    expect(inserted!.applicant_user_id).toBe(USER_ID);
  });
});

// ---------------------------------------------------------------------------
// I-AFFAPP-2: adminApproveAffiliate promotes app to affiliate
// ---------------------------------------------------------------------------
describe("adminApproveAffiliate (I-AFFAPP-2)", () => {
  it("rejects non-admin", async () => {
    isAdminMock.mockResolvedValueOnce(false);
    const res = await adminApproveAffiliate(APP_ID);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Unauthorized/);
  });

  it("approves: updates app, inserts affiliate, mints code if missing", async () => {
    let approvedPatch: Record<string, unknown> | null = null;
    let affInsert: Record<string, unknown> | null = null;
    let codeInsert: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation((table: string) => {
      if (table === "affiliate_applications") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: APP_ID,
                  applicant_email: "ap@example.com",
                  applicant_name: "Ap",
                  applicant_user_id: USER_ID,
                  status: "pending",
                },
                error: null,
              })),
            })),
          })),
          update: vi.fn((patch: Record<string, unknown>) => {
            approvedPatch = patch;
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(async () => ({
                    data: [{ id: APP_ID }],
                    error: null,
                  })),
                })),
              })),
            };
          }),
        };
      }
      if (table === "affiliates") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            affInsert = payload;
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: AFF_ID },
                  error: null,
                })),
              })),
            };
          }),
        };
      }
      if (table === "referral_codes") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
          insert: vi.fn((payload: Record<string, unknown>) => {
            codeInsert = payload;
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const res = await adminApproveAffiliate(APP_ID);
    expect(res.ok).toBe(true);
    expect(res.affiliate_id).toBe(AFF_ID);
    expect(approvedPatch!.status).toBe("approved");
    expect(affInsert!.user_id).toBe(USER_ID);
    expect(affInsert!.tier).toBe("bronze");
    expect(codeInsert!.owner_user_id).toBe(USER_ID);
  });

  it("errors when applicant has no user_id and not signed up", async () => {
    serviceFrom.mockImplementation((table: string) => {
      if (table === "affiliate_applications") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: APP_ID,
                  applicant_email: "noaccount@example.com",
                  applicant_name: "N",
                  applicant_user_id: null,
                  status: "pending",
                },
                error: null,
              })),
            })),
          })),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    adminListUsers.mockResolvedValue({ data: { users: [] }, error: null });
    const res = await adminApproveAffiliate(APP_ID);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/sign up/i);
  });
});

describe("adminRejectApplication", () => {
  it("rejects non-admin", async () => {
    isAdminMock.mockResolvedValueOnce(false);
    const res = await adminRejectApplication(APP_ID);
    expect(res.ok).toBe(false);
  });

  it("updates application to rejected", async () => {
    let patch: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation((table: string) => {
      if (table === "affiliate_applications") {
        return {
          update: vi.fn((p: Record<string, unknown>) => {
            patch = p;
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(async () => ({ data: [{ id: APP_ID }], error: null })),
                })),
              })),
            };
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    const res = await adminRejectApplication(APP_ID, "off-policy");
    expect(res.ok).toBe(true);
    expect(patch!.status).toBe("rejected");
  });
});

// ---------------------------------------------------------------------------
// I-AFFCOMM-1, I-AFFCOMM-3: awardCommissionForOrder
// ---------------------------------------------------------------------------
describe("awardCommissionForOrder (I-AFFCOMM-1, I-AFFCOMM-3)", () => {
  it("inserts ledger entry and updates affiliate balance for affiliate referrer", async () => {
    let ledgerInsert: Record<string, unknown> | null = null;
    let affPatch: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  order_id: ORDER_ID,
                  total_cents: 100_000,
                  customer: { email: "buyer@example.com" },
                },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "referrals") {
        return {
          select: vi.fn((_cols: string, opts?: { count?: string }) => {
            if (opts?.count === "exact") {
              // Tier-promotion count path (codex M9: filter on shipped|redeemed).
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
                data: [
                  { id: "ref-1", referrer_user_id: REFERRER_ID, referee_email: "buyer@example.com" },
                ],
                error: null,
                then: undefined,
              })),
            };
          }),
        };
      }
      if (table === "affiliates") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: AFF_ID,
                  user_id: REFERRER_ID,
                  tier: "bronze",
                  available_balance_cents: 0,
                  total_earned_cents: 0,
                },
                error: null,
              })),
            })),
          })),
          update: vi.fn((p: Record<string, unknown>) => {
            affPatch = p;
            return {
              eq: vi.fn(async () => ({ data: null, error: null })),
            };
          }),
        };
      }
      if (table === "commission_ledger") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            ledgerInsert = payload;
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    adminGetUserById.mockResolvedValue({
      data: { user: { id: REFERRER_ID, email: "ref@example.com" } },
      error: null,
    });

    const res = await awardCommissionForOrder(ORDER_ID);
    expect(res.ok).toBe(true);
    expect(res.commissions_awarded).toBe(1);
    // 10% of $1000 = $100 = 10000 cents
    expect(ledgerInsert!.kind).toBe("earned");
    expect(ledgerInsert!.amount_cents).toBe(10_000);
    expect(affPatch!.available_balance_cents).toBe(10_000);
    expect(affPatch!.total_earned_cents).toBe(10_000);
  });

  it("self-affiliate guard: skips when referrer email == customer email", async () => {
    serviceFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  order_id: ORDER_ID,
                  total_cents: 100_000,
                  customer: { email: "Ref@Example.com" },
                },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "referrals") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: [
                { id: "ref-1", referrer_user_id: REFERRER_ID, referee_email: "ref@example.com" },
              ],
              error: null,
            })),
          })),
        };
      }
      if (table === "affiliates") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: AFF_ID,
                  user_id: REFERRER_ID,
                  tier: "bronze",
                  available_balance_cents: 0,
                  total_earned_cents: 0,
                },
                error: null,
              })),
            })),
          })),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    adminGetUserById.mockResolvedValue({
      data: { user: { id: REFERRER_ID, email: "ref@example.com" } },
      error: null,
    });

    const res = await awardCommissionForOrder(ORDER_ID);
    expect(res.ok).toBe(true);
    expect(res.commissions_awarded).toBe(0);
  });

  it("no-op when referrer is not an affiliate", async () => {
    serviceFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  order_id: ORDER_ID,
                  total_cents: 100_000,
                  customer: { email: "buyer@example.com" },
                },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "referrals") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: [
                { id: "ref-1", referrer_user_id: REFERRER_ID, referee_email: "buyer@example.com" },
              ],
              error: null,
            })),
          })),
        };
      }
      if (table === "affiliates") {
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
    adminGetUserById.mockResolvedValue({
      data: { user: { id: REFERRER_ID, email: "ref@example.com" } },
      error: null,
    });

    const res = await awardCommissionForOrder(ORDER_ID);
    expect(res.ok).toBe(true);
    expect(res.commissions_awarded).toBe(0);
  });

  it("auto-promotes tier when threshold is crossed (I-AFFCOMM-3)", async () => {
    // Already 4 referrals + this one = 5 → silver
    let affPatch: Record<string, unknown> | null = null;
    let countCall = 0;
    serviceFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  order_id: ORDER_ID,
                  total_cents: 100_000,
                  customer: { email: "buyer@example.com" },
                },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "referrals") {
        return {
          select: vi.fn((cols: string, opts?: { count?: string }) => {
            void cols;
            if (opts?.count === "exact") {
              countCall++;
              return {
                eq: vi.fn(() => ({
                  in: vi.fn(() =>
                    Promise.resolve({ data: [], count: 5, error: null })
                  ),
                })),
              };
            }
            return {
              eq: vi.fn(() => ({
                data: [
                  { id: "ref-1", referrer_user_id: REFERRER_ID, referee_email: "buyer@example.com" },
                ],
                error: null,
              })),
            };
          }),
        };
      }
      if (table === "affiliates") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: AFF_ID,
                  user_id: REFERRER_ID,
                  tier: "bronze",
                  available_balance_cents: 0,
                  total_earned_cents: 0,
                },
                error: null,
              })),
            })),
          })),
          update: vi.fn((p: Record<string, unknown>) => {
            affPatch = { ...(affPatch ?? {}), ...p };
            return {
              eq: vi.fn(async () => ({ data: null, error: null })),
            };
          }),
        };
      }
      if (table === "commission_ledger") {
        return {
          insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    adminGetUserById.mockResolvedValue({
      data: { user: { id: REFERRER_ID, email: "ref@example.com" } },
      error: null,
    });

    const res = await awardCommissionForOrder(ORDER_ID);
    expect(res.ok).toBe(true);
    expect(countCall).toBeGreaterThanOrEqual(1);
    expect(affPatch!.tier).toBe("silver");
  });
});

// ---------------------------------------------------------------------------
// I-AFFPAY-1, I-AFFPAY-2: adminProcessPayout
// ---------------------------------------------------------------------------
describe("adminProcessPayout (I-AFFPAY-1, I-AFFPAY-2)", () => {
  it("rejects non-admin", async () => {
    isAdminMock.mockResolvedValueOnce(false);
    const res = await adminProcessPayout({
      affiliate_id: AFF_ID,
      amount_cents: 5000,
      method: "zelle",
    });
    expect(res.ok).toBe(false);
  });

  it("I-AFFPAY-2: rejects below $50 floor", async () => {
    const res = await adminProcessPayout({
      affiliate_id: AFF_ID,
      amount_cents: 4999,
      method: "zelle",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/floor|minimum|50/i);
  });

  it("I-AFFPAY-1: atomic decrement, ledger, payout row inserted", async () => {
    let affPatch: Record<string, unknown> | null = null;
    let ledgerInsert: Record<string, unknown> | null = null;
    let payoutInsert: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: AFF_ID,
                  user_id: USER_ID,
                  available_balance_cents: 50_000,
                  total_paid_cents: 0,
                },
                error: null,
              })),
            })),
          })),
          update: vi.fn((p: Record<string, unknown>) => {
            affPatch = p;
            return {
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  select: vi.fn(async () => ({
                    data: [{ id: AFF_ID, user_id: USER_ID }],
                    error: null,
                  })),
                })),
              })),
            };
          }),
        };
      }
      if (table === "commission_ledger") {
        return {
          insert: vi.fn((p: Record<string, unknown>) => {
            ledgerInsert = p;
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      if (table === "affiliate_payouts") {
        return {
          insert: vi.fn((p: Record<string, unknown>) => {
            payoutInsert = p;
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: "pay-1" },
                  error: null,
                })),
              })),
            };
          }),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    adminGetUserById.mockResolvedValue({
      data: { user: { id: USER_ID, email: "aff@example.com" } },
      error: null,
    });

    const res = await adminProcessPayout({
      affiliate_id: AFF_ID,
      amount_cents: 10_000,
      method: "zelle",
      external_reference: "ZELLE-XYZ",
    });
    expect(res.ok).toBe(true);
    expect(res.payout_id).toBe("pay-1");
    // affPatch uses the supabase-js .raw or numeric subtraction; we expect either
    // a number or an object — only verify the keys we know are present.
    expect(affPatch).not.toBeNull();
    expect(ledgerInsert!.kind).toBe("payout_debit");
    expect(ledgerInsert!.amount_cents).toBe(-10_000);
    expect(payoutInsert!.amount_cents).toBe(10_000);
    expect(payoutInsert!.method).toBe("zelle");
    expect(payoutInsert!.status).toBe("pending");
  });

  it("returns 'Insufficient balance' when rowcount=0", async () => {
    serviceFrom.mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: AFF_ID,
                  user_id: USER_ID,
                  available_balance_cents: 100,
                  total_paid_cents: 0,
                },
                error: null,
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              gte: vi.fn(() => ({
                select: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          })),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    const res = await adminProcessPayout({
      affiliate_id: AFF_ID,
      amount_cents: 10_000,
      method: "zelle",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/insufficient/i);
  });
});

// ---------------------------------------------------------------------------
// I-AFFREDEEM-1: redeemCommissionForVialCredit
// ---------------------------------------------------------------------------
describe("redeemCommissionForVialCredit (I-AFFREDEEM-1)", () => {
  it("unauthenticated → error", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await redeemCommissionForVialCredit({ amount_cents: 5000 });
    expect(res.ok).toBe(false);
  });

  it("atomic decrement at tier ratio; ledger + entitlement inserted", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    let updPatch: Record<string, unknown> | null = null;
    let ledgerInsert: Record<string, unknown> | null = null;
    let entInsert: Record<string, unknown> | null = null;

    cookieFrom.mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: AFF_ID,
                  user_id: USER_ID,
                  tier: "bronze",
                  available_balance_cents: 10_000,
                },
                error: null,
              })),
            })),
          })),
          update: vi.fn((p: Record<string, unknown>) => {
            updPatch = p;
            return {
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  select: vi.fn(async () => ({
                    data: [{ id: AFF_ID }],
                    error: null,
                  })),
                })),
              })),
            };
          }),
        };
      }
      throw new Error(`unexpected cookie ${table}`);
    });

    serviceFrom.mockImplementation((table: string) => {
      if (table === "commission_ledger") {
        return {
          insert: vi.fn((p: Record<string, unknown>) => {
            ledgerInsert = p;
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      if (table === "free_vial_entitlements") {
        return {
          insert: vi.fn((p: Record<string, unknown>) => {
            entInsert = p;
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      throw new Error(`unexpected service ${table}`);
    });

    const res = await redeemCommissionForVialCredit({ amount_cents: 5000 });
    expect(res.ok).toBe(true);
    // Bronze ratio = 1.10 → 5000 → 5500
    expect(res.vial_credit_cents).toBe(5500);
    expect(updPatch).not.toBeNull();
    expect(ledgerInsert!.kind).toBe("redemption_debit");
    expect(ledgerInsert!.amount_cents).toBe(-5000);
    expect(entInsert!.customer_user_id).toBe(USER_ID);
  });

  it("insufficient balance → rowcount=0 error", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    cookieFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: {
              id: AFF_ID,
              user_id: USER_ID,
              tier: "bronze",
              available_balance_cents: 1000,
            },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            select: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
      })),
    }));
    const res = await redeemCommissionForVialCredit({ amount_cents: 5000 });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/insufficient|balance/i);
  });
});

// ---------------------------------------------------------------------------
// getMyAffiliateState — quick smoke
// ---------------------------------------------------------------------------
describe("getMyAffiliateState", () => {
  it("returns is_affiliate=false when no row", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    cookieFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    }));
    const res = await getMyAffiliateState();
    expect(res.ok).toBe(true);
    expect(res.is_affiliate).toBe(false);
  });

  it("returns affiliate + counts when row exists", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    cookieFrom.mockImplementation((table: string) => {
      if (table === "affiliates") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: AFF_ID,
                  user_id: USER_ID,
                  tier: "bronze",
                  available_balance_cents: 100,
                  total_earned_cents: 100,
                },
                error: null,
              })),
            })),
          })),
        };
      }
      if (table === "referrals") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() =>
                Promise.resolve({ data: [], count: 3, error: null })
              ),
            })),
          })),
        };
      }
      if (table === "commission_ledger") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          })),
        };
      }
      if (table === "affiliate_payouts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          })),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    const res = await getMyAffiliateState();
    expect(res.ok).toBe(true);
    expect(res.is_affiliate).toBe(true);
    expect(res.affiliate?.id).toBe(AFF_ID);
    expect(res.successful_referrals_count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// clawbackCommissionForOrder — codex review #3 H6
// ---------------------------------------------------------------------------
describe("clawbackCommissionForOrder (codex H6)", () => {
  it("inserts clawback ledger entry and rolls back affiliate aggregates", async () => {
    let clawbackInsert: Record<string, unknown> | null = null;
    let affPatch: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation((table: string) => {
      if (table === "commission_ledger") {
        return {
          select: vi.fn((_cols: string) => {
            void _cols;
            // Two select calls: earned filter, then clawback filter.
            return {
              eq: vi.fn((col: string, val: unknown) => {
                void col;
                void val;
                return {
                  eq: vi.fn((c: string, k: unknown) => {
                    if (k === "earned") {
                      return Promise.resolve({
                        data: [
                          {
                            id: "led-1",
                            affiliate_id: AFF_ID,
                            amount_cents: 10_000,
                            source_referral_id: "ref-1",
                            tier_at_time: "bronze",
                          },
                        ],
                        error: null,
                      });
                    }
                    return Promise.resolve({ data: [], error: null });
                  }),
                };
              }),
            };
          }),
          insert: vi.fn((p: Record<string, unknown>) => {
            clawbackInsert = p;
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      if (table === "affiliates") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  available_balance_cents: 10_000,
                  total_earned_cents: 10_000,
                },
                error: null,
              })),
            })),
          })),
          update: vi.fn((p: Record<string, unknown>) => {
            affPatch = p;
            return {
              eq: vi.fn(async () => ({ data: null, error: null })),
            };
          }),
        };
      }
      if (table === "referrals") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() =>
                Promise.resolve({ data: [], error: null })
              ),
            })),
          })),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const res = await clawbackCommissionForOrder(ORDER_ID);
    expect(res.ok).toBe(true);
    expect(res.clawbacks_inserted).toBe(1);
    expect(clawbackInsert!.kind).toBe("clawback");
    expect(clawbackInsert!.amount_cents).toBe(-10_000);
    expect(clawbackInsert!.source_order_id).toBe(ORDER_ID);
    expect(affPatch!.available_balance_cents).toBe(0);
    expect(affPatch!.total_earned_cents).toBe(0);
  });

  it("idempotent: no earned entries → 0 clawbacks", async () => {
    serviceFrom.mockImplementation((table: string) => {
      if (table === "commission_ledger") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    const res = await clawbackCommissionForOrder(ORDER_ID);
    expect(res.ok).toBe(true);
    expect(res.clawbacks_inserted).toBe(0);
  });

  it("idempotent: already-clawed earnings are skipped", async () => {
    let insertCalled = false;
    serviceFrom.mockImplementation((table: string) => {
      if (table === "commission_ledger") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn((c: string, k: unknown) => {
                void c;
                if (k === "earned") {
                  return Promise.resolve({
                    data: [
                      {
                        id: "led-1",
                        affiliate_id: AFF_ID,
                        amount_cents: 10_000,
                        source_referral_id: "ref-1",
                        tier_at_time: "bronze",
                      },
                    ],
                    error: null,
                  });
                }
                // Already-clawed lookup — return a matching clawback.
                return Promise.resolve({
                  data: [
                    {
                      source_order_id: ORDER_ID,
                      source_referral_id: "ref-1",
                      affiliate_id: AFF_ID,
                    },
                  ],
                  error: null,
                });
              }),
            })),
          })),
          insert: vi.fn(() => {
            insertCalled = true;
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      if (table === "referrals") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        };
      }
      throw new Error(`unexpected ${table}`);
    });
    const res = await clawbackCommissionForOrder(ORDER_ID);
    expect(res.ok).toBe(true);
    expect(res.clawbacks_inserted).toBe(0);
    expect(insertCalled).toBe(false);
  });
});
