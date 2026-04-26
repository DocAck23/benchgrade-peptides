import { describe, it, expect, vi, afterEach } from "vitest";
import type { ReferralEarnedContext } from "@/lib/email/templates";

vi.mock("@/lib/email/client", () => ({
  getResend: vi.fn(),
  EMAIL_FROM: "Bench Grade Peptides <admin@benchgradepeptides.com>",
  ADMIN_NOTIFICATION_EMAIL: "admin@benchgradepeptides.com",
}));

import { getResend } from "@/lib/email/client";
import { sendReferralEarned } from "../send-referral-emails";

const baseCtx: ReferralEarnedContext = {
  customer_name: "Dr. Jane Smith",
  referee_email: "friend@example.edu",
  referral_count: 1,
  free_vial_size_mg: 5,
};

function makeResendStub() {
  const send = vi.fn().mockResolvedValue({ id: "msg_1" });
  return { stub: { emails: { send } }, send };
}

describe("sendReferralEarned", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => vi.clearAllMocks());

  it("calls Resend with the referral-earned subject and recipient", async () => {
    const { stub, send } = makeResendStub();
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendReferralEarned("jane@example.edu", baseCtx);
    expect(res).toEqual({ ok: true });
    const arg = send.mock.calls[0][0];
    expect(arg.to).toBe("jane@example.edu");
    expect(arg.subject).toBe(
      "Free vial earned — your friend's first order shipped"
    );
    expect(arg.html).toContain("friend@example.edu");
    expect(arg.html).toContain("/catalogue?free_vial=true");
  });

  it("returns ok:false reason:resend-unconfigured when Resend is null", async () => {
    vi.mocked(getResend).mockReturnValue(null);
    const res = await sendReferralEarned("jane@example.edu", baseCtx);
    expect(res).toEqual({ ok: false, reason: "resend-unconfigured" });
  });

  it("returns ok:false (no throw) when Resend rejects", async () => {
    const { stub, send } = makeResendStub();
    send.mockRejectedValueOnce(new Error("boom"));
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendReferralEarned("jane@example.edu", baseCtx);
    expect(res.ok).toBe(false);
  });
});
