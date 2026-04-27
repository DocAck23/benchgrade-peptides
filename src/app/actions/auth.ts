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

const PasswordSchema = z.string().min(10).max(128);

/**
 * Set or update the password on the currently-signed-in user. Requires
 * an active Supabase session — the cookie-scoped client looks up the
 * user from the request, so an unauthenticated caller is rejected.
 *
 * Password rule: minimum 10 chars, maximum 128. We avoid prescribing
 * complexity classes (NIST 800-63B guidance) — length is the dominant
 * factor and arbitrary character requirements push users toward
 * predictable patterns.
 */
export async function setAccountPassword(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const parsed = PasswordSchema.safeParse(password);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Password must be at least 10 characters and at most 128.",
    };
  }
  if (password !== confirm) {
    return { ok: false, error: "Passwords do not match." };
  }

  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in to set a password." };
  }

  const { error } = await supa.auth.updateUser({ password });
  if (error) {
    // Generic copy — Supabase's internal error strings may leak whether
    // a password policy is in place (they aren't, but defense-in-depth).
    return { ok: false, error: "Could not save password. Please try again." };
  }
  return { ok: true };
}

/**
 * Sign in with an email + password. Used as the password-toggle path
 * on /login alongside the magic-link primary flow. Returns generic
 * copy on every failure (rate-limit, wrong password, no account) so
 * the action can't be used for user enumeration.
 */
export async function signInWithPasswordAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const rawEmail = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const parsedEmail = EmailSchema.safeParse(rawEmail);
  if (!parsedEmail.success) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (!password || password.length < 1 || password.length > 128) {
    return { ok: false, error: "Please enter your password." };
  }

  const h = await headers();
  const ip = resolveClientIp(h, { isProduction: process.env.NODE_ENV === "production" });
  if (!ip.ok) {
    return { ok: false, error: ip.reason };
  }
  // Reuse the magic-link rate limiter — same threat model (credential
  // stuffing / enumeration) and same per-IP quota is appropriate.
  const limited = await enforceMagicLinkRateLimit(ip.ip);
  if (!limited.allowed) {
    return { ok: false, error: limited.error };
  }

  const supa = await createServerSupabase();
  const { error } = await supa.auth.signInWithPassword({
    email: parsedEmail.data,
    password,
  });
  if (error) {
    return { ok: false, error: "Email or password is incorrect." };
  }
  return { ok: true };
}
