/**
 * Best-effort dispatchers for the subscription self-service
 * confirmation emails (paused / resumed / cancelled / skipped).
 *
 * Each helper swallows Resend errors and returns `{ ok }` for
 * telemetry only — a delivery failure must NEVER bubble up and roll
 * back a state transition that already landed in Postgres.
 */

import { getResend, EMAIL_FROM } from "@/lib/email/client";
import {
  subscriptionLifecycleEmail,
  type SubscriptionLifecycleKind,
} from "@/lib/email/templates/subscription-lifecycle";

export interface SendLifecycleArgs {
  to: string;
  kind: SubscriptionLifecycleKind;
  display_id: string;
  next_ship_date?: string | null;
}

export async function sendSubscriptionLifecycle(
  args: SendLifecycleArgs,
): Promise<{ ok: boolean; reason?: string }> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, reason: "resend_not_configured" };
  }
  if (!args.to || !/^\S+@\S+\.\S+$/.test(args.to)) {
    return { ok: false, reason: "invalid_recipient" };
  }
  try {
    const { subject, html, text } = subscriptionLifecycleEmail({
      kind: args.kind,
      display_id: args.display_id,
      next_ship_date: args.next_ship_date ?? null,
    });
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: args.to,
      subject,
      html,
      text,
    });
    if (error) {
      console.error("[sendSubscriptionLifecycle] resend error:", error);
      return { ok: false, reason: "resend_error" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[sendSubscriptionLifecycle] threw:", err);
    return { ok: false, reason: "threw" };
  }
}
