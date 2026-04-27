import { escapeHtml, logoSrc } from "../templates";
import { SITE_URL } from "@/lib/site";

/**
 * Pre-launch welcome email. Sent the moment a researcher submits the
 * waitlist popup. Voice is "personable, brand-loud, transparent" —
 * leans into manufacturing in the US, third-party testing, QR-COA on
 * every vial, and the FIRST100 + prepay perks (free vial of choice +
 * $500 giveaway entry) without burying the lede.
 *
 * No tracking pixels — Resend's webhooks are sufficient for delivery
 * accounting and we don't want to look like a marketing-automation
 * provider. Logo is embedded as a base64 data URL so the gold mark
 * renders even when the recipient blocks remote images.
 */
export function prelaunchWelcomeEmail(): {
  subject: string;
  html: string;
  text: string;
} {
  const subject =
    "Welcome to Bench Grade Peptides — your launch code inside";

  const html = renderHtml();
  const text = renderText();
  return { subject, html, text };
}

function renderHtml(): string {
  const logo = logoSrc();
  const year = new Date().getFullYear();
  const couponCode = "FIRST250";

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(
    "Welcome to Bench Grade Peptides",
  )}</title></head>
<body style="margin:0;padding:0;background:#EFEAE1;color:#1A0506;-webkit-font-smoothing:antialiased;">
  <div style="display:none;font-size:1px;color:#EFEAE1;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Welcome — your FIRST250 launch code is inside.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFEAE1;"><tr><td align="center" style="padding:24px 12px 32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#FDFAF1;border:1px solid #D4C8A8;">

      <tr><td align="center" style="padding:9px 32px;background:#4A0E1A;color:#B89254;font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;line-height:1.4;border-bottom:1px solid #6B2C36;">
        Research use only · Not for human or veterinary use
      </td></tr>

      <tr><td align="center" style="padding:34px 16px 28px 16px;background:#4A0E1A;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#B89254;margin-bottom:14px;">Made in USA · Verified per lot</div>
        <img src="${logo}" width="240" height="146" alt="Bench Grade Peptides" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:240px;max-width:100%;height:auto;" />
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#E8D5A8;margin-top:10px;">Synthetic Peptides for Research</div>
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:20px auto 0;"><tr>
          <td style="width:60px;height:1px;background:#B89254;line-height:1px;font-size:0;">&nbsp;</td>
          <td style="padding:0 8px;font-family:Georgia,serif;font-size:10px;color:#B89254;">◆</td>
          <td style="width:60px;height:1px;background:#B89254;line-height:1px;font-size:0;">&nbsp;</td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:32px 40px 8px 40px;">
        <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;">Pre-launch list</div>
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:30px;line-height:1.2;color:#1A0506;margin:10px 0 0 0;">You're on the list.</h1>
      </td></tr>

      <tr><td style="padding:18px 40px 4px 40px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#1A0506;">
        <p style="margin:0 0 18px 0;">
          We're getting ready to launch the most premier brand of research peptides
          in the United States — built on transparency, trust, and honor.
        </p>
        <p style="margin:0 0 18px 0;">
          We're on-site with our manufacturer this week, walking the bench top to
          bottom — synthesis, lyophilization, fill, finish — to make sure every
          step from the bench to your research lab is <em>Bench Grade</em>
          certified before a single vial leaves the door.
        </p>
      </td></tr>

      <!-- FIRST250 hero -->
      <tr><td style="padding:8px 40px 8px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #B89254;background:#F4EBD7;">
          <tr><td align="center" style="padding:24px 24px 10px 24px;">
            <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#6B5350;margin-bottom:6px;">First-250 cohort</div>
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:32px;letter-spacing:6px;color:#4A0E1A;font-weight:400;">${escapeHtml(
              couponCode,
            )}</div>
            <div style="font-family:Georgia,serif;font-size:14px;color:#1A0506;margin-top:10px;line-height:1.5;">
              <strong>10% off your entire order</strong> &nbsp;·&nbsp; <strong>Free shipping for life</strong>
            </div>
          </td></tr>
          <tr><td style="padding:6px 28px 22px 28px;font-family:Georgia,serif;font-size:13px;line-height:1.65;color:#4A2528;">
            <div style="border-top:1px solid #D4C8A8;padding-top:14px;margin-top:6px;">
              <strong style="color:#1A0506;">Stack your perks:</strong>
              <ul style="margin:8px 0 0 18px;padding:0;">
                <li style="margin:6px 0;">Order $250+ &mdash; every vial becomes <strong>30% off</strong></li>
                <li style="margin:6px 0;">Order $500+ &mdash; we add a <strong>free vial</strong> of your choosing</li>
                <li style="margin:6px 0;">Subscribe &amp; prepay 3 months &mdash; <strong>18% off the total</strong></li>
                <li style="margin:6px 0;">Subscribe &amp; prepay 6 months &mdash; <strong>25% off the total</strong></li>
              </ul>
            </div>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:24px 40px 4px 40px;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.65;color:#1A0506;">
        <p style="margin:0 0 14px 0;font-family:Georgia,serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#6B5350;">Why this won't be like the rest</p>
        <ul style="margin:0 0 18px 18px;padding:0;font-size:15px;">
          <li style="margin:6px 0;">
            <strong>Synthesized in the USA.</strong> We do not source from China.
            Zero customs delays, zero overseas freight surprises.
          </li>
          <li style="margin:6px 0;">
            <strong>Third-party tested.</strong> Every lot is independently
            verified for purity, endotoxin, heavy metals, and other
            contaminants — full panel, not a spot check.
          </li>
          <li style="margin:6px 0;">
            <strong>Always-current COAs.</strong> No stale PDFs from a year
            ago. The Certificate of Analysis lives on the product page and a
            printed copy ships inside the order.
          </li>
          <li style="margin:6px 0;">
            <strong>QR on every vial.</strong> Scan it to pull the exact lot
            record, including the lot's COA — no email request, no portal,
            no chasing.
          </li>
          <li style="margin:6px 0;">
            <strong>You'll see the process.</strong> Video tour from the
            lab to the shipping label coming soon — bench to label,
            nothing hidden.
          </li>
        </ul>
      </td></tr>

      <tr><td style="padding:14px 40px 4px 40px;font-family:Georgia,serif;font-size:15px;line-height:1.65;color:#1A0506;">
        <p style="margin:0 0 14px 0;">
          We'll email you the moment the catalogue goes live. Your code's saved
          to your email — bring it to checkout and the discount applies
          automatically.
        </p>
        <p style="margin:0 0 18px 0;color:#4A2528;">
          Until then,<br/>
          <span style="font-family:Georgia,serif;font-style:italic;color:#1A0506;">The Bench Grade Peptides team</span>
        </p>
      </td></tr>

      <tr><td style="padding:18px 40px 8px 40px;border-top:1px solid #D4C8A8;">
        <p style="margin:0;font-family:Georgia,serif;font-size:11px;line-height:1.55;color:#6B5350;">
          You're receiving this because you joined the Bench Grade Peptides
          pre-launch list at ${escapeHtml(SITE_URL)}. Reply with
          UNSUBSCRIBE to be removed.
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

