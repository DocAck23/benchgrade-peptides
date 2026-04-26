import { describe, it, expect, vi, afterEach } from "vitest";
import type { CartItem } from "@/lib/cart/types";
import type {
  SubscriptionStartedContext,
  SubscriptionCycleContext,
  SubscriptionPaymentDueContext,
  SubscriptionRenewalContext,
} from "@/lib/email/templates";

vi.mock("@/lib/email/client", () => ({
  getResend: vi.fn(),
  EMAIL_FROM: "Bench Grade Peptides <admin@benchgradepeptides.com>",
  ADMIN_NOTIFICATION_EMAIL: "admin@benchgradepeptides.com",
}));

import { getResend } from "@/lib/email/client";
import {
  sendSubscriptionStarted,
  sendSubscriptionCycleShipped,
  sendSubscriptionPaymentDue,
  sendSubscriptionRenewal,
} from "../send-subscription-emails";

const sampleItem: CartItem = {
  sku: "BGP-BPC157-10-5",
  product_slug: "bpc-157",
  category_slug: "tissue-repair",
  name: "BPC-157",
  size_mg: 10,
  pack_size: 5,
  unit_price: 275,
  quantity: 1,
  vial_image: "/brand/vials/bpc-157.jpg",
};

const customer = {
  name: "Dr. Jane Smith",
  email: "jane@example.edu",
  institution: "",
  phone: "",
  ship_address_1: "123 Lab Ln",
  ship_city: "Boston",
  ship_state: "MA",
  ship_zip: "02101",
};

const subId = "sub-12345-6789-aaaa-bbbb-cccccccccccc";

const startedCtx: SubscriptionStartedContext = {
  subscription_id: subId,
  customer,
  items: [sampleItem],
  plan_duration_months: 6,
  payment_cadence: "prepay",
  ship_cadence: "monthly",
  cycle_total_cents: 27500,
  plan_total_cents: 140250,
  next_ship_date: "2026-05-01",
  upcoming_ship_dates: ["2026-05-01", "2026-06-01", "2026-07-01"],
  savings_vs_retail_cents: 24750,
};

const cycleCtx: SubscriptionCycleContext = {
  subscription_id: subId,
  customer,
  items: [sampleItem],
  cycle_number: 2,
  cycles_total: 6,
  tracking_number: "9400111202509999999999",
  tracking_carrier: "USPS",
  tracking_url: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111202509999999999",
  coa_lot_urls: [],
  next_ship_date: "2026-06-01",
};

const dueCtx: SubscriptionPaymentDueContext = {
  subscription_id: subId,
  customer,
  cycle_number: 3,
  cycles_total: 6,
  cycle_total_cents: 27500,
  due_date: "2026-05-05",
  days_remaining: 5,
  subscription_memo: "BGP-SUB-sub-1234",
  bill_pay_setup_url: "https://benchgradepeptides.com/account/subscription/bill-pay",
};

const renewalCtx: SubscriptionRenewalContext = {
  subscription_id: subId,
  customer,
  plan_duration_months: 6,
  discount_percent: 15,
  savings_to_date_cents: 24750,
  plan_ends_in_days: 7,
  renew_url: "https://benchgradepeptides.com/account/subscription/renew?plan=" + subId,
};

function makeResendStub() {
  const send = vi.fn().mockResolvedValue({ id: "msg_1" });
  return { stub: { emails: { send } }, send };
}

describe("sendSubscriptionStarted", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => vi.clearAllMocks());

  it("calls Resend with the started subject and recipient", async () => {
    const { stub, send } = makeResendStub();
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendSubscriptionStarted("jane@example.edu", startedCtx);
    expect(res).toEqual({ ok: true });
    const arg = send.mock.calls[0][0];
    expect(arg.to).toBe("jane@example.edu");
    expect(arg.subject).toMatch(/Your subscription is active/);
    expect(arg.html).toContain("Welcome to your stack");
  });

  it("returns ok:false reason:resend-unconfigured when Resend is null", async () => {
    vi.mocked(getResend).mockReturnValue(null);
    const res = await sendSubscriptionStarted("jane@example.edu", startedCtx);
    expect(res).toEqual({ ok: false, reason: "resend-unconfigured" });
  });

  it("returns ok:false (no throw) when Resend rejects", async () => {
    const { stub, send } = makeResendStub();
    send.mockRejectedValueOnce(new Error("network"));
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendSubscriptionStarted("jane@example.edu", startedCtx);
    expect(res.ok).toBe(false);
  });
});

