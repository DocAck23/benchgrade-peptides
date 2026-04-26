import type { CartItem } from "@/lib/cart/types";
import type { CustomerInfo } from "@/app/actions/orders";
import { formatPrice } from "@/lib/utils";
import { SITE_URL } from "@/lib/site";
import type { PaymentMethod } from "@/lib/payments/methods";
import { paymentMethodLabel } from "@/lib/payments/methods";

interface OrderContext {
  order_id: string;
  customer: CustomerInfo;
  items: CartItem[];
  subtotal_cents: number;
  payment_method: PaymentMethod;
}

// ---------- Editorial-direction email wrapper ----------
// Spec §9 (Editorial direction) + §16.1 (locked tokens). Emails must use
// system-font fallbacks only (no <link>/<style>/web fonts) so we approximate
// Cinzel/Cormorant with Georgia, and Inter with Helvetica/Arial. Locked
// tokens used inline: paper #FDFAF1, paper-soft #F4EBD7, wine #4A0E1A,
// gold #B89254, ink #1A0506, ink-muted #6B5350, rule #D4C8A8.

const RUO_DISCLAIMER =
  "All products sold for laboratory research use only. Not for human or veterinary use. " +
  "Not for diagnostic, therapeutic, or in-vivo experimental use. By accepting delivery, " +
  "the recipient affirms research-only intent and assumes full responsibility for compliant handling.";

interface EditorialEmailOpts {
  title: string;
  bodyHtml: string;
  memo: string;
  cta?: { label: string; href: string };
}

