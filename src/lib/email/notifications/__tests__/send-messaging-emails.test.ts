import { describe, it, expect, vi, afterEach } from "vitest";
import type { MessageNotificationContext } from "@/lib/email/templates";

vi.mock("@/lib/email/client", () => ({
  getResend: vi.fn(),
  EMAIL_FROM: "Bench Grade Peptides <admin@benchgradepeptides.com>",
  ADMIN_NOTIFICATION_EMAIL: "admin@benchgradepeptides.com",
}));

import { getResend } from "@/lib/email/client";
import { sendMessageNotification } from "../send-messaging-emails";

const baseCtx: MessageNotificationContext = {
  customer_name: "Dr. Jane Smith",
  message_id: "msgabcde-1234-5678-9012-3456789abcde",
  message_preview: "Thanks for the question — your COA is in the portal.",
  thread_url: "https://benchgradepeptides.com/account/messages",
  truncated: false,
};

function makeResendStub() {
  const send = vi.fn().mockResolvedValue({ id: "msg_1" });
  return { stub: { emails: { send } }, send };
}

describe("sendMessageNotification", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  afterEach(() => vi.clearAllMocks());

  it("calls Resend with the message-notification subject and recipient", async () => {
    const { stub, send } = makeResendStub();
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendMessageNotification("jane@example.edu", baseCtx);
    expect(res).toEqual({ ok: true });
    const arg = send.mock.calls[0][0];
    expect(arg.to).toBe("jane@example.edu");
    expect(arg.subject).toBe("New message from Bench Grade · BGP-MSG-msgabcde");
    expect(arg.html).toContain("Open thread");
  });

  it("returns ok:false reason:resend-unconfigured when Resend is null", async () => {
    vi.mocked(getResend).mockReturnValue(null);
    const res = await sendMessageNotification("jane@example.edu", baseCtx);
    expect(res).toEqual({ ok: false, reason: "resend-unconfigured" });
  });

  it("returns ok:false (no throw) when Resend rejects", async () => {
    const { stub, send } = makeResendStub();
    send.mockRejectedValueOnce(new Error("network"));
    vi.mocked(getResend).mockReturnValue(stub as never);
    const res = await sendMessageNotification("jane@example.edu", baseCtx);
    expect(res.ok).toBe(false);
  });
});
