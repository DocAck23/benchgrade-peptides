/**
 * Transactional subscription-lifecycle email dispatchers (Sprint 2 Wave A3).
 *
 * Mirrors the contract established by send-order-emails: each helper
 * is best-effort, swallows Resend errors, and returns
 * `{ ok, reason? }` for telemetry. A delivery failure must NEVER
 * bubble up and roll back a state transition that already landed in
 * Postgres.
 */

import { getResend, EMAIL_FROM } from "@/lib/email/client";
import {
  subscriptionStartedEmail,
  subscriptionCycleShipNoticeEmail,
  subscriptionPaymentDueEmail,
  subscriptionRenewalEmail,
  type SubscriptionStartedContext,
  type SubscriptionCycleContext,
  type SubscriptionPaymentDueContext,
  type SubscriptionRenewalContext,
} from "@/lib/email/templates";

export interface SendResult {
  ok: boolean;
  reason?: string;
}

export async function sendSubscriptionStarted(
  toEmail: string,
  ctx: SubscriptionStartedContext
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.error(
      "[sendSubscriptionStarted] Resend not configured; skipping email for",
      ctx.subscription_id
    );
    return { ok: false, reason: "resend-unconfigured" };
  }
  const e = subscriptionStartedEmail(ctx);
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
    console.error("[sendSubscriptionStarted] failed:", err);
    return { ok: false };
  }
}

export async function sendSubscriptionCycleShipped(
  toEmail: string,
  ctx: SubscriptionCycleContext
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.error(
      "[sendSubscriptionCycleShipped] Resend not configured; skipping email for",
      ctx.subscription_id
    );
    return { ok: false, reason: "resend-unconfigured" };
  }
  const e = subscriptionCycleShipNoticeEmail(ctx);
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
    console.error("[sendSubscriptionCycleShipped] failed:", err);
    return { ok: false };
  }
}

export async function sendSubscriptionPaymentDue(
  toEmail: string,
  ctx: SubscriptionPaymentDueContext
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.error(
      "[sendSubscriptionPaymentDue] Resend not configured; skipping email for",
      ctx.subscription_id
    );
    return { ok: false, reason: "resend-unconfigured" };
  }
  const e = subscriptionPaymentDueEmail(ctx);
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
    console.error("[sendSubscriptionPaymentDue] failed:", err);
    return { ok: false };
  }
}

export async function sendSubscriptionRenewal(
  toEmail: string,
  ctx: SubscriptionRenewalContext
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.error(
      "[sendSubscriptionRenewal] Resend not configured; skipping email for",
      ctx.subscription_id
    );
    return { ok: false, reason: "resend-unconfigured" };
  }
  const e = subscriptionRenewalEmail(ctx);
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
    console.error("[sendSubscriptionRenewal] failed:", err);
    return { ok: false };
  }
}
