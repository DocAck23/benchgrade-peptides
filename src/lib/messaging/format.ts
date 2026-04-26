/**
 * Pure-function helpers for in-app messaging formatting (Sprint 3 Wave A2).
 *
 * `composeMessageHtml` mirrors the `escapeHtml` pattern in
 * `src/lib/email/templates.ts` so user-supplied chat bodies never bypass the
 * same XSS defenses we apply to email bodies. The only addition is a
 * line-break preservation pass: messaging UIs render multi-paragraph bodies,
 * so newlines become `<br>` after escaping (so `<script>\n…` cannot become a
 * tag).
 */

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape user-supplied message body for HTML, preserve line breaks via <br>. */
export function composeMessageHtml(body: string): string {
  // Escape FIRST (so `<` becomes `&lt;`), then convert newlines.
  // Normalize \r\n → \n before splitting so Windows line endings collapse.
  const escaped = escapeHtml(body).replace(/\r\n/g, "\n");
  return escaped.replace(/\n/g, "<br>");
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Format an ISO timestamp for display: "Apr 25 · 4:18 pm".
 * Renders in UTC so the format is invariant across server/client/tz.
 * Returns "" for invalid input.
 */
export function formatThreadTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const month = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hours24 = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const ampm = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const mm = minutes.toString().padStart(2, "0");
  return `${month} ${day} · ${hours12}:${mm} ${ampm}`;
}
