/**
 * Transactional affiliate email dispatchers (Sprint 4 Wave A3).
 *
 * Mirrors send-referral-emails: best-effort, swallow Resend errors,
 * return `{ ok, reason? }` for telemetry.
 */

import { getResend, EMAIL_FROM } from "@/lib/email/client";
import {
  affiliateApplicationApprovedEmail,
  affiliateCommissionEarnedEmail,
  affiliatePayoutSentEmail,
  type AffiliateApplicationApprovedContext,
  type AffiliateCommissionEarnedContext,
  type AffiliatePayoutSentContext,
} from "@/lib/email/templates";

export interface SendResult {
  ok: boolean;
  reason?: string;
}

export async function sendAffiliateApplicationApproved(
  toEmail: string,
  ctx: AffiliateApplicationApprovedContext
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.error(
      "[sendAffiliateApplicationApproved] Resend not configured; skipping email for",
      toEmail
    );
    return { ok: false, reason: "resend-unconfigured" };
  }
  const e = affiliateApplicationApprovedEmail(ctx);
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
    console.error("[sendAffiliateApplicationApproved] failed:", err);
    return { ok: false };
  }
}

export async function sendAffiliateCommissionEarned(
  toEmail: string,
  ctx: AffiliateCommissionEarnedContext
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.error(
      "[sendAffiliateCommissionEarned] Resend not configured; skipping email for",
      toEmail
    );
    return { ok: false, reason: "resend-unconfigured" };
  }
  const e = affiliateCommissionEarnedEmail(ctx);
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
    console.error("[sendAffiliateCommissionEarned] failed:", err);
    return { ok: false };
  }
}

export async function sendAffiliatePayoutSent(
  toEmail: string,
  ctx: AffiliatePayoutSentContext
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.error(
      "[sendAffiliatePayoutSent] Resend not configured; skipping email for",
      toEmail
    );
    return { ok: false, reason: "resend-unconfigured" };
  }
  const e = affiliatePayoutSentEmail(ctx);
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
    console.error("[sendAffiliatePayoutSent] failed:", err);
    return { ok: false };
  }
}
