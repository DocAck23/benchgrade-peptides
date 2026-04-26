/**
 * Transactional messaging email dispatcher (Sprint 3 Wave A3).
 *
 * Mirrors send-subscription-emails: best-effort, swallow Resend errors,
 * return `{ ok, reason? }` for telemetry. A delivery failure must NEVER
 * roll back a state transition that already landed in Postgres.
 */

import { getResend, EMAIL_FROM } from "@/lib/email/client";
import {
  messageNotificationEmail,
  type MessageNotificationContext,
} from "@/lib/email/templates";

export interface SendResult {
  ok: boolean;
  reason?: string;
}

export async function sendMessageNotification(
  toEmail: string,
  ctx: MessageNotificationContext
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.error(
      "[sendMessageNotification] Resend not configured; skipping email for",
      ctx.message_id
    );
    return { ok: false, reason: "resend-unconfigured" };
  }
  const e = messageNotificationEmail(ctx);
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
    console.error("[sendMessageNotification] failed:", err);
    return { ok: false };
  }
}
