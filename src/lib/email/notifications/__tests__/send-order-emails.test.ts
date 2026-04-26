import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OrderRow } from "@/lib/supabase/types";

// Mock the Resend client factory so we can flip it between
// "configured" (returns a stub) and "unconfigured" (returns null).
vi.mock("@/lib/email/client", () => {
  return {
    getResend: vi.fn(),
    EMAIL_FROM: "Bench Grade Peptides <admin@benchgradepeptides.com>",
    ADMIN_NOTIFICATION_EMAIL: "admin@benchgradepeptides.com",
  };
});

import { getResend } from "@/lib/email/client";
import {
  sendPaymentConfirmed,
  sendOrderShipped,
  sendAccountClaim,
} from "../send-order-emails";

const sampleRow: OrderRow = {
  order_id: "abc12345-def6-7890-1234-567890abcdef",
  customer: {
    name: "Dr. Jane Smith",
    email: "jane@example.edu",
    institution: "",
    phone: "",
    ship_address_1: "123 Lab Ln",
    ship_city: "Boston",
    ship_state: "MA",
    ship_zip: "02101",
  },
  items: [
    {
      sku: "BGP-BPC157-10-5",
      product_slug: "bpc-157",
      category_slug: "tissue-repair",
      name: "BPC-157",
      size_mg: 10,
      // pack_size present at runtime; the OrderRow TS type omits it.
      // We cast through `as never` to exercise the same shape submitOrder writes.
      // @ts-expect-error pack_size is part of stored row but not in OrderRow type
      pack_size: 5,
      unit_price: 275,
      quantity: 1,
      vial_image: "/brand/vials/bpc-157.jpg",
    },
  ],
  subtotal_cents: 27500,
  acknowledgment: {
    certification_text: "x",
    certification_version: "v1",
    certification_hash: "h",
    is_adult: true,
    is_researcher: true,
    accepts_ruo: true,
    acknowledged_at: "2026-04-24T00:00:00.000Z",
    ip: "0.0.0.0",
    user_agent: "test",
  },
  status: "funded",
  tracking_number: "9400111202509999999999",
  tracking_carrier: "USPS",
  shipped_at: null,
  customer_user_id: null,
  created_at: "2026-04-24T00:00:00.000Z",
  updated_at: "2026-04-24T00:00:00.000Z",
};

function makeResendStub() {
  const send = vi.fn().mockResolvedValue({ id: "msg_1" });
  return { stub: { emails: { send } }, send };
}

describe("sendPaymentConfirmed", () => {
  const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls Resend with row.customer.email and the payment-confirmed subject", async () => {
    const { stub, send } = makeResendStub();
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendPaymentConfirmed(sampleRow);
    expect(res).toEqual({ ok: true });
    expect(send).toHaveBeenCalledTimes(1);
    const arg = send.mock.calls[0][0];
    expect(arg.to).toBe("jane@example.edu");
    expect(arg.subject).toMatch(/Payment received/);
    expect(arg.html).toContain("Your payment has been received");
  });

  it("returns ok:false reason:resend-unconfigured when Resend is null", async () => {
    vi.mocked(getResend).mockReturnValue(null);
    const res = await sendPaymentConfirmed(sampleRow);
    expect(res).toEqual({ ok: false, reason: "resend-unconfigured" });
    expect(consoleErr).toHaveBeenCalled();
  });

  it("returns ok:false (no throw) when Resend rejects", async () => {
    const { stub, send } = makeResendStub();
    send.mockRejectedValueOnce(new Error("network"));
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendPaymentConfirmed(sampleRow);
    expect(res.ok).toBe(false);
  });
});

describe("sendOrderShipped", () => {
  const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => vi.clearAllMocks());

  it("calls Resend with shipped subject and tracking number in body", async () => {
    const { stub, send } = makeResendStub();
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendOrderShipped(sampleRow, []);
    expect(res).toEqual({ ok: true });
    const arg = send.mock.calls[0][0];
    expect(arg.to).toBe("jane@example.edu");
    expect(arg.subject).toMatch(/Shipped/);
    expect(arg.html).toContain("9400111202509999999999");
  });

  it("returns ok:false reason:resend-unconfigured when Resend is null", async () => {
    vi.mocked(getResend).mockReturnValue(null);
    const res = await sendOrderShipped(sampleRow, []);
    expect(res).toEqual({ ok: false, reason: "resend-unconfigured" });
    expect(consoleErr).toHaveBeenCalled();
  });

  it("returns ok:false (no throw) when Resend rejects", async () => {
    const { stub, send } = makeResendStub();
    send.mockRejectedValueOnce(new Error("boom"));
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendOrderShipped(sampleRow, []);
    expect(res.ok).toBe(false);
  });

  it("bails ok:false when row is missing tracking metadata", async () => {
    const { stub } = makeResendStub();
    vi.mocked(getResend).mockReturnValue(stub as never);
    const noTrack: OrderRow = { ...sampleRow, tracking_number: null, tracking_carrier: null };
    const res = await sendOrderShipped(noTrack, []);
    expect(res.ok).toBe(false);
  });
});

describe("sendAccountClaim", () => {
  const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => vi.clearAllMocks());

  const link = "https://benchgradepeptides.com/auth/claim?token=abc";

  it("calls Resend with claim subject and includes the magic link", async () => {
    const { stub, send } = makeResendStub();
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendAccountClaim(sampleRow, link);
    expect(res).toEqual({ ok: true });
    const arg = send.mock.calls[0][0];
    expect(arg.to).toBe("jane@example.edu");
    expect(arg.subject).toMatch(/Claim your Bench Grade portal/);
    expect(arg.html).toContain("auth/claim?token=abc");
  });

  it("returns ok:false reason:resend-unconfigured when Resend is null", async () => {
    vi.mocked(getResend).mockReturnValue(null);
    const res = await sendAccountClaim(sampleRow, link);
    expect(res).toEqual({ ok: false, reason: "resend-unconfigured" });
    expect(consoleErr).toHaveBeenCalled();
  });

  it("returns ok:false (no throw) when Resend rejects", async () => {
    const { stub, send } = makeResendStub();
    send.mockRejectedValueOnce(new Error("nope"));
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendAccountClaim(sampleRow, link);
    expect(res.ok).toBe(false);
  });
});
