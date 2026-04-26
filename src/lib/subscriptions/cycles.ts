import type { ShipCadence } from "./discounts";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute the next cycle date given a start date and cadence.
 * Returns null when ship_cadence is 'once'.
 *
 * Monthly = +30 days
 * Quarterly = +90 days
 * Once = null
 *
 * We use day deltas (not calendar months) for predictability — a customer
 * who starts on the 31st is shipped every 30 days, not on the 31st of every
 * month (which doesn't exist for some months).
 */
export function nextCycleDate(start: Date, ship_cadence: ShipCadence): Date | null {
  if (ship_cadence === "once") return null;
  const days = ship_cadence === "quarterly" ? 90 : 30;
  return new Date(start.getTime() + days * DAY_MS);
}

export interface BillPayInstructionsInput {
  cycle_total_cents: number;
  next_charge_date: Date;
  subscription_memo: string;
  beneficiary_name: string;
  beneficiary_routing: string;
  beneficiary_account: string;
}

export interface BillPayInstructions {
  text: string;
  html: string;
}

function formatUSD(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${remainder.toString().padStart(2, "0")}`;
}

function formatISODate(d: Date): string {
  // YYYY-MM-DD in UTC
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generate the customer-facing bank bill-pay setup instructions.
 * Email-safe: system font fallbacks only, no web fonts, table-based layout.
 */
export function billPayInstructions(input: BillPayInstructionsInput): BillPayInstructions {
  const amount = formatUSD(input.cycle_total_cents);
  const dueDate = formatISODate(input.next_charge_date);
  const memo = input.subscription_memo;
  const name = input.beneficiary_name;
  const routing = input.beneficiary_routing;
  const account = input.beneficiary_account;

  const text = [
    "Set up a recurring monthly bank bill-pay with the following details:",
    "",
    `  Beneficiary:    ${name}`,
    `  Routing #:      ${routing}`,
    `  Account #:      ${account}`,
    `  Memo / Ref:     ${memo}    (REQUIRED — used to match payment to your subscription)`,
    `  Amount:         ${amount}`,
    `  First payment:  ${dueDate}`,
    `  Frequency:      Monthly recurring transfer`,
    "",
    "Steps:",
    "  • Log in to your bank's bill-pay or external transfer page",
    "  • Add a new payee with the beneficiary name, routing, and account above",
    `  • Set up a monthly recurring transfer of ${amount} starting ${dueDate}`,
    `  • Include "${memo}" in the memo / reference field — without it we cannot match your payment`,
    "",
    "Questions: reply to this email and we'll help you get set up.",
  ].join("\n");

  const labelStyle = "font-weight:700;padding:6px 12px 6px 0;vertical-align:top;";
  const valueStyle =
    'padding:6px 0;vertical-align:top;font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,Courier,monospace;';
  const memoStyle =
    'padding:6px 0;vertical-align:top;font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,Courier,monospace;font-weight:700;background:#fff5cc;padding:8px 10px;';

  const row = (label: string, value: string, isMemo = false) =>
    `<tr><td style="${labelStyle}"><strong>${escapeHtml(label)}</strong></td>` +
    `<td style="${isMemo ? memoStyle : valueStyle}">${escapeHtml(value)}</td></tr>`;

  const html = [
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;font-size:14px;line-height:1.5;">`,
    `<p style="margin:0 0 12px 0;">Set up a recurring monthly bank bill-pay with the following details:</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 16px 0;">`,
    row("Beneficiary", name),
    row("Routing #", routing),
    row("Account #", account),
    row("Memo / Ref", memo, true),
    row("Amount", amount),
    row("First payment", dueDate),
    row("Frequency", "Monthly recurring transfer"),
    `</table>`,
    `<p style="margin:0 0 6px 0;"><strong>Steps:</strong></p>`,
    `<ul style="margin:0 0 12px 18px;padding:0;">`,
    `<li>Log in to your bank's bill-pay or external transfer page.</li>`,
    `<li>Add a new payee with the beneficiary name, routing, and account above.</li>`,
    `<li>Set up a <strong>monthly recurring transfer</strong> of <strong>${escapeHtml(amount)}</strong> starting <strong>${escapeHtml(dueDate)}</strong>.</li>`,
    `<li>Include <strong>${escapeHtml(memo)}</strong> in the memo / reference field — without it we cannot match your payment.</li>`,
    `</ul>`,
    `<p style="margin:0;color:#555;">Questions? Reply to this email and we'll help you get set up.</p>`,
    `</div>`,
  ].join("");

  return { text, html };
}
