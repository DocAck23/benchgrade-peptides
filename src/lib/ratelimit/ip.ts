/**
 * Resolve the caller's IP from forwarded headers. Prefers Vercel's
 * edge-set `x-vercel-forwarded-for` (non-spoofable on Vercel) with
 * fallbacks for other deployment targets.
 *
 * Returns an error in production when the IP can't be determined so a
 * single shared "unknown" bucket doesn't collapse every anonymous
 * caller into one counter (which an attacker could use to lock
 * everyone else out). In dev we allow it so local testing works.
 */
export type HeaderLike = Pick<Headers, "get">;

export type IpResolution =
  | { ok: true; ip: string }
  | { ok: false; reason: string };

export function resolveClientIp(
  headers: HeaderLike,
  opts: { isProduction: boolean }
): IpResolution {
  const fromVercel = headers.get("x-vercel-forwarded-for");
  if (fromVercel) return { ok: true, ip: fromVercel };

  const fromReal = headers.get("x-real-ip");
  if (fromReal) return { ok: true, ip: fromReal };

  // Defense-in-depth: when falling back to x-forwarded-for, take the LAST
  // entry (the one closest to our edge). The first entry is client-set
  // and forgeable; well-behaved proxies append their own IP, so the last
  // entry is the most-trusted hop. On Vercel we never reach this fallback
  // (x-vercel-forwarded-for is preferred above), but staging / preview
  // deploys without proper edge config benefit from this guard.
  const xffRaw = headers.get("x-forwarded-for");
  const xffParts = xffRaw?.split(",").map((p) => p.trim()).filter(Boolean) ?? [];
  const fromXff = xffParts.length > 0 ? xffParts[xffParts.length - 1] : undefined;
  if (fromXff) return { ok: true, ip: fromXff };

  if (opts.isProduction) {
    return { ok: false, reason: "Could not identify request source. Please try again." };
  }
  return { ok: true, ip: "unknown" };
}
