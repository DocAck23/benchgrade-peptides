import { describe, it, expect, vi, afterEach } from "vitest";
import type {
  AffiliateApplicationApprovedContext,
  AffiliateCommissionEarnedContext,
  AffiliatePayoutSentContext,
} from "@/lib/email/templates";

vi.mock("@/lib/email/client", () => ({
  getResend: vi.fn(),
  EMAIL_FROM: "Bench Grade Peptides <admin@benchgradepeptides.com>",
  ADMIN_NOTIFICATION_EMAIL: "admin@benchgradepeptides.com",
}));

import { getResend } from "@/lib/email/client";
import {
  sendAffiliateApplicationApproved,
  sendAffiliateCommissionEarned,
  sendAffiliatePayoutSent,
} from "../send-affiliate-emails";

function makeResendStub() {
  const send = vi.fn().mockResolvedValue({ id: "msg_1" });
  return { stub: { emails: { send } }, send };
}

describe("sendAffiliateApplicationApproved", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => vi.clearAllMocks());

  const ctx: AffiliateApplicationApprovedContext = {
    name: "Dr. Jane Smith",
    tier: "bronze",
    commission_pct: 10,
    referral_link_url: "https://benchgradepeptides.com/?ref=abcd1234",
    dashboard_url: "https://benchgradepeptides.com/account/affiliate",
  };

  it("calls Resend with the application-approved subject and recipient", async () => {
    const { stub, send } = makeResendStub();
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendAffiliateApplicationApproved("jane@example.edu", ctx);
    expect(res).toEqual({ ok: true });
    const arg = send.mock.calls[0][0];
    expect(arg.to).toBe("jane@example.edu");
    expect(arg.subject).toBe("Welcome to the Bench Grade Affiliate Program");
    expect(arg.html).toContain("Bronze");
  });

  it("returns ok:false reason:resend-unconfigured when Resend is null", async () => {
    vi.mocked(getResend).mockReturnValue(null);
    const res = await sendAffiliateApplicationApproved(
      "jane@example.edu",
      ctx
    );
    expect(res).toEqual({ ok: false, reason: "resend-unconfigured" });
  });

  it("returns ok:false (no throw) when Resend rejects", async () => {
    const { stub, send } = makeResendStub();
    send.mockRejectedValueOnce(new Error("boom"));
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendAffiliateApplicationApproved(
      "jane@example.edu",
      ctx
    );
    expect(res.ok).toBe(false);
  });
});

describe("sendAffiliateCommissionEarned", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => vi.clearAllMocks());

  const ctx: AffiliateCommissionEarnedContext = {
    name: "Dr. Jane Smith",
    affiliate_id: "abcd1234-ef56-7890-1234-567890abcdef",
    monthly_total_cents: 12550,
    ledger_count: 3,
    available_balance_cents: 30000,
    period_label: "April 2026",
  };

  it("calls Resend with the commission-earned subject and recipient", async () => {
    const { stub, send } = makeResendStub();
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendAffiliateCommissionEarned("jane@example.edu", ctx);
    expect(res).toEqual({ ok: true });
    const arg = send.mock.calls[0][0];
    expect(arg.to).toBe("jane@example.edu");
    expect(arg.subject).toBe(
      "You earned $125.50 this month — BGP-AFF-abcd1234"
    );
    expect(arg.html).toContain("$125.50");
  });

  it("returns ok:false reason:resend-unconfigured when Resend is null", async () => {
    vi.mocked(getResend).mockReturnValue(null);
    const res = await sendAffiliateCommissionEarned("jane@example.edu", ctx);
    expect(res).toEqual({ ok: false, reason: "resend-unconfigured" });
  });

  it("returns ok:false (no throw) when Resend rejects", async () => {
    const { stub, send } = makeResendStub();
    send.mockRejectedValueOnce(new Error("boom"));
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendAffiliateCommissionEarned("jane@example.edu", ctx);
    expect(res.ok).toBe(false);
  });
});

describe("sendAffiliatePayoutSent", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => vi.clearAllMocks());

  const ctx: AffiliatePayoutSentContext = {
    name: "Dr. Jane Smith",
    amount_cents: 25000,
    method: "zelle",
    external_reference: "ZL-7788XX",
  };

  it("calls Resend with the payout-sent subject and recipient", async () => {
    const { stub, send } = makeResendStub();
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendAffiliatePayoutSent("jane@example.edu", ctx);
    expect(res).toEqual({ ok: true });
    const arg = send.mock.calls[0][0];
    expect(arg.to).toBe("jane@example.edu");
    expect(arg.subject).toBe("Payout sent: $250.00 via Zelle");
    expect(arg.html).toContain("ZL-7788XX");
  });

  it("returns ok:false reason:resend-unconfigured when Resend is null", async () => {
    vi.mocked(getResend).mockReturnValue(null);
    const res = await sendAffiliatePayoutSent("jane@example.edu", ctx);
    expect(res).toEqual({ ok: false, reason: "resend-unconfigured" });
  });

  it("returns ok:false (no throw) when Resend rejects", async () => {
    const { stub, send } = makeResendStub();
    send.mockRejectedValueOnce(new Error("boom"));
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendAffiliatePayoutSent("jane@example.edu", ctx);
    expect(res.ok).toBe(false);
  });
});