function renderText(): string {
  return [
    "Welcome to Bench Grade Peptides — your launch perks inside",
    "",
    "We're getting ready to launch the most premier brand of research peptides in the United States, built on transparency, trust, and honor.",
    "",
    "We're on-site with our manufacturer this week, walking every step from synthesis to fill/finish so each vial is Bench Grade certified before it leaves the bench.",
    "",
    "FIRST-250 COHORT · code FIRST250",
    "  • 10% off your entire order, period",
    "  • Free shipping for life — no order minimum",
    "  • Order $250+ → every vial becomes 30% off",
    "  • Order $500+ → free vial of your choosing",
    "  • Subscribe & prepay 3 months → 18% off the total",
    "  • Subscribe & prepay 6 months → 25% off the total",
    "",
    "Why this won't be like the rest:",
    "  • Synthesized in the USA — we do not source from China.",
    "  • Third-party tested — every lot, full panel for purity, endotoxin, heavy metals, contaminants.",
    "  • Always-current COAs published on each product page; printed copy ships in every order.",
    "  • QR on every vial → scan to pull the exact lot record + COA.",
    "  • Video tour from the lab to the shipping label coming soon — bench to label, nothing hidden.",
    "",
    "We'll email you the moment the catalogue goes live. Bring FIRST100 to checkout and the discount applies automatically.",
    "",
    "— The Bench Grade Peptides team",
    "",
    "Bench Grade Peptides LLC · 8 The Green, Dover, DE 19901",
    "Reply UNSUBSCRIBE to be removed.",
  ].join("\n");
}
