import { escapeHtml, logoSrc } from "../templates";
import { SITE_URL } from "@/lib/site";

/**
 * Subscription lifecycle confirmation emails — sent the moment the
 * customer taps a self-service action so they have something in their
 * inbox confirming what they did and what happens next.
 *
 * Four kinds:
 *   • paused — no charges + no shipments until resume
 *   • resumed — back on schedule with the new next-ship date
 *   • cancelled — final state, won't ship/charge again
 *   • skipped — one cycle bumped forward, the rest of the plan stays
 *
 * Voice matches the editorial transactional emails (wine + gold + serif).
 * Kept short — these are confirmations, not marketing.
 */

export type SubscriptionLifecycleKind =
  | "paused"
  | "resumed"
  | "cancelled"
  | "skipped";

export interface SubscriptionLifecycleContext {
  kind: SubscriptionLifecycleKind;
  /** Short identifier the customer sees (BGP-SUB-xxxxxx). */
  display_id: string;
  /** ISO date string. Required for resumed/skipped; ignored otherwise. */
  next_ship_date?: string | null;
  /** Optional: customer's chosen cancellation reason; we don't echo it back. */
  reason_recorded?: boolean;
}

export function subscriptionLifecycleEmail(
  ctx: SubscriptionLifecycleContext,
): { subject: string; html: string; text: string } {
  const titleByKind: Record<SubscriptionLifecycleKind, string> = {
    paused: "Subscription paused",
    resumed: "Subscription resumed",
    cancelled: "Subscription cancelled",
    skipped: "Next cycle skipped",
  };
  const subject = `${titleByKind[ctx.kind]} — ${ctx.display_id}`;
  return {
    subject,
    html: renderHtml(ctx, titleByKind[ctx.kind]),
    text: renderText(ctx, titleByKind[ctx.kind]),
  };
}

function bodyCopy(ctx: SubscriptionLifecycleContext): string[] {
  const formattedNext = ctx.next_ship_date
    ? new Date(ctx.next_ship_date).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  switch (ctx.kind) {
    case "paused":
      return [
        "Your subscription is paused. We won't ship or charge again until you resume.",
        "When you're ready, head to your account and tap Resume — we'll pick up the cadence from that day.",
      ];
    case "resumed":
      return [
        "Welcome back. Your subscription is active again.",
        formattedNext
          ? `Your next shipment is scheduled for ${formattedNext}.`
          : "Your next shipment date is back on the calendar.",
      ];
    case "cancelled":
      return [
        "Your subscription is cancelled. Nothing else will ship and you won't be charged again.",
        "If anything changes, you can subscribe again from any product page — and your prior order history stays right where it is in your account.",
      ];
    case "skipped":
      return [
        "We've skipped your next cycle.",
        formattedNext
          ? `Your next shipment is now scheduled for ${formattedNext}.`
          : "Your subscription stays active and the cadence picks back up after the skip.",
      ];
  }
}

function renderHtml(
  ctx: SubscriptionLifecycleContext,
  title: string,
): string {
  const logo = logoSrc();
  const year = new Date().getFullYear();
  const lines = bodyCopy(ctx)
    .map(
      (l) =>
        `<p style="margin:0 0 14px 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#1A0506;">${escapeHtml(l)}</p>`,
    )
    .join("");

  const ctaHref = `${SITE_URL}/account/subscription`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(
    title,
  )}</title></head>
<body style="margin:0;padding:0;background:#EFEAE1;color:#1A0506;-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;color:#EFEAE1;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(title)} — ${escapeHtml(ctx.display_id)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEAE1;"><tr><td align="center" style="padding:24px 12px 32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#FDFAF1;border:1px solid #D4C8A8;">

      <tr><td align="center" style="padding:9px 32px;background:#4A0E1A;color:#B89254;font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;line-height:1.4;border-bottom:1px solid #6B2C36;">
        Subscription update
      </td></tr>

      <tr><td align="center" style="padding:30px 16px 22px 16px;background:#4A0E1A;">
        <img src="${logo}" width="180" height="110" alt="Bench Grade Peptides" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:180px;max-width:100%;height:auto;" />
      </td></tr>

      <tr><td style="padding:32px 40px 8px 40px;">
        <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;">${escapeHtml(
          ctx.display_id,
        )}</div>
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:1.25;color:#1A0506;margin:10px 0 0 0;">${escapeHtml(
          title,
        )}.</h1>
      </td></tr>

      <tr><td style="padding:18px 40px 8px 40px;">
        ${lines}
      </td></tr>

      <tr><td align="center" style="padding:8px 40px 32px 40px;">
        <a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#4A0E1A;color:#FDFAF1;text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;padding:13px 28px;border:1px solid #4A0E1A;">View subscription</a>
      </td></tr>

      <tr><td align="center" style="padding:14px 40px 28px 40px;font-family:Georgia,serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;border-top:1px solid #D4C8A8;">
        Bench Grade Peptides LLC · 8 The Green, Dover, DE 19901<br/>
        © ${year} · Research-grade synthetic peptides
      </td></tr>

    </table>
  </td></tr></table>
</body></html>`;
}

function renderText(
  ctx: SubscriptionLifecycleContext,
  title: string,
): string {
  return [
    `${title} — ${ctx.display_id}`,
    "",
    ...bodyCopy(ctx),
    "",
    `View your subscription: ${SITE_URL}/account/subscription`,
    "",
    "Bench Grade Peptides LLC · 8 The Green, Dover, DE 19901",
  ].join("\n");
}
