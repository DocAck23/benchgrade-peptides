import type { CartItem } from "@/lib/cart/types";
import type { CustomerInfo } from "@/app/actions/orders";
import { formatPrice } from "@/lib/utils";
import { SITE_URL } from "@/lib/site";

interface OrderContext {
  order_id: string;
  customer: CustomerInfo;
  items: CartItem[];
  subtotal_cents: number;
}

/**
 * Escape arbitrary user-controlled text for safe HTML interpolation.
 * We use string-concat rather than a JSX email framework, so every
 * user-controlled substitution MUST pass through this. An attacker
 * who orders with `name = "<script>..."` would otherwise land that
 * markup in both the customer confirmation and the admin notification.
 */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function line(i: CartItem): string {
  return `${i.name} — ${i.size_mg}mg × ${i.quantity}  ${formatPrice(
    i.unit_price * i.quantity * 100
  )}`;
}

/**
 * Customer-facing order confirmation + wire instructions.
 * Wire details are placeholders until the real bank account is open;
 * fill in WIRE_* env vars once Mercury/Relay onboarding completes.
 */
export function orderConfirmationEmail(ctx: OrderContext): { subject: string; text: string; html: string } {
  const lines = ctx.items.map(line).join("\n");
  const total = formatPrice(ctx.subtotal_cents);
  const ref = ctx.order_id.slice(0, 8);

  const wireBeneficiary = process.env.WIRE_BENEFICIARY ?? "Bench Grade Peptides LLC";
  const wireBank = process.env.WIRE_BANK ?? "[Bank name — pending]";
  const wireRouting = process.env.WIRE_ROUTING ?? "[Routing — pending]";
  const wireAccount = process.env.WIRE_ACCOUNT ?? "[Account — pending]";
  const wireMemo = `BGP-${ref}`;

  const subject = `Order received — ${wireMemo}`;
  const text = `Thank you for your order.

Order: ${ctx.order_id}
Memo (include on wire): ${wireMemo}

Items
-----
${lines}

Total: ${total}
Shipping: calculated after payment clears

Wire transfer instructions
--------------------------
Beneficiary: ${wireBeneficiary}
Bank: ${wireBank}
Routing / ABA: ${wireRouting}
Account: ${wireAccount}
Memo / reference: ${wireMemo}

Please include the memo on the wire so we can match it to your order.
We ship within 1–2 business days of funds clearing.

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
          ${i.size_mg}mg · ${escapeHtml(i.sku)} × ${i.quantity}
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
        <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;color:#5a5a5a;margin-top:4px;">${wireMemo}</div>
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

      <tr><td style="padding:0 28px 28px 28px;">
        <div style="background:#EFEAE1;border:1px solid #d7d1c4;padding:18px;">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#0A5C7D;margin-bottom:10px;">Wire transfer instructions</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;color:#1A1A1A;">
            <tr><td style="padding:3px 0;color:#5a5a5a;width:140px;">Beneficiary</td><td>${escapeHtml(wireBeneficiary)}</td></tr>
            <tr><td style="padding:3px 0;color:#5a5a5a;">Bank</td><td>${escapeHtml(wireBank)}</td></tr>
            <tr><td style="padding:3px 0;color:#5a5a5a;">Routing / ABA</td><td>${escapeHtml(wireRouting)}</td></tr>
            <tr><td style="padding:3px 0;color:#5a5a5a;">Account</td><td>${escapeHtml(wireAccount)}</td></tr>
            <tr><td style="padding:3px 0;color:#5a5a5a;">Memo</td><td style="color:#0A5C7D;"><strong>${escapeHtml(wireMemo)}</strong></td></tr>
          </table>
          <div style="font-size:12px;color:#5a5a5a;margin-top:12px;line-height:1.5;">
            Include the memo on the wire so we can match it to your order.
            We ship within 1–2 business days of funds clearing.
          </div>
        </div>
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

/**
 * Internal notification to the admin email.
 * Short, scannable — links back to the admin dashboard.
 */
export function adminOrderNotification(ctx: OrderContext): { subject: string; text: string; html: string } {
  const lines = ctx.items.map(line).join("\n");
  const total = formatPrice(ctx.subtotal_cents);
  const subject = `[BGP] New order — ${ctx.customer.name} · ${total}`;
  const adminLink = `${SITE_URL}/admin/orders/${ctx.order_id}`;
  const text = `New order placed.

Customer: ${ctx.customer.name} <${ctx.customer.email}>
${ctx.customer.institution ? "Institution: " + ctx.customer.institution + "\n" : ""}${
    ctx.customer.phone ? "Phone: " + ctx.customer.phone + "\n" : ""
  }Ship to: ${ctx.customer.ship_address_1}, ${ctx.customer.ship_city}, ${ctx.customer.ship_state} ${ctx.customer.ship_zip}

Items
-----
${lines}

Total: ${total}
Order: ${ctx.order_id}
${adminLink}
`;
  const html = `<!doctype html><html><body style="font-family:Inter,system-ui,sans-serif;color:#1A1A1A;background:#F7F4EE;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #d7d1c4;padding:24px;">
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5a5a5a;">New order</div>
    <div style="font-family:Geist,system-ui,sans-serif;font-size:20px;margin-top:4px;">${escapeHtml(ctx.customer.name)} — ${total}</div>
    <pre style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#1A1A1A;background:#EFEAE1;padding:14px;white-space:pre-wrap;margin-top:16px;">${escapeHtml(text)}</pre>
    <a href="${escapeHtml(adminLink)}" style="display:inline-block;margin-top:12px;background:#1A1A1A;color:#F7F4EE;text-decoration:none;padding:10px 18px;font-size:13px;">Open in admin →</a>
  </div>
</body></html>`;
  return { subject, text, html };
}
