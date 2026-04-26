/**
 * Transactional referral email dispatcher (Sprint 3 Wave A3).
 *
 * Mirrors send-subscription-emails: best-effort, swallow Resend errors,
 * return `{ ok, reason? }` for telemetry.
 */

import { getResend, EMAIL_FROM } from "@/lib/email/client";
import {
  referralEarnedEmail,
  type ReferralEarnedContext,
} from "@/lib/email/templates";

export interface SendResult {
  ok: boolean;
  reason?: string;
}

export async function sendReferralEarned(
  toEmail: string,
  ctx: ReferralEarnedContext
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.error(
      "[sendReferralEarned] Resend not configured; skipping email for",
      toEmail
    );
    return { ok: false, reason: "resend-unconfigured" };
  }
  const e = referralEarnedEmail(ctx);
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: e.subject,
      text: e.text,
      html: e.html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[sendReferralEarned] failed:", err);
    return { ok: false };
  }
}