describe("sendSubscriptionCycleShipped", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => vi.clearAllMocks());

  it("calls Resend with the cycle subject and tracking number", async () => {
    const { stub, send } = makeResendStub();
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendSubscriptionCycleShipped("jane@example.edu", cycleCtx);
    expect(res).toEqual({ ok: true });
    const arg = send.mock.calls[0][0];
    expect(arg.subject).toMatch(/Cycle 2 of 6 shipped/);
    expect(arg.html).toContain("9400111202509999999999");
  });

  it("returns ok:false reason:resend-unconfigured when Resend is null", async () => {
    vi.mocked(getResend).mockReturnValue(null);
    const res = await sendSubscriptionCycleShipped("jane@example.edu", cycleCtx);
    expect(res).toEqual({ ok: false, reason: "resend-unconfigured" });
  });

  it("returns ok:false (no throw) when Resend rejects", async () => {
    const { stub, send } = makeResendStub();
    send.mockRejectedValueOnce(new Error("boom"));
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendSubscriptionCycleShipped("jane@example.edu", cycleCtx);
    expect(res.ok).toBe(false);
  });
});

describe("sendSubscriptionPaymentDue", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => vi.clearAllMocks());

  it("calls Resend with the payment-due subject and grace warning", async () => {
    const { stub, send } = makeResendStub();
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendSubscriptionPaymentDue("jane@example.edu", dueCtx);
    expect(res).toEqual({ ok: true });
    const arg = send.mock.calls[0][0];
    expect(arg.subject).toBe("Payment due in 5 days — Cycle 3 of 6");
    expect(arg.html).toMatch(/5 days/);
  });

  it("returns ok:false reason:resend-unconfigured when Resend is null", async () => {
    vi.mocked(getResend).mockReturnValue(null);
    const res = await sendSubscriptionPaymentDue("jane@example.edu", dueCtx);
    expect(res).toEqual({ ok: false, reason: "resend-unconfigured" });
  });

  it("returns ok:false (no throw) when Resend rejects", async () => {
    const { stub, send } = makeResendStub();
    send.mockRejectedValueOnce(new Error("nope"));
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendSubscriptionPaymentDue("jane@example.edu", dueCtx);
    expect(res.ok).toBe(false);
  });
});

describe("sendSubscriptionRenewal", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => vi.clearAllMocks());

  it("calls Resend with the renewal subject and renew URL", async () => {
    const { stub, send } = makeResendStub();
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendSubscriptionRenewal("jane@example.edu", renewalCtx);
    expect(res).toEqual({ ok: true });
    const arg = send.mock.calls[0][0];
    expect(arg.subject).toBe(
      "Your subscription ends in 7 days — renew at the same rate"
    );
    expect(arg.html).toContain("/account/subscription/renew?plan=");
  });

  it("returns ok:false reason:resend-unconfigured when Resend is null", async () => {
    vi.mocked(getResend).mockReturnValue(null);
    const res = await sendSubscriptionRenewal("jane@example.edu", renewalCtx);
    expect(res).toEqual({ ok: false, reason: "resend-unconfigured" });
  });

  it("returns ok:false (no throw) when Resend rejects", async () => {
    const { stub, send } = makeResendStub();
    send.mockRejectedValueOnce(new Error("nope"));
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendSubscriptionRenewal("jane@example.edu", renewalCtx);
    expect(res.ok).toBe(false);
  });
});
