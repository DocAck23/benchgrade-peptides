"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/client";
import { resolveClientIp } from "@/lib/ratelimit/ip";
import { enforceMagicLinkRateLimit } from "@/lib/auth/rate-limit";
import { SITE_URL } from "@/lib/site";

const EmailSchema = z.string().trim().toLowerCase().email().max(200);

export type RequestMagicLinkResult = { ok: boolean; error?: string };

/**
 * Request a magic-link email for `email`. Returns the same generic shape
 * regardless of whether the email maps to an existing account, so the
 * action can never be used for user enumeration. Failures (validation,
 * rate-limit, supabase) all collapse to `{ ok: false, error }` with a
 * stable error string.
 */
export async function requestMagicLink(formData: FormData): Promise<RequestMagicLinkResult> {
  const raw = String(formData.get("email") ?? "");
  if (!raw.trim()) {
    return { ok: false, error: "Email required." };
  }
  const parsed = EmailSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  const email = parsed.data;

  const h = await headers();
  const ip = resolveClientIp(h, { isProduction: process.env.NODE_ENV === "production" });
  if (!ip.ok) {
    return { ok: false, error: ip.reason };
  }

  const limited = await enforceMagicLinkRateLimit(ip.ip);
  if (!limited.allowed) {
    return { ok: false, error: limited.error };
  }

  // Preserve a same-origin redirect target through the magic-link
  // round-trip. Open-redirect guard: only paths starting with `/` and
  // not `//` are accepted; anything else is dropped silently.
  const rawNext = String(formData.get("next") ?? "");
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const callbackUrl = next
    ? `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`
    : `${SITE_URL}/auth/callback`;

  try {
    const supa = await createServerSupabase();
    const { error } = await supa.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    });
    if (error) {
      // Generic copy on every Supabase failure path. Do NOT echo the
      // upstream message — it can leak whether an account exists.
      return { ok: false, error: "Could not send sign-in link. Please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not send sign-in link. Please try again." };
  }
}
