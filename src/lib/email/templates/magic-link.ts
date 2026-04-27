import { escapeHtml, logoSrc } from "../templates";
import { SITE_URL } from "@/lib/site";

/**
 * Branded magic-link sign-in email. Replaces Supabase's default
 * unbranded transactional message — same wine + gold visual system as
 * every other Bench Grade Peptides email so a researcher recognizes
 * it as ours and not a phishing attempt.
 *
 * The link itself is a single-use URL minted by
 * `supabase.auth.admin.generateLink({ type: 'magiclink', ... })`,
 * which behaves identically to a stock magic-link send: clicking
 * exchanges the embedded one-time code for a session cookie.
 */
export function magicLinkEmail(opts: {
  link: string;
  /** Optional context — e.g. "your latest order" or "your subscription". */
  context?: string;
}): { subject: string; html: string; text: string } {
  const subject = "Your Bench Grade Peptides sign-in link";
  return {
    subject,
    html: renderHtml(opts.link, opts.context),
    text: renderText(opts.link, opts.context),
  };
}

function renderHtml(link: string, context?: string): string {
  const logo = logoSrc();
  const year = new Date().getFullYear();
  const safeLink = escapeHtml(link);
  const safeContext = context ? escapeHtml(context) : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in to Bench Grade Peptides</title></head>
<body style="margin:0;padding:0;background:#EFEAE1;color:#1A0506;-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;color:#EFEAE1;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Tap the button to sign in. The link expires in 60 minutes.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEAE1;"><tr><td align="center" style="padding:24px 12px 32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#FDFAF1;border:1px solid #D4C8A8;">

      <tr><td align="center" style="padding:9px 32px;background:#4A0E1A;color:#B89254;font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;line-height:1.4;border-bottom:1px solid #6B2C36;">
        Sign in
      </td></tr>

      <tr><td align="center" style="padding:30px 16px 22px 16px;background:#4A0E1A;">
        <img src="${logo}" width="180" height="110" alt="Bench Grade Peptides" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:180px;max-width:100%;height:auto;" />
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#E8D5A8;margin-top:10px;">Synthetic Peptides for Research</div>
      </td></tr>

      <tr><td style="padding:32px 40px 8px 40px;">
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:28px;line-height:1.25;color:#1A0506;margin:0;">Sign in to your account.</h1>
      </td></tr>

      <tr><td style="padding:14px 40px 8px 40px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#1A0506;">
        <p style="margin:0 0 14px 0;">
          Tap the button below to ${safeContext ? `${safeContext} —` : "sign in to"} the Bench Grade Peptides researcher portal. The link is single-use and expires in <strong>60 minutes</strong>.
        </p>
        <p style="margin:0 0 6px 0;color:#4A2528;">
          You can use the portal to:
        </p>
        <ul style="margin:0 0 18px 18px;padding:0;font-size:15px;color:#1A0506;">
          <li style="margin:4px 0;">Track every order, lot, and shipment</li>
          <li style="margin:4px 0;">Pause, resume, or cancel a subscription</li>
          <li style="margin:4px 0;">Download per-lot Certificates of Analysis</li>
          <li style="margin:4px 0;">Share your personal referral link</li>
        </ul>
      </td></tr>

      <tr><td align="center" style="padding:8px 40px 32px 40px;">
        <a href="${safeLink}" style="display:inline-block;background:#4A0E1A;color:#FDFAF1;text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:14px;letter-spacing:2px;text-transform:uppercase;padding:14px 32px;border:1px solid #4A0E1A;">Sign in</a>
      </td></tr>

      <tr><td style="padding:8px 40px 24px 40px;">
        <p style="margin:0 0 6px 0;font-family:Georgia,serif;font-size:12px;line-height:1.55;color:#6B5350;">
          If the button doesn't work, paste this URL into your browser:
        </p>
        <p style="margin:0;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.5;color:#4A2528;word-break:break-all;background:#F4EBD7;border:1px solid #D4C8A8;padding:10px 12px;">
          ${safeLink}
        </p>
      </td></tr>

      <tr><td style="padding:18px 40px 8px 40px;border-top:1px solid #D4C8A8;">
        <p style="margin:0;font-family:Georgia,serif;font-size:11px;line-height:1.55;color:#6B5350;">
          You're receiving this because someone requested a sign-in link for
          this email at ${escapeHtml(SITE_URL)}. If that wasn't you, you can
          ignore this email — no account changes have been made.
        </p>
      </td></tr>

      <tr><td align="center" style="padding:14px 40px 28px 40px;font-family:Georgia,serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;">
        Bench Grade Peptides LLC · 8 The Green, Dover, DE 19901<br/>
        © ${year} · Research-grade synthetic peptides
      </td></tr>

    </table>
  </td></tr></table>
</body></html>`;
}

function renderText(link: string, context?: string): string {
  return [
    "Sign in to Bench Grade Peptides",
    "",
    `Tap this link to ${context ? `${context} —` : "sign in to"} the researcher portal:`,
    "",
    link,
    "",
    "The link is single-use and expires in 60 minutes.",
    "",
    "Once signed in, you can track every order and lot, manage subscriptions, download per-lot Certificates of Analysis, and share your referral link.",
    "",
    "If you didn't request this email, you can ignore it — no account changes have been made.",
    "",
    "Bench Grade Peptides LLC · 8 The Green, Dover, DE 19901",
  ].join("\n");
}
