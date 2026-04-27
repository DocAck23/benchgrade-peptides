/**
 * Escape Postgres `LIKE` / `ILIKE` metacharacters so a user-supplied
 * value matches as a literal string.
 *
 * Without this, an email like `a_b@example.com` (legal RFC 5321 local
 * part) acts as a wildcard via the `_` metacharacter and matches
 * other customers' emails (`aXb@example.com`, etc). That's a real
 * data-leak vector when the matched query gates first-time-buyer
 * status, redemption caps, or any other identity-bound logic.
 *
 * The Supabase JS client passes our string through as the right-hand
 * side of `ILIKE`, so the escape has to happen client-side. We use
 * the standard backslash-escape and pair it with `.ilike()`'s default
 * escape character (backslash) — no need to set `escape` explicitly.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}
