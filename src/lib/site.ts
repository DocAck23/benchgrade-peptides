export const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
})();

export const SITE_NAME = "Bench Grade Peptides";

/** Free-shipping threshold in whole dollars. Tuned above single-vial pricing
 *  so a 2-item cart unlocks it. Surfaced in cart drawer + checkout summary. */
export const FREE_SHIPPING_THRESHOLD = 150;
