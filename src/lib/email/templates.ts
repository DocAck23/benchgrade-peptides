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
