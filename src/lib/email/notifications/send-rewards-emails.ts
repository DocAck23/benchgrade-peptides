/**
 * Transactional rewards email dispatcher (Sprint G4).
 *
 * Same shape as send-referral-emails / send-subscription-emails:
 * best-effort sends, swallow Resend errors, return `{ ok, reason? }`
 * so the caller can log/telemetry without coupling. Every callsite
 * already wraps in try/catch and treats failure as non-blocking.
 */

import { getResend, EMAIL_FROM } from "@/lib/email/client";
import {
  tierUpEmail,
  raffleWonEmail,
  vialCreditIssuedEmail,
  type TierUpContext,
  type RaffleWonContext,
  type VialCreditIssuedContext,
} from "@/lib/email/templates";

export interface SendResult {
  ok: boolean;
  reason?: string;
}

async function dispatch(
  toEmail: string,
  prepared: { subject: string; text: string; html: string },
  label: string,
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.error(
      `[${label}] Resend not configured; skipping email for ${toEmail}`,
    );
    return { ok: false, reason: "resend-unconfigured" };
  }
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: prepared.subject,
      text: prepared.text,
      html: prepared.html,
    });
    return { ok: true };
  } catch (err) {
    console.error(`[${label}] failed:`, err);
    return { ok: false };
  }
}

export async function sendTierUp(
  toEmail: string,
  ctx: TierUpContext,
): Promise<SendResult> {
  return dispatch(toEmail, tierUpEmail(ctx), "sendTierUp");
}

export async function sendRaffleWon(
  toEmail: string,
  ctx: RaffleWonContext,
): Promise<SendResult> {
  return dispatch(toEmail, raffleWonEmail(ctx), "sendRaffleWon");
}

export async function sendVialCreditIssued(
  toEmail: string,
  ctx: VialCreditIssuedContext,
): Promise<SendResult> {
  return dispatch(toEmail, vialCreditIssuedEmail(ctx), "sendVialCreditIssued");
}