export function editorialEmailHtml(opts: EditorialEmailOpts): string {
  const { title, bodyHtml, memo, cta } = opts;
  const safeMemo = escapeHtml(memo);
  const safeTitle = escapeHtml(title);
  const ctaHtml = cta
    ? `<tr><td align="center" style="padding:8px 32px 32px 32px;">
        <a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#4A0E1A;color:#FDFAF1;text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:15px;letter-spacing:1px;text-transform:uppercase;padding:14px 28px;border:1px solid #4A0E1A;">${escapeHtml(cta.label)}</a>
      </td></tr>`
    : "";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#FDFAF1;color:#1A0506;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDFAF1;"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FDFAF1;">
      <tr><td align="center" style="padding:8px 32px 16px 32px;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#6B5350;">Made in USA · Verified per lot</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:4px;text-transform:uppercase;color:#4A0E1A;margin-top:10px;">Bench Grade Peptides</div>
        <div style="height:1px;background:#B89254;margin:18px auto 0 auto;width:80px;"></div>
      </td></tr>

      <tr><td style="padding:24px 32px 8px 32px;">
        <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;">Order ${safeMemo}</div>
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.25;color:#1A0506;margin:8px 0 0 0;">${safeTitle}</h1>
      </td></tr>

      <tr><td style="padding:16px 32px 8px 32px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.65;color:#1A0506;">
        ${bodyHtml}
      </td></tr>

      ${ctaHtml}

      <tr><td style="padding:0 32px;">
        <div style="height:1px;background:#D4C8A8;margin:8px 0 0 0;"></div>
      </td></tr>

      <tr><td style="padding:18px 32px 28px 32px;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#6B5350;">
        ${escapeHtml(RUO_DISCLAIMER)}
        <div style="margin-top:10px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;">Bench Grade Peptides · Made in USA</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/**
 * Escape arbitrary user-controlled text for safe HTML interpolation.
 * Every user-supplied substitution MUST pass through this — string
 * concatenation otherwise opens an XSS surface on both the customer
 * confirmation and the admin notification.
 */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function packLabel(i: CartItem): string {
  return `${i.pack_size}-vial pack (${i.size_mg}mg ea.)`;
}

function lineText(i: CartItem): string {
  return `${i.name} — ${packLabel(i)} × ${i.quantity}  ${formatPrice(
    i.unit_price * i.quantity * 100
  )}`;
}

// ---------- payment-method instruction blocks ----------

interface MemoContext {
  memo: string;
}

function wireInstructionsText(ctx: MemoContext): string {
  const wireBeneficiary = process.env.WIRE_BENEFICIARY ?? "Bench Grade Peptides LLC";
  const wireBank = process.env.WIRE_BANK ?? "[Bank name — pending]";
  const wireRouting = process.env.WIRE_ROUTING ?? "[Routing — pending]";
  const wireAccount = process.env.WIRE_ACCOUNT ?? "[Account — pending]";
  return `Wire transfer instructions
--------------------------
Beneficiary: ${wireBeneficiary}
Bank: ${wireBank}
Routing / ABA: ${wireRouting}
Account: ${wireAccount}
Memo / reference: ${ctx.memo}

Send the wire exactly as listed and include the memo. We ship within
1-2 business days of funds clearing.`;
}

function achInstructionsText(ctx: MemoContext): string {
  const wireBeneficiary = process.env.WIRE_BENEFICIARY ?? "Bench Grade Peptides LLC";
  const wireBank = process.env.WIRE_BANK ?? "[Bank name — pending]";
  const wireRouting = process.env.WIRE_ROUTING ?? "[Routing — pending]";
  const wireAccount = process.env.WIRE_ACCOUNT ?? "[Account — pending]";
  return `ACH transfer instructions
-------------------------
Beneficiary: ${wireBeneficiary}
Bank: ${wireBank}
Routing: ${wireRouting}
Account: ${wireAccount}
Memo / reference: ${ctx.memo}

ACH transfers typically clear in 2-3 business days. Include the memo
on the transfer. We ship within 1-2 business days of funds clearing.`;
}

function zelleInstructionsText(ctx: MemoContext): string {
  const zelleId = process.env.ZELLE_ID ?? "[Zelle ID — pending]";
  const zelleName = process.env.WIRE_BENEFICIARY ?? "Bench Grade Peptides LLC";
  return `Zelle payment instructions
--------------------------
Zelle name: ${zelleName}
Zelle handle: ${zelleId}
Memo / reference: ${ctx.memo}

Send via Zelle from your bank's app. Zelle delivers instantly at most
major US banks. Include the memo in the memo/note field so we can
match your payment to this order. We ship within 1 business day of
payment confirmation.

Note: Zelle orders are capped at $500 per transaction by most banks.`;
}

function cryptoInstructionsText(_ctx: MemoContext): string {
  return `Cryptocurrency payment instructions
-----------------------------------
A hosted payment link will be sent to you shortly in a follow-up email.
You can pay with BTC, ETH, USDT, USDC, LTC and more. Funds are auto-
converted to USDC on our side — you pay in whatever you like.

Payment typically clears in 10-60 minutes depending on the network.
We ship within 1 business day of on-chain confirmation.`;
}

function wireInstructionsHtml(ctx: MemoContext): string {
  const wireBeneficiary = process.env.WIRE_BENEFICIARY ?? "Bench Grade Peptides LLC";
  const wireBank = process.env.WIRE_BANK ?? "[Bank name — pending]";
  const wireRouting = process.env.WIRE_ROUTING ?? "[Routing — pending]";
  const wireAccount = process.env.WIRE_ACCOUNT ?? "[Account — pending]";
  return instructionCardHtml(
    "Wire transfer instructions",
    [
      ["Beneficiary", wireBeneficiary],
      ["Bank", wireBank],
      ["Routing / ABA", wireRouting],
      ["Account", wireAccount],
      ["Memo", ctx.memo, true],
    ],
    "Include the memo on the wire so we can match it to your order. We ship within 1-2 business days of funds clearing."
  );
}

function achInstructionsHtml(ctx: MemoContext): string {
  const wireBeneficiary = process.env.WIRE_BENEFICIARY ?? "Bench Grade Peptides LLC";
  const wireBank = process.env.WIRE_BANK ?? "[Bank name — pending]";
  const wireRouting = process.env.WIRE_ROUTING ?? "[Routing — pending]";
  const wireAccount = process.env.WIRE_ACCOUNT ?? "[Account — pending]";
  return instructionCardHtml(
    "ACH transfer instructions",
    [
      ["Beneficiary", wireBeneficiary],
      ["Bank", wireBank],
      ["Routing", wireRouting],
      ["Account", wireAccount],
      ["Memo", ctx.memo, true],
    ],
    "ACH typically clears in 2-3 business days. We ship within 1-2 business days of funds clearing."
  );
}

function zelleInstructionsHtml(ctx: MemoContext): string {
  const zelleId = process.env.ZELLE_ID ?? "[Zelle ID — pending]";
  const zelleName = process.env.WIRE_BENEFICIARY ?? "Bench Grade Peptides LLC";
  return instructionCardHtml(
    "Zelle payment instructions",
    [
      ["Name", zelleName],
      ["Zelle handle", zelleId],
      ["Memo", ctx.memo, true],
    ],
    "Send from your bank's Zelle app. Orders over $500 should use ACH or wire instead. Include the memo in the note field."
  );
}

function cryptoInstructionsHtml(_ctx: MemoContext): string {
  return instructionCardHtml(
    "Cryptocurrency payment",
    [["Status", "Hosted payment link incoming by email"]],
    "A follow-up email will include a hosted checkout link. BTC, ETH, USDT, USDC, LTC supported — your pay currency, USDC received on our side."
  );
}

function instructionCardHtml(
  title: string,
  rows: Array<[string, string, boolean?]>,
  footer: string
): string {
  const rowHtml = rows
    .map(
      ([label, value, highlight]) =>
        `<tr><td style="padding:3px 0;color:#5a5a5a;width:140px;">${escapeHtml(label)}</td><td${
          highlight ? ' style="color:#0A5C7D;"' : ""
        }>${highlight ? "<strong>" : ""}${escapeHtml(value)}${highlight ? "</strong>" : ""}</td></tr>`
    )
    .join("");
  return `<tr><td style="padding:0 28px 28px 28px;">
    <div style="background:#EFEAE1;border:1px solid #d7d1c4;padding:18px;">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#0A5C7D;margin-bottom:10px;">${escapeHtml(title)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;color:#1A1A1A;">
        ${rowHtml}
      </table>
      <div style="font-size:12px;color:#5a5a5a;margin-top:12px;line-height:1.5;">${escapeHtml(footer)}</div>
    </div>
  </td></tr>`;
}

function instructionsText(method: PaymentMethod, memo: string): string {
  const ctx = { memo };
  switch (method) {
    case "wire":
      return wireInstructionsText(ctx);
    case "ach":
      return achInstructionsText(ctx);
    case "zelle":
      return zelleInstructionsText(ctx);
    case "crypto":
      return cryptoInstructionsText(ctx);
  }
}

function instructionsHtml(method: PaymentMethod, memo: string): string {
  const ctx = { memo };
  switch (method) {
    case "wire":
      return wireInstructionsHtml(ctx);
    case "ach":
      return achInstructionsHtml(ctx);
    case "zelle":
      return zelleInstructionsHtml(ctx);
    case "crypto":
      return cryptoInstructionsHtml(ctx);
  }
}

// ---------- main templates ----------

export function orderConfirmationEmail(ctx: OrderContext): {
  subject: string;
  text: string;
  html: string;
} {
  const lines = ctx.items.map(lineText).join("\n");
  const total = formatPrice(ctx.subtotal_cents);
  const ref = ctx.order_id.slice(0, 8);
  const memo = `BGP-${ref}`;
  const methodName = paymentMethodLabel(ctx.payment_method);

  const subject = `Order received — ${memo}`;
  const text = `Thank you for your order.

Order: ${ctx.order_id}
Payment method: ${methodName}
Memo (include on payment): ${memo}

Items
-----
${lines}

Total: ${total}
Shipping: calculated after payment clears

${instructionsText(ctx.payment_method, memo)}

Why no cards? RUO peptides face heavy merchant scrutiny. We're building the
reputation to unlock card processing — your order helps us get there. Read
more at ${SITE_URL}/why-no-cards

Ship-to
-------
${ctx.customer.name}
${ctx.customer.ship_address_1}${ctx.customer.ship_address_2 ? "\n" + ctx.customer.ship_address_2 : ""}
${ctx.customer.ship_city}, ${ctx.customer.ship_state} ${ctx.customer.ship_zip}

Order reference: ${ctx.order_id}
Questions: reply to this email.

— Bench Grade Peptides
${SITE_URL}
`;

  const itemRows = ctx.items
    .map(
      (i) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #d7d1c4;">
        <div style="font-family:Geist,system-ui,sans-serif;font-size:15px;color:#1A1A1A;">${escapeHtml(i.name)}</div>
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#5a5a5a;">
          ${i.pack_size}-vial pack · ${i.size_mg}mg ea. · ${escapeHtml(i.sku)} × ${i.quantity}
        </div>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #d7d1c4;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px;color:#1A1A1A;white-space:nowrap;">
        ${formatPrice(i.unit_price * i.quantity * 100)}
      </td>
    </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;background:#F7F4EE;font-family:Inter,system-ui,sans-serif;color:#1A1A1A;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #d7d1c4;">
      <tr><td style="padding:28px 28px 18px 28px;border-bottom:1px solid #d7d1c4;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5a5a5a;">Bench Grade Peptides</div>
        <div style="font-family:Geist,system-ui,sans-serif;font-size:28px;margin-top:8px;">Order received</div>
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;color:#5a5a5a;margin-top:4px;">${escapeHtml(memo)} · ${escapeHtml(methodName)}</div>
      </td></tr>

      <tr><td style="padding:20px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
          <tr>
            <td style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#5a5a5a;">Total</td>
            <td style="text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:18px;">${total}</td>
          </tr>
        </table>
      </td></tr>

      ${instructionsHtml(ctx.payment_method, memo)}

      <tr><td style="padding:0 28px 18px 28px;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#5a5a5a;font-style:italic;">
          Why no cards? RUO peptides face heavy merchant scrutiny. We're building the reputation to unlock card processing — your order helps us get there.
          <a href="${escapeHtml(SITE_URL)}/why-no-cards" style="color:#8A6B3B;text-decoration:underline;">Read more</a>.
        </p>
      </td></tr>

      <tr><td style="padding:0 28px 28px 28px;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5a5a5a;margin-bottom:6px;">Ship-to</div>
        <div style="font-size:14px;color:#1A1A1A;line-height:1.5;">
          ${escapeHtml(ctx.customer.name)}<br>
          ${escapeHtml(ctx.customer.ship_address_1)}${ctx.customer.ship_address_2 ? "<br>" + escapeHtml(ctx.customer.ship_address_2) : ""}<br>
          ${escapeHtml(ctx.customer.ship_city)}, ${escapeHtml(ctx.customer.ship_state)} ${escapeHtml(ctx.customer.ship_zip)}
        </div>
      </td></tr>

      <tr><td style="padding:16px 28px;border-top:1px solid #d7d1c4;background:#EFEAE1;font-size:11px;color:#5a5a5a;line-height:1.6;">
        All products sold for laboratory research purposes only. Not for human or veterinary use.
        Reply to this email with any questions.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, text, html };
}

export function adminOrderNotification(ctx: OrderContext): {
  subject: string;
  text: string;
  html: string;
} {
  const lines = ctx.items.map(lineText).join("\n");
  const total = formatPrice(ctx.subtotal_cents);
  const subject = `[BGP] New order — ${ctx.customer.name} · ${total} · ${paymentMethodLabel(ctx.payment_method)}`;
  const adminLink = `${SITE_URL}/admin/orders/${ctx.order_id}`;
  const methodName = paymentMethodLabel(ctx.payment_method);
  const text = `New order placed.

Customer: ${ctx.customer.name} <${ctx.customer.email}>
${ctx.customer.institution ? "Institution: " + ctx.customer.institution + "\n" : ""}${
    ctx.customer.phone ? "Phone: " + ctx.customer.phone + "\n" : ""
  }Ship to: ${ctx.customer.ship_address_1}, ${ctx.customer.ship_city}, ${ctx.customer.ship_state} ${ctx.customer.ship_zip}
Payment method: ${methodName}

Items
-----
${lines}

Total: ${total}
Order: ${ctx.order_id}
${adminLink}
`;
  const html = `<!doctype html><html><body style="font-family:Inter,system-ui,sans-serif;color:#1A1A1A;background:#F7F4EE;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #d7d1c4;padding:24px;">
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5a5a5a;">New order · ${escapeHtml(methodName)}</div>
    <div style="font-family:Geist,system-ui,sans-serif;font-size:20px;margin-top:4px;">${escapeHtml(ctx.customer.name)} — ${total}</div>
    <pre style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#1A1A1A;background:#EFEAE1;padding:14px;white-space:pre-wrap;margin-top:16px;">${escapeHtml(text)}</pre>
    <a href="${escapeHtml(adminLink)}" style="display:inline-block;margin-top:12px;background:#1A1A1A;color:#F7F4EE;text-decoration:none;padding:10px 18px;font-size:13px;">Open in admin →</a>
  </div>
</body></html>`;
  return { subject, text, html };
}

// ---------- Sprint 1 Task 3: lifecycle emails (Editorial direction) ----------

function itemRowsHtmlEditorial(items: CartItem[]): string {
  return items
    .map(
      (i) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #D4C8A8;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#1A0506;">
          ${escapeHtml(i.name)}
          <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#6B5350;letter-spacing:1px;margin-top:2px;">
            ${i.pack_size}-VIAL · ${i.size_mg}MG · ${escapeHtml(i.sku)} × ${i.quantity}
          </div>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #D4C8A8;text-align:right;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;color:#1A0506;white-space:nowrap;">
          ${formatPrice(i.unit_price * i.quantity * 100)}
        </td>
      </tr>`
    )
    .join("");
}

export function paymentConfirmedEmail(ctx: OrderContext): {
  subject: string;
  text: string;
  html: string;
} {
  const ref = ctx.order_id.slice(0, 8);
  const memo = `BGP-${ref}`;
  const subject = `Payment received — your order is being prepared · ${memo}`;
  const customerName = escapeHtml(ctx.customer.name);
  const itemsText = ctx.items.map(lineText).join("\n");
  const total = formatPrice(ctx.subtotal_cents);
  const portalUrl = `${SITE_URL}/account/orders/${ctx.order_id}`;

  const text = [
    `${ctx.customer.name} —`,
    ``,
    `Your payment has been received. Your stack moves into our packing queue and ships within 1–2 business days. We'll send a tracking number when your box leaves our lab.`,
    ``,
    `Order ${memo}`,
    `--`,
    itemsText,
    ``,
    `Total: ${total}`,
    ``,
    `View order: ${portalUrl}`,
    ``,
    RUO_DISCLAIMER,
    ``,
    `Bench Grade Peptides · Made in USA`,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${customerName} —</p>
    <p style="margin:0 0 14px 0;">Your payment has been received. Your stack moves into our packing queue and ships within 1–2 business days. We'll send a tracking number when your box leaves our lab.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1px solid #1A0506;">
      ${itemRowsHtmlEditorial(ctx.items)}
      <tr>
        <td style="padding-top:14px;font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;">Total</td>
        <td style="padding-top:14px;text-align:right;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:700;color:#1A0506;">${total}</td>
      </tr>
    </table>`;

  const html = editorialEmailHtml({
    title: "Your payment has been received.",
    bodyHtml,
    memo,
    cta: { label: "View order", href: portalUrl },
  });

  return { subject, text, html };
}

export interface ShippedContext extends OrderContext {
  tracking_number: string;
  tracking_carrier: "USPS" | "UPS" | "FedEx" | "DHL";
  tracking_url: string;
  coa_lot_urls: Array<{ sku: string; lot: string; url: string }>;
}

const STORAGE_PANEL_TEXT = `Storage & handling
------------------
Lyophilized vials: 2–8°C refrigerated (or –20°C for 6+ months).
Light-protect; do not freeze-thaw repeatedly.
Reconstitute only when ready to use; per-peptide reconstituted shelf
life on the COA enclosed.`;

export function orderShippedEmail(ctx: ShippedContext): {
  subject: string;
  text: string;
  html: string;
} {
  const ref = ctx.order_id.slice(0, 8);
  const memo = `BGP-${ref}`;
  const subject = `Shipped — tracking inside · ${memo}`;
  const customerName = escapeHtml(ctx.customer.name);
  const portalUrl = `${SITE_URL}/account/orders/${ctx.order_id}`;

  const coaTextLines = ctx.coa_lot_urls.length
    ? ctx.coa_lot_urls
        .map((c) => `  ${c.sku} · lot ${c.lot} — ${c.url}`)
        .join("\n")
    : `  COA available in your portal — ${portalUrl}`;

  const text = [
    `${ctx.customer.name} —`,
    ``,
    `Your order has shipped.`,
    ``,
    `Tracking`,
    `--------`,
    `Carrier: ${ctx.tracking_carrier}`,
    `Number: ${ctx.tracking_number}`,
    `Track: ${ctx.tracking_url}`,
    ``,
    STORAGE_PANEL_TEXT,
    ``,
    `Certificates of analysis`,
    `------------------------`,
    coaTextLines,
    ``,
    `Order ${memo}`,
    `View in portal: ${portalUrl}`,
    ``,
    RUO_DISCLAIMER,
    ``,
    `Bench Grade Peptides · Made in USA`,
  ].join("\n");

  const coaHtml = ctx.coa_lot_urls.length
    ? `<ul style="margin:8px 0 0 0;padding-left:18px;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#1A0506;">${ctx.coa_lot_urls
        .map(
          (c) =>
            `<li style="margin-bottom:4px;">${escapeHtml(c.sku)} · lot ${escapeHtml(c.lot)} — <a href="${escapeHtml(c.url)}" style="color:#4A0E1A;text-decoration:underline;">view COA</a></li>`
        )
        .join("")}</ul>`
    : `<p style="margin:8px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#1A0506;">COA available in your portal — <a href="${escapeHtml(portalUrl)}" style="color:#4A0E1A;text-decoration:underline;">sign in to view</a>.</p>`;

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${customerName} —</p>
    <p style="margin:0 0 18px 0;">Your order has shipped. Tracking and storage details below.</p>

    <div style="background:#F4EBD7;border:1px solid #D4C8A8;padding:18px;margin:0 0 18px 0;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;margin-bottom:8px;">Tracking</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#1A0506;">
        <tr><td style="width:90px;color:#6B5350;padding:2px 0;">Carrier</td><td>${escapeHtml(ctx.tracking_carrier)}</td></tr>
        <tr><td style="width:90px;color:#6B5350;padding:2px 0;">Number</td><td><strong>${escapeHtml(ctx.tracking_number)}</strong></td></tr>
        <tr><td style="width:90px;color:#6B5350;padding:2px 0;">Status</td><td><a href="${escapeHtml(ctx.tracking_url)}" style="color:#4A0E1A;text-decoration:underline;">Track shipment</a></td></tr>
      </table>
    </div>

    <div style="background:#FDFAF1;border:1px solid #D4C8A8;padding:18px;margin:0 0 18px 0;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;margin-bottom:8px;">Storage &amp; handling</div>
      <p style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:#1A0506;">Lyophilized vials: 2–8°C refrigerated (or –20°C for 6+ months).</p>
      <p style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:#1A0506;">Light-protect; do not freeze-thaw repeatedly.</p>
      <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:#1A0506;">Reconstitute only when ready to use; per-peptide reconstituted shelf life on the COA enclosed.</p>
    </div>

    <div>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;">Certificates of analysis</div>
      ${coaHtml}
    </div>`;

  const html = editorialEmailHtml({
    title: "Your order has shipped.",
    bodyHtml,
    memo,
    cta: { label: "Track shipment", href: ctx.tracking_url },
  });

  return { subject, text, html };
}

export interface ClaimContext extends OrderContext {
  magic_link_url: string;
}

export function accountClaimEmail(ctx: ClaimContext): {
  subject: string;
  text: string;
  html: string;
} {
  const ref = ctx.order_id.slice(0, 8);
  const memo = `BGP-${ref}`;
  const subject = `Claim your Bench Grade portal — order ${memo}`;
  const customerName = escapeHtml(ctx.customer.name);
  const safeLink = escapeHtml(ctx.magic_link_url);

  const text = [
    `${ctx.customer.name} —`,
    ``,
    `Your portal is ready. Click the link below to claim your account and view this order, your COAs, tracking, and any future orders in one place.`,
    ``,
    `Claim your account:`,
    ctx.magic_link_url,
    ``,
    `This link signs you in directly — no password to set. In the future, just request a magic link from /login and click any future magic link from us — same account, same order history.`,
    ``,
    `Order ${memo}`,
    ``,
    RUO_DISCLAIMER,
    ``,
    `Bench Grade Peptides · Made in USA`,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${customerName} —</p>
    <p style="margin:0 0 14px 0;">Your portal is ready. Claim your account to view this order, your certificates of analysis, tracking, and any future orders in one place.</p>
    <p style="margin:0 0 14px 0;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#6B5350;word-break:break-all;">${safeLink}</p>
    <p style="margin:18px 0 0 0;font-size:13px;color:#4A2528;">This link signs you in directly — no password to set. Any future magic link from us opens the same account, with all your orders.</p>`;

  const html = editorialEmailHtml({
    title: "Claim your Bench Grade portal.",
    bodyHtml,
    memo,
    cta: { label: "Claim your account", href: ctx.magic_link_url },
  });

  return { subject, text, html };
}

// ---------- Sprint 2 Wave A3: subscription lifecycle emails ----------
// Design choice: Wave A2 (`@/lib/subscriptions/cycles`) ships the
// `billPayInstructions` helper. Rather than create a hard import
// dependency on a sibling wave, these templates accept the formatted
// memo + URL on the context and render the bill-pay instruction block
// inline. This keeps Wave A3 independently buildable and testable.

export type PaymentCadence = "prepay" | "bill_pay";
export type ShipCadence = "monthly" | "quarterly" | "once";

export interface SubscriptionStartedContext {
  subscription_id: string;
  customer: CustomerInfo;
  items: CartItem[];
  plan_duration_months: number;
  payment_cadence: PaymentCadence;
  ship_cadence: ShipCadence;
  cycle_total_cents: number;
  plan_total_cents: number;
  next_ship_date: string;
  /** Next 3 ship dates inline so customer knows what to expect. */
  upcoming_ship_dates: string[];
  savings_vs_retail_cents: number;
}

export interface SubscriptionCycleContext {
  subscription_id: string;
  customer: CustomerInfo;
  items: CartItem[];
  cycle_number: number;
  cycles_total: number;
  tracking_number: string;
  tracking_carrier: "USPS" | "UPS" | "FedEx" | "DHL";
  tracking_url: string;
  coa_lot_urls: Array<{ sku: string; lot: string; url: string }>;
  /** `null` => this is the final cycle; copy says "Final cycle of your plan." */
  next_ship_date: string | null;
}

export interface SubscriptionPaymentDueContext {
  subscription_id: string;
  customer: CustomerInfo;
  cycle_number: number;
  cycles_total: number;
  cycle_total_cents: number;
  due_date: string;
  days_remaining: number;
  subscription_memo: string;
  bill_pay_setup_url: string;
}

export interface SubscriptionRenewalContext {
  subscription_id: string;
  customer: CustomerInfo;
  plan_duration_months: number;
  discount_percent: number;
  savings_to_date_cents: number;
  plan_ends_in_days: number;
  renew_url: string;
}

function subMemo(subscriptionId: string): string {
  return `BGP-SUB-${subscriptionId.slice(0, 8)}`;
}

function shipCadenceLabel(c: ShipCadence): string {
  switch (c) {
    case "monthly":
      return "monthly";
    case "quarterly":
      return "quarterly";
    case "once":
      return "single shipment";
  }
}

function paymentCadenceLabel(c: PaymentCadence): string {
  return c === "prepay" ? "Prepaid in full" : "Monthly bank bill-pay";
}

function billPayInstructionsText(memo: string): string {
  const beneficiary = process.env.WIRE_BENEFICIARY ?? "Bench Grade Peptides LLC";
  const bank = process.env.WIRE_BANK ?? "[Bank name — pending]";
  const routing = process.env.WIRE_ROUTING ?? "[Routing — pending]";
  const account = process.env.WIRE_ACCOUNT ?? "[Account — pending]";
  return `Bank bill-pay setup
-------------------
Add Bench Grade Peptides as a payee in your bank's online bill-pay:

Payee: ${beneficiary}
Bank: ${bank}
Routing: ${routing}
Account: ${account}
Memo / reference: ${memo}

Schedule the cycle amount to arrive 3 business days before each cycle's
due date. Include the memo on every payment so we can match it to your
subscription. We ship within 1-2 business days of funds clearing.`;
}

function billPayInstructionsHtml(memo: string): string {
  const beneficiary = process.env.WIRE_BENEFICIARY ?? "Bench Grade Peptides LLC";
  const bank = process.env.WIRE_BANK ?? "[Bank name — pending]";
  const routing = process.env.WIRE_ROUTING ?? "[Routing — pending]";
  const account = process.env.WIRE_ACCOUNT ?? "[Account — pending]";
  const rows: Array<[string, string, boolean?]> = [
    ["Payee", beneficiary],
    ["Bank", bank],
    ["Routing", routing],
    ["Account", account],
    ["Memo", memo, true],
  ];
  const rowHtml = rows
    .map(
      ([label, value, highlight]) =>
        `<tr><td style="padding:3px 0;color:#6B5350;width:120px;">${escapeHtml(label)}</td><td${
          highlight ? ' style="color:#4A0E1A;"' : ""
        }>${highlight ? "<strong>" : ""}${escapeHtml(value)}${highlight ? "</strong>" : ""}</td></tr>`
    )
    .join("");
  return `<div style="background:#F4EBD7;border:1px solid #D4C8A8;padding:18px;margin:0 0 18px 0;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;margin-bottom:8px;">Bank bill-pay setup</div>
    <p style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:#1A0506;">Add Bench Grade Peptides as a payee in your bank's online bill-pay portal.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#1A0506;">
      ${rowHtml}
    </table>
    <p style="margin:12px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.6;color:#4A2528;">Schedule the cycle amount to arrive 3 business days before each due date and include the memo on every payment.</p>
  </div>`;
}

export function subscriptionStartedEmail(ctx: SubscriptionStartedContext): {
  subject: string;
  text: string;
  html: string;
} {
  const memo = subMemo(ctx.subscription_id);
  const subject = `Your subscription is active — ${memo}`;
  const customerName = escapeHtml(ctx.customer.name);
  const itemsText = ctx.items.map(lineText).join("\n");
  const cycleTotal = formatPrice(ctx.cycle_total_cents);
  const planTotal = formatPrice(ctx.plan_total_cents);
  const savings = formatPrice(ctx.savings_vs_retail_cents);
  const upcomingDates = ctx.upcoming_ship_dates.slice(0, 3);
  const portalUrl = `${SITE_URL}/account/subscription`;

  const text = [
    `${ctx.customer.name} —`,
    ``,
    `Welcome to your stack. Your subscription is active.`,
    ``,
    `Plan`,
    `----`,
    `Duration: ${ctx.plan_duration_months} month${ctx.plan_duration_months === 1 ? "" : "s"}`,
    `Ship cadence: ${shipCadenceLabel(ctx.ship_cadence)}`,
    `Payment: ${paymentCadenceLabel(ctx.payment_cadence)}`,
    `Per-cycle total: ${cycleTotal}`,
    `Plan total: ${planTotal}`,
    `Savings vs retail: ${savings}`,
    ``,
    `Stack`,
    `-----`,
    itemsText,
    ``,
    `Next ship date: ${ctx.next_ship_date}`,
    upcomingDates.length
      ? `Upcoming: ${upcomingDates.join(", ")}`
      : ``,
    ``,
    ctx.payment_cadence === "bill_pay" ? billPayInstructionsText(memo) + "\n" : ``,
    `View your subscription: ${portalUrl}`,
    ``,
    RUO_DISCLAIMER,
    ``,
    `Bench Grade Peptides · Made in USA`,
  ]
    .filter((line) => line !== ``)
    .join("\n");

  const upcomingHtml = upcomingDates.length
    ? `<p style="margin:6px 0 0 0;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#6B5350;letter-spacing:1px;">UPCOMING · ${upcomingDates
        .map((d) => escapeHtml(d))
        .join(" · ")}</p>`
    : "";

  const billPayBlock =
    ctx.payment_cadence === "bill_pay" ? billPayInstructionsHtml(memo) : "";

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${customerName} —</p>
    <p style="margin:0 0 14px 0;">Welcome to your stack. Your subscription is active and locked in at today's tier.</p>

    <div style="background:#FDFAF1;border:1px solid #D4C8A8;padding:18px;margin:0 0 18px 0;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;margin-bottom:8px;">Plan</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#1A0506;">
        <tr><td style="width:140px;color:#6B5350;padding:2px 0;">Duration</td><td>${ctx.plan_duration_months} month${ctx.plan_duration_months === 1 ? "" : "s"}</td></tr>
        <tr><td style="width:140px;color:#6B5350;padding:2px 0;">Ship cadence</td><td>${escapeHtml(shipCadenceLabel(ctx.ship_cadence))}</td></tr>
        <tr><td style="width:140px;color:#6B5350;padding:2px 0;">Payment</td><td>${escapeHtml(paymentCadenceLabel(ctx.payment_cadence))}</td></tr>
        <tr><td style="width:140px;color:#6B5350;padding:2px 0;">Per cycle</td><td><strong>${cycleTotal}</strong></td></tr>
        <tr><td style="width:140px;color:#6B5350;padding:2px 0;">Plan total</td><td>${planTotal}</td></tr>
        <tr><td style="width:140px;color:#6B5350;padding:2px 0;">You save</td><td style="color:#4A0E1A;"><strong>${savings}</strong></td></tr>
      </table>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;border-top:1px solid #1A0506;">
      ${itemRowsHtmlEditorial(ctx.items)}
    </table>

    <p style="margin:14px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#1A0506;">Next ship date: <strong>${escapeHtml(ctx.next_ship_date)}</strong>.</p>
    ${upcomingHtml}

    ${billPayBlock}`;

  const html = editorialEmailHtml({
    title: "Welcome to your stack.",
    bodyHtml,
    memo,
    cta: { label: "View your subscription", href: portalUrl },
  });

  return { subject, text, html };
}

export function subscriptionCycleShipNoticeEmail(
  ctx: SubscriptionCycleContext
): { subject: string; text: string; html: string } {
  const memo = subMemo(ctx.subscription_id);
  const subject = `Cycle ${ctx.cycle_number} of ${ctx.cycles_total} shipped — ${memo}`;
  const customerName = escapeHtml(ctx.customer.name);
  const portalUrl = `${SITE_URL}/account/subscription`;
  const isFinal = ctx.next_ship_date === null;

  const coaTextLines = ctx.coa_lot_urls.length
    ? ctx.coa_lot_urls.map((c) => `  ${c.sku} · lot ${c.lot} — ${c.url}`).join("\n")
    : `  COA available in your portal — ${portalUrl}`;

  const text = [
    `${ctx.customer.name} —`,
    ``,
    `Cycle ${ctx.cycle_number} of ${ctx.cycles_total} of your subscription has shipped.`,
    ``,
    `Tracking`,
    `--------`,
    `Carrier: ${ctx.tracking_carrier}`,
    `Number: ${ctx.tracking_number}`,
    `Track: ${ctx.tracking_url}`,
    ``,
    STORAGE_PANEL_TEXT,
    ``,
    `Certificates of analysis`,
    `------------------------`,
    coaTextLines,
    ``,
    isFinal
      ? `Final cycle of your plan.`
      : `Next ship date: ${ctx.next_ship_date}`,
    ``,
    `Subscription ${memo}`,
    `View in portal: ${portalUrl}`,
    ``,
    RUO_DISCLAIMER,
    ``,
    `Bench Grade Peptides · Made in USA`,
  ].join("\n");

  const coaHtml = ctx.coa_lot_urls.length
    ? `<ul style="margin:8px 0 0 0;padding-left:18px;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#1A0506;">${ctx.coa_lot_urls
        .map(
          (c) =>
            `<li style="margin-bottom:4px;">${escapeHtml(c.sku)} · lot ${escapeHtml(c.lot)} — <a href="${escapeHtml(c.url)}" style="color:#4A0E1A;text-decoration:underline;">view COA</a></li>`
        )
        .join("")}</ul>`
    : `<p style="margin:8px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#1A0506;">COA available in your portal — <a href="${escapeHtml(portalUrl)}" style="color:#4A0E1A;text-decoration:underline;">sign in to view</a>.</p>`;

  const nextShipHtml = isFinal
    ? `<p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#4A0E1A;"><strong>Final cycle of your plan.</strong></p>`
    : `<p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#1A0506;">Next ship date: <strong>${escapeHtml(ctx.next_ship_date ?? "")}</strong></p>`;

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${customerName} —</p>
    <p style="margin:0 0 18px 0;">Cycle <strong>${ctx.cycle_number}</strong> of <strong>${ctx.cycles_total}</strong> of your subscription has shipped.</p>

    <div style="background:#F4EBD7;border:1px solid #D4C8A8;padding:18px;margin:0 0 18px 0;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;margin-bottom:8px;">Tracking</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#1A0506;">
        <tr><td style="width:90px;color:#6B5350;padding:2px 0;">Carrier</td><td>${escapeHtml(ctx.tracking_carrier)}</td></tr>
        <tr><td style="width:90px;color:#6B5350;padding:2px 0;">Number</td><td><strong>${escapeHtml(ctx.tracking_number)}</strong></td></tr>
        <tr><td style="width:90px;color:#6B5350;padding:2px 0;">Status</td><td><a href="${escapeHtml(ctx.tracking_url)}" style="color:#4A0E1A;text-decoration:underline;">Track shipment</a></td></tr>
      </table>
    </div>

    <div style="background:#FDFAF1;border:1px solid #D4C8A8;padding:18px;margin:0 0 18px 0;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;margin-bottom:8px;">Storage &amp; handling</div>
      <p style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:#1A0506;">Lyophilized vials: 2–8°C refrigerated (or –20°C for 6+ months).</p>
      <p style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:#1A0506;">Light-protect; do not freeze-thaw repeatedly.</p>
      <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:#1A0506;">Reconstitute only when ready to use; per-peptide reconstituted shelf life on the COA enclosed.</p>
    </div>

    <div style="margin-bottom:18px;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;">Certificates of analysis</div>
      ${coaHtml}
    </div>

    ${nextShipHtml}`;

  const html = editorialEmailHtml({
    title: `Cycle ${ctx.cycle_number} of ${ctx.cycles_total} has shipped.`,
    bodyHtml,
    memo,
    cta: { label: "Track shipment", href: ctx.tracking_url },
  });

  return { subject, text, html };
}

export function subscriptionPaymentDueEmail(
  ctx: SubscriptionPaymentDueContext
): { subject: string; text: string; html: string } {
  const memo = ctx.subscription_memo || subMemo(ctx.subscription_id);
  const subject = `Payment due in ${ctx.days_remaining} days — Cycle ${ctx.cycle_number} of ${ctx.cycles_total}`;
  const customerName = escapeHtml(ctx.customer.name);
  const cycleTotal = formatPrice(ctx.cycle_total_cents);

  const text = [
    `${ctx.customer.name} —`,
    ``,
    `Cycle ${ctx.cycle_number} of ${ctx.cycles_total} is due. Please send payment via your bank's bill-pay within ${ctx.days_remaining} days to avoid losing this cycle.`,
    ``,
    `Amount due: ${cycleTotal}`,
    `Due date: ${ctx.due_date}`,
    `Memo: ${memo}`,
    ``,
    `Grace period`,
    `------------`,
    `If we don't see your payment within 5 days of the due date, this cycle is automatically cancelled. You keep the remaining cycles in your plan — only this cycle is forfeited.`,
    ``,
    `Set up bill-pay or schedule the payment: ${ctx.bill_pay_setup_url}`,
    ``,
    RUO_DISCLAIMER,
    ``,
    `Bench Grade Peptides · Made in USA`,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${customerName} —</p>
    <p style="margin:0 0 14px 0;">Cycle <strong>${ctx.cycle_number}</strong> of <strong>${ctx.cycles_total}</strong> of your subscription is due. Please send payment via bank bill-pay within <strong>${ctx.days_remaining} days</strong>.</p>

    <div style="background:#F4EBD7;border:1px solid #D4C8A8;padding:18px;margin:0 0 18px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#1A0506;">
        <tr><td style="width:120px;color:#6B5350;padding:2px 0;">Amount</td><td><strong>${cycleTotal}</strong></td></tr>
        <tr><td style="width:120px;color:#6B5350;padding:2px 0;">Due date</td><td>${escapeHtml(ctx.due_date)}</td></tr>
        <tr><td style="width:120px;color:#6B5350;padding:2px 0;">Memo</td><td style="color:#4A0E1A;"><strong>${escapeHtml(memo)}</strong></td></tr>
      </table>
    </div>

    <p style="margin:0 0 14px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#4A2528;"><strong>5-day grace period.</strong> If we don't see your payment within 5 days of the due date, this cycle is automatically cancelled. You keep the remaining cycles in your plan — only this cycle is forfeited.</p>`;

  const html = editorialEmailHtml({
    title: `Payment due in ${ctx.days_remaining} days.`,
    bodyHtml,
    memo,
    cta: { label: "Pay now via bank bill pay", href: ctx.bill_pay_setup_url },
  });

  return { subject, text, html };
}

export function subscriptionRenewalEmail(
  ctx: SubscriptionRenewalContext
): { subject: string; text: string; html: string } {
  const memo = subMemo(ctx.subscription_id);
  const subject = `Your subscription ends in ${ctx.plan_ends_in_days} days — renew at the same rate`;
  const customerName = escapeHtml(ctx.customer.name);
  const savings = formatPrice(ctx.savings_to_date_cents);

  const text = [
    `${ctx.customer.name} —`,
    ``,
    `Your ${ctx.plan_duration_months}-month subscription ends in ${ctx.plan_ends_in_days} days. You can renew at the same ${ctx.discount_percent}% discount tier — one click, same stack, no price change.`,
    ``,
    `Savings to date: ${savings}`,
    `Renewal discount: ${ctx.discount_percent}% off`,
    ``,
    `Renew: ${ctx.renew_url}`,
    ``,
    `If you'd rather not renew, no action needed — your subscription simply ends at the close of the current cycle.`,
    ``,
    RUO_DISCLAIMER,
    ``,
    `Bench Grade Peptides · Made in USA`,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${customerName} —</p>
    <p style="margin:0 0 14px 0;">Your ${ctx.plan_duration_months}-month subscription ends in <strong>${ctx.plan_ends_in_days} days</strong>. Renew at the same <strong>${ctx.discount_percent}%</strong> discount tier — one click, same stack, same rate.</p>

    <div style="background:#FDFAF1;border:1px solid #D4C8A8;padding:18px;margin:0 0 18px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#1A0506;">
        <tr><td style="width:160px;color:#6B5350;padding:2px 0;">Savings to date</td><td><strong>${savings}</strong></td></tr>
        <tr><td style="width:160px;color:#6B5350;padding:2px 0;">Renewal discount</td><td style="color:#4A0E1A;"><strong>${ctx.discount_percent}% off</strong></td></tr>
      </table>
    </div>

    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#6B5350;line-height:1.6;">If you'd rather not renew, no action needed — your subscription ends at the close of the current cycle.</p>`;

  const html = editorialEmailHtml({
    title: "Renew at today's rate.",
    bodyHtml,
    memo,
    cta: { label: `Renew at ${ctx.discount_percent}% off`, href: ctx.renew_url },
  });

  return { subject, text, html };
}

// ---------- Sprint 3 Wave A3: messaging + referral lifecycle emails ----------

export interface MessageNotificationContext {
  customer_name: string;
  message_id: string;
  /** Already-truncated preview (caller passes first ~60 chars). */
  message_preview: string;
  thread_url: string;
  /** Hint that the preview was truncated, so we append an ellipsis cue. */
  truncated?: boolean;
}

export interface ReferralEarnedContext {
  customer_name: string;
  referee_email: string;
  referral_count: number;
  free_vial_size_mg: number;
}

export function messageNotificationEmail(ctx: MessageNotificationContext): {
  subject: string;
  text: string;
  html: string;
} {
  const ref = ctx.message_id.slice(0, 8);
  const memo = `BGP-MSG-${ref}`;
  const subject = `New message from Bench Grade · ${memo}`;
  const customerName = escapeHtml(ctx.customer_name);
  const previewSafe = escapeHtml(ctx.message_preview);
  const ellipsis = ctx.truncated ? "…" : "";
  const safeUrl = escapeHtml(ctx.thread_url);

  const text = [
    `${ctx.customer_name} —`,
    ``,
    `You have a new message from our team.`,
    ``,
    `Preview: ${ctx.message_preview}${ellipsis}`,
    ``,
    `Open the thread to read the full message and reply: ${ctx.thread_url}`,
    ``,
    RUO_DISCLAIMER,
    ``,
    `Bench Grade Peptides · Made in USA`,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${customerName} —</p>
    <p style="margin:0 0 14px 0;">You have a new message from our team. Open the thread to read the full message and reply.</p>

    <div style="background:#F4EBD7;border:1px solid #D4C8A8;padding:18px;margin:0 0 18px 0;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;margin-bottom:8px;">Preview</div>
      <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:#1A0506;font-style:italic;">${previewSafe}${ellipsis}</p>
    </div>`;

  const html = editorialEmailHtml({
    title: "A new message awaits.",
    bodyHtml,
    memo,
    cta: { label: "Open thread", href: ctx.thread_url },
  });

  // Reference safeUrl so future maintainers can read it; CTA already escapes.
  void safeUrl;

  return { subject, text, html };
}

export function referralEarnedEmail(ctx: ReferralEarnedContext): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Free vial earned — your friend's first order shipped`;
  const customerName = escapeHtml(ctx.customer_name);
  const refereeEmailSafe = escapeHtml(ctx.referee_email);
  const ctaHref = "/catalogue?free_vial=true";
  const memo = `REFERRAL · ${ctx.referral_count} of yours`;

  const text = [
    `${ctx.customer_name} —`,
    ``,
    `Your referral made it. ${ctx.referee_email}'s order shipped today.`,
    ``,
    `A free ${ctx.free_vial_size_mg}mg vial of your choice has been added to your account — pick at next checkout.`,
    ``,
    `Successful referrals to date: ${ctx.referral_count}`,
    ``,
    `Pick your free vial: ${ctaHref}`,
    ``,
    RUO_DISCLAIMER,
    ``,
    `Bench Grade Peptides · Made in USA`,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${customerName} —</p>
    <p style="margin:0 0 14px 0;">Your referral made it. <strong>${refereeEmailSafe}</strong>'s order shipped today.</p>

    <div style="background:#F4EBD7;border:1px solid #D4C8A8;padding:18px;margin:0 0 18px 0;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;margin-bottom:8px;">Reward</div>
      <p style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.6;color:#1A0506;">A free <strong>${ctx.free_vial_size_mg}mg</strong> vial of your choice has been added to your account — pick at next checkout.</p>
      <p style="margin:0;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#6B5350;letter-spacing:1px;">SUCCESSFUL REFERRALS · ${ctx.referral_count}</p>
    </div>`;

  const html = editorialEmailHtml({
    title: "Free vial earned.",
    bodyHtml,
    memo,
    cta: { label: "Pick your free vial", href: ctaHref },
  });

  return { subject, text, html };
}

// ---------- Sprint 4 Wave A3: affiliate transactional emails ----------

export type AffiliateTier = "bronze" | "silver" | "gold" | "eminent";
export type AffiliatePayoutMethod = "zelle" | "crypto" | "wire";

export interface AffiliateApplicationApprovedContext {
  name: string;
  tier: AffiliateTier;
  commission_pct: number;
  referral_link_url: string;
  dashboard_url: string;
}

export interface AffiliateCommissionEarnedContext {
  name: string;
  affiliate_id: string;
  monthly_total_cents: number;
  ledger_count: number;
  available_balance_cents: number;
  /** Human label like "April 2026" — caller-supplied. */
  period_label: string;
}

export interface AffiliatePayoutSentContext {
  name: string;
  amount_cents: number;
  method: AffiliatePayoutMethod;
  external_reference?: string;
}

function tierLabel(t: AffiliateTier): string {
  switch (t) {
    case "bronze":
      return "Bronze";
    case "silver":
      return "Silver";
    case "gold":
      return "Gold";
    case "eminent":
      return "Eminent";
  }
}

function payoutMethodLabel(m: AffiliatePayoutMethod): string {
  switch (m) {
    case "zelle":
      return "Zelle";
    case "crypto":
      return "Crypto";
    case "wire":
      return "Wire";
  }
}

function payoutMethodInstructionsText(
  m: AffiliatePayoutMethod,
  ref?: string
): string {
  const refLine = ref ? `Reference: ${ref}\n` : "";
  switch (m) {
    case "zelle":
      return `${refLine}Zelle deposits typically arrive within minutes at most major US banks.`;
    case "crypto":
      return `${refLine}On-chain confirmation depends on network — usually 10-60 minutes.`;
    case "wire":
      return `${refLine}Domestic wires typically settle within 1 business day.`;
  }
}

function payoutMethodInstructionsHtml(
  m: AffiliatePayoutMethod,
  ref?: string
): string {
  const refRow = ref
    ? `<tr><td style="width:120px;color:#6B5350;padding:2px 0;">Reference</td><td style="color:#4A0E1A;"><strong>${escapeHtml(ref)}</strong></td></tr>`
    : "";
  let footer = "";
  switch (m) {
    case "zelle":
      footer =
        "Zelle deposits typically arrive within minutes at most major US banks.";
      break;
    case "crypto":
      footer =
        "On-chain confirmation depends on network — usually 10-60 minutes.";
      break;
    case "wire":
      footer = "Domestic wires typically settle within 1 business day.";
      break;
  }
  return `<div style="background:#F4EBD7;border:1px solid #D4C8A8;padding:18px;margin:0 0 18px 0;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;margin-bottom:8px;">Payout details</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#1A0506;">
      <tr><td style="width:120px;color:#6B5350;padding:2px 0;">Method</td><td>${escapeHtml(payoutMethodLabel(m))}</td></tr>
      ${refRow}
    </table>
    <p style="margin:12px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.6;color:#4A2528;">${escapeHtml(footer)}</p>
  </div>`;
}

export function affiliateApplicationApprovedEmail(
  ctx: AffiliateApplicationApprovedContext
): { subject: string; text: string; html: string } {
  const subject = "Welcome to the Bench Grade Affiliate Program";
  const customerName = escapeHtml(ctx.name);
  const safeLink = escapeHtml(ctx.referral_link_url);
  const tier = tierLabel(ctx.tier);
  const memo = `AFFILIATE · ${tier.toUpperCase()}`;

  const text = [
    `${ctx.name} —`,
    ``,
    `Your application is approved. You're now a ${tier} affiliate, earning ${ctx.commission_pct}% commission on every referred order, for life.`,
    ``,
    `Your referral link:`,
    ctx.referral_link_url,
    ``,
    `Open dashboard: ${ctx.dashboard_url}`,
    ``,
    RUO_DISCLAIMER,
    ``,
    `Bench Grade Peptides · Made in USA`,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${customerName} —</p>
    <p style="margin:0 0 14px 0;">Your application is approved. You're now a <strong>${escapeHtml(tier)}</strong> affiliate, earning <strong>${ctx.commission_pct}%</strong> commission on every referred order, for life.</p>

    <div style="background:#F4EBD7;border:1px solid #D4C8A8;padding:18px;margin:0 0 18px 0;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B5350;margin-bottom:8px;">Your referral link</div>
      <p style="margin:0;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#4A0E1A;word-break:break-all;">${safeLink}</p>
    </div>

    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#6B5350;line-height:1.6;">Share your link, earn commission on every confirmed order. The dashboard tracks clicks, conversions, and balances in real time.</p>`;

  const html = editorialEmailHtml({
    title: "Welcome to the program.",
    bodyHtml,
    memo,
    cta: { label: "Open dashboard", href: ctx.dashboard_url },
  });

  return { subject, text, html };
}

export function affiliateCommissionEarnedEmail(
  ctx: AffiliateCommissionEarnedContext
): { subject: string; text: string; html: string } {
  const first8 = ctx.affiliate_id.slice(0, 8);
  const memo = `BGP-AFF-${first8}`;
  const monthlyTotal = formatPrice(ctx.monthly_total_cents);
  const availableBalance = formatPrice(ctx.available_balance_cents);
  const subject = `You earned ${monthlyTotal} this month — ${memo}`;
  const customerName = escapeHtml(ctx.name);
  const dashboardUrl = `${SITE_URL}/account/affiliate`;

  const text = [
    `${ctx.name} —`,
    ``,
    `Here's your earnings for ${ctx.period_label}: ${monthlyTotal} across ${ctx.ledger_count} referred orders.`,
    ``,
    `Available balance: ${availableBalance}`,
    ``,
    `View ledger: ${dashboardUrl}`,
    ``,
    RUO_DISCLAIMER,
    ``,
    `Bench Grade Peptides · Made in USA`,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${customerName} —</p>
    <p style="margin:0 0 14px 0;">Here's your earnings for <strong>${escapeHtml(ctx.period_label)}</strong>: <strong>${monthlyTotal}</strong> across <strong>${ctx.ledger_count}</strong> referred orders.</p>

    <div style="background:#F4EBD7;border:1px solid #D4C8A8;padding:18px;margin:0 0 18px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#1A0506;">
        <tr><td style="width:160px;color:#6B5350;padding:2px 0;">Earned this month</td><td><strong>${monthlyTotal}</strong></td></tr>
        <tr><td style="width:160px;color:#6B5350;padding:2px 0;">Referred orders</td><td>${ctx.ledger_count}</td></tr>
        <tr><td style="width:160px;color:#6B5350;padding:2px 0;">Available balance</td><td style="color:#4A0E1A;"><strong>${availableBalance}</strong></td></tr>
      </table>
    </div>`;

  const html = editorialEmailHtml({
    title: `You earned ${monthlyTotal}.`,
    bodyHtml,
    memo,
    cta: { label: "View ledger", href: dashboardUrl },
  });

  return { subject, text, html };
}

export function affiliatePayoutSentEmail(
  ctx: AffiliatePayoutSentContext
): { subject: string; text: string; html: string } {
  const amount = formatPrice(ctx.amount_cents);
  const method = payoutMethodLabel(ctx.method);
  const subject = `Payout sent: ${amount} via ${method}`;
  const customerName = escapeHtml(ctx.name);
  const dashboardUrl = `${SITE_URL}/account/affiliate`;
  const memo = `PAYOUT · ${method.toUpperCase()}`;
  const refLine = ctx.external_reference
    ? `Reference: ${ctx.external_reference}\n`
    : "";

  const text = [
    `${ctx.name} —`,
    ``,
    `We sent ${amount} to your ${method} account.`,
    refLine ? refLine.trimEnd() : "",
    `Allow 1–3 business days to clear.`,
    ``,
    payoutMethodInstructionsText(ctx.method, ctx.external_reference),
    ``,
    `View affiliate dashboard: ${dashboardUrl}`,
    ``,
    RUO_DISCLAIMER,
    ``,
    `Bench Grade Peptides · Made in USA`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  const bodyHtml = `
    <p style="margin:0 0 14px 0;">${customerName} —</p>
    <p style="margin:0 0 14px 0;">We sent <strong>${amount}</strong> to your <strong>${escapeHtml(method)}</strong> account. Allow 1–3 business days to clear.</p>

    ${payoutMethodInstructionsHtml(ctx.method, ctx.external_reference)}`;

  const html = editorialEmailHtml({
    title: `Payout sent: ${amount}.`,
    bodyHtml,
    memo,
    cta: { label: "View affiliate dashboard", href: dashboardUrl },
  });

  return { subject, text, html };
}
