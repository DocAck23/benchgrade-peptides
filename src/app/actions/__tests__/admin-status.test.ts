import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks at module boundaries. markOrderFunded / markOrderShipped touch:
//   - admin auth (isAdmin)
//   - the Supabase server client (chainable update().eq().in().select())
//   - the email helpers (best-effort; we stub to no-op so failures here
//     never flip the action result)
// ---------------------------------------------------------------------------

const isAdminMock = vi.fn(async () => true);
vi.mock("@/lib/admin/auth", () => ({
  setAdminCookie: vi.fn(),
  clearAdminCookie: vi.fn(),
  isAdmin: () => isAdminMock(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

interface FakeUpdateResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

let nextResult: FakeUpdateResult = { data: [{ order_id: "x" }], error: null };
const updateSpy = vi.fn();

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  builder.update = vi.fn((patch: unknown) => {
    updateSpy(patch);
    return builder;
  });
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.select = vi.fn(async () => nextResult);
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => ({
    from: () => makeBuilder(),
  }),
}));

const sendPaymentConfirmedMock = vi.fn(async (_row: unknown) => ({ ok: true }));
const sendOrderShippedMock = vi.fn(async (_row: unknown, _urls: unknown) => ({ ok: true }));
vi.mock("@/lib/email/notifications/send-order-emails", () => ({
  sendPaymentConfirmed: (row: unknown) => sendPaymentConfirmedMock(row),
  sendOrderShipped: (row: unknown, urls: unknown) => sendOrderShippedMock(row, urls),
  lookupCoaUrls: () => [],
}));

// Stub cross-action hooks so admin status tests focus on admin.ts logic.
const awardCommissionMock = vi.fn(async (_id: string) => ({
  ok: true,
  commissions_awarded: 0,
}));
const clawbackMock = vi.fn(async (_id: string) => ({
  ok: true,
  clawbacks_inserted: 0,
}));
vi.mock("@/app/actions/affiliate", () => ({
  awardCommissionForOrder: (id: string) => awardCommissionMock(id),
  clawbackCommissionForOrder: (id: string) => clawbackMock(id),
}));

const transitionReferralOnShippedMock = vi.fn(async (_id: string) => ({ ok: true }));
vi.mock("@/app/actions/referrals", () => ({
  transitionReferralOnShipped: (id: string) => transitionReferralOnShippedMock(id),
}));

import {
  markOrderFunded,
  markOrderShipped,
  markOrderRefunded,
} from "../admin";

const validOrderId = "abc12345-def6-7890-1234-567890abcdef";
const validRow = {
  order_id: validOrderId,
  customer: { email: "j@x.com", name: "J" },
  items: [],
};

beforeEach(() => {
  isAdminMock.mockReset().mockResolvedValue(true);
  sendPaymentConfirmedMock.mockClear().mockResolvedValue({ ok: true });
  sendOrderShippedMock.mockClear().mockResolvedValue({ ok: true });
  awardCommissionMock.mockClear();
  clawbackMock.mockClear();
  transitionReferralOnShippedMock.mockClear();
  updateSpy.mockClear();
  nextResult = { data: [validRow], error: null };
});

describe("markOrderFunded", () => {
  it("returns Unauthorized when not admin", async () => {
    isAdminMock.mockResolvedValueOnce(false);
    const res = await markOrderFunded(validOrderId);
    expect(res).toEqual({ ok: false, error: "Unauthorized." });
    expect(sendPaymentConfirmedMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid order id", async () => {
    const res = await markOrderFunded("not-a-uuid");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Invalid order id/);
  });

  it("flips status and fires payment-confirmed email on success", async () => {
    const res = await markOrderFunded(validOrderId);
    expect(res).toEqual({ ok: true });
    expect(updateSpy).toHaveBeenCalledWith({ status: "funded" });
    expect(sendPaymentConfirmedMock).toHaveBeenCalledTimes(1);
  });

  it("returns 'not in fundable state' when rowcount is 0 (idempotent)", async () => {
    nextResult = { data: [], error: null };
    const res = await markOrderFunded(validOrderId);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/fundable/);
    expect(sendPaymentConfirmedMock).not.toHaveBeenCalled();
  });

  it("does not propagate email failures to the caller", async () => {
    sendPaymentConfirmedMock.mockResolvedValueOnce({ ok: false });
    const res = await markOrderFunded(validOrderId);
    expect(res).toEqual({ ok: true });
  });
});

describe("markOrderShipped", () => {
  it("returns Unauthorized when not admin", async () => {
    isAdminMock.mockResolvedValueOnce(false);
    const res = await markOrderShipped(validOrderId, "1Z999AA10123456784", "UPS");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("Unauthorized.");
  });

  it("rejects an invalid order id", async () => {
    const res = await markOrderShipped("nope", "1Z999AA10123456784", "UPS");
    expect(res.error).toMatch(/Invalid order id/);
  });

  it("rejects empty tracking number", async () => {
    const res = await markOrderShipped(validOrderId, "   ", "UPS");
    expect(res.error).toMatch(/1.120/);
  });

  it("rejects tracking with lowercase or special characters", async () => {
    const res = await markOrderShipped(validOrderId, "1z999aa10", "UPS");
    expect(res.error).toMatch(/uppercase/);
  });

  it("rejects unknown carrier", async () => {
    const res = await markOrderShipped(validOrderId, "1Z999AA10", "OnTrac");
    expect(res.error).toMatch(/USPS, UPS, FedEx, DHL/);
  });

  it("flips status, stamps tracking, fires shipped email", async () => {
    const res = await markOrderShipped(validOrderId, "1Z999AA10123456784", "UPS");
    expect(res).toEqual({ ok: true });
    const patch = updateSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(patch.status).toBe("shipped");
    expect(patch.tracking_number).toBe("1Z999AA10123456784");
    expect(patch.tracking_carrier).toBe("UPS");
    expect(typeof patch.shipped_at).toBe("string");
    expect(sendOrderShippedMock).toHaveBeenCalledTimes(1);
  });

  it("rejects when row is not in funded state (rowcount = 0)", async () => {
    nextResult = { data: [], error: null };
    const res = await markOrderShipped(validOrderId, "1Z999AA10123456784", "UPS");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/funded/);
    expect(sendOrderShippedMock).not.toHaveBeenCalled();
  });

  it("codex H5: fires referral shipped hook on successful transition", async () => {
    const res = await markOrderShipped(validOrderId, "1Z999AA10", "UPS");
    expect(res.ok).toBe(true);
    expect(transitionReferralOnShippedMock).toHaveBeenCalledWith(validOrderId);
  });
});

describe("markOrderRefunded (codex H6)", () => {
  it("returns Unauthorized when not admin", async () => {
    isAdminMock.mockResolvedValueOnce(false);
    const res = await markOrderRefunded(validOrderId);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Unauthorized/);
  });

  it("rejects invalid uuid", async () => {
    const res = await markOrderRefunded("nope");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Invalid order id/);
  });

  it("flips status to refunded and fires clawback hook", async () => {
    const res = await markOrderRefunded(validOrderId);
    expect(res.ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith({ status: "refunded" });
    expect(clawbackMock).toHaveBeenCalledWith(validOrderId);
  });

  it("rowcount=0 → not-in-funded-state error, no clawback", async () => {
    nextResult = { data: [], error: null };
    const res = await markOrderRefunded(validOrderId);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/funded/);
    expect(clawbackMock).not.toHaveBeenCalled();
  });
});
