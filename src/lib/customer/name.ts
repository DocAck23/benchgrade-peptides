/**
 * First-name extraction with legacy fallback.
 *
 * New orders store first_name/last_name directly. Orders predating
 * sprint G only have a single composed `name` — we split on the first
 * whitespace run as a best-effort. Trailing punctuation (e.g. "Dr.")
 * stays attached; we don't try to be cleverer than that.
 *
 * Returns `null` when no usable name is available so callers can
 * decide whether to fall back to a generic greeting.
 */
export function firstNameOf(customer: {
  first_name?: string | null;
  name?: string | null;
}): string | null {
  const explicit = customer.first_name?.trim();
  if (explicit) return explicit;
  const composed = customer.name?.trim();
  if (!composed) return null;
  const head = composed.split(/\s+/, 1)[0];
  return head || null;
}
