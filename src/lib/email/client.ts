import { Resend } from "resend";

let cached: Resend | null | undefined;

export function getResend(): Resend | null {
  if (cached !== undefined) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    cached = null;
    return null;
  }
  cached = new Resend(key);
  return cached;
}

export const EMAIL_FROM = (() => {
  const addr = process.env.RESEND_FROM_EMAIL ?? "admin@benchgradepeptides.com";
  const name = process.env.RESEND_FROM_NAME ?? "Bench Grade Peptides";
  return `${name} <${addr}>`;
})();

export const ADMIN_NOTIFICATION_EMAIL =
  process.env.ADMIN_NOTIFICATION_EMAIL ?? "admin@benchgradepeptides.com";
