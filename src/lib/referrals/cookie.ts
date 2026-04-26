/**
 * Referral attribution cookie (Sprint 3 Wave A2).
 *
 * Cookie value format: `<code>|<attributedAtMs>` (pipe-delimited, no JSON).
 * Avoiding JSON eliminates a whole class of parser-confusion bugs and keeps
 * the cookie short. `code` is constrained to `[A-Z0-9]{4,12}` (validated on
 * read), and `attributedAt` is a base-10 integer ms epoch.
 *
 * Cookie attributes:
 *   - 60-day Max-Age (matches the parse-side staleness check)
 *   - HttpOnly  (server-only — JS cannot read or overwrite)
 *   - SameSite=Lax (allow top-level nav from referral URLs, block CSRF POST)
 *   - Path=/    (every page can read on the request side)
 *   - Secure    (only in prod; opt-out for local http dev via `secure: false`)
 */

import { validateReferralCode } from "./codes";

export const REFERRAL_COOKIE_NAME = "bgp_ref";

/** 60 days, in seconds (Max-Age) and ms (parse-side staleness check). */
const SIXTY_DAYS_S = 60 * 60 * 24 * 60;
const SIXTY_DAYS_MS = SIXTY_DAYS_S * 1000;

export interface ReferralAttribution {
  code: string;
  attributedAt: number; // ms epoch
}

/** Read the referral attribution cookie if present and not expired (60d). */
export function parseReferralCookie(
  cookieHeader: string | null,
): ReferralAttribution | null {
  if (!cookieHeader) return null;

  // Parse `Cookie: a=1; b=2; bgp_ref=...` form.
  const parts = cookieHeader.split(/;\s*/);
  let raw: string | null = null;
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const name = p.slice(0, eq).trim();
    if (name === REFERRAL_COOKIE_NAME) {
      raw = p.slice(eq + 1);
      break;
    }
  }
  if (raw === null || raw === "") return null;

  // Decode pipe-delimited value.
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // bad %-encoding — treat as malformed
    return null;
  }

  const pipe = value.indexOf("|");
  if (pipe === -1) return null;
  const code = value.slice(0, pipe);
  const tsRaw = value.slice(pipe + 1);
  if (!validateReferralCode(code)) return null;

  const attributedAt = Number.parseInt(tsRaw, 10);
  if (!Number.isFinite(attributedAt) || attributedAt <= 0) return null;
  // Reject obvious nonsense (future-dated by more than a day's clock skew).
  if (attributedAt > Date.now() + 24 * 60 * 60 * 1000) return null;
  // Expired (>60d old)?
  if (Date.now() - attributedAt > SIXTY_DAYS_MS) return null;

  return { code, attributedAt };
}

/**
 * Build a `Set-Cookie` header value to attribute a referral.
 * 60-day expiry, HttpOnly, SameSite=Lax, Path=/, Secure in production.
 *
 * @param code already-validated referral code
 * @param opts.now optional epoch ms (default Date.now()) for testability
 * @param opts.secure boolean — set Secure flag (true in prod)
 */
export function buildReferralCookie(
  code: string,
  opts: { now?: number; secure?: boolean } = {},
): string {
  const now = opts.now ?? Date.now();
  const secure = opts.secure ?? false;
  const value = `${code}|${now}`;
  const parts = [
    `${REFERRAL_COOKIE_NAME}=${value}`,
    `Max-Age=${SIXTY_DAYS_S}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
