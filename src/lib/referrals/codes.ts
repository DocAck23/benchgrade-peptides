/**
 * Referral code helpers (Sprint 3 Wave A2).
 *
 * `generateReferralCode` produces memorable 7–9 char slugs from an
 * unambiguous alphabet (no I/O/0/1). Caller is responsible for checking
 * generated codes against the DB for uniqueness — collisions are statistically
 * rare but possible.
 *
 * `validateReferralCode` is intentionally looser than the generator
 * (4–12 chars) so admins can hand-set vanity codes (e.g. "PARTNER1") without
 * having to match the generated length.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const VALIDATE_RE = /^[A-Z0-9]{4,12}$/;

/**
 * Generate a memorable referral slug, 7-9 chars from
 * `[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]` (no ambiguous chars I/O/0/1).
 * Caller is responsible for collision-detection against the DB.
 */
export function generateReferralCode(): string {
  // Pick length uniformly in {7,8,9}.
  const length = 7 + Math.floor(Math.random() * 3);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/**
 * Validate a referral code matches the format we accept.
 * `^[A-Z0-9]{4,12}$` — accepts our generated 7-9 char codes plus
 * legacy / admin-set 4-12 char codes.
 */
export function validateReferralCode(code: string): boolean {
  if (typeof code !== "string") return false;
  return VALIDATE_RE.test(code);
}
