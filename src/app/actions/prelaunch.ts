"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getResend, EMAIL_FROM } from "@/lib/email/client";
import { prelaunchWelcomeEmail } from "@/lib/email/templates/prelaunch";
import { resolveClientIp } from "@/lib/ratelimit/ip";
import { checkAndIncrement } from "@/lib/ratelimit/window";
import { SupabaseRateLimitStore } from "@/lib/ratelimit/supabase-store";
import { MemoryRateLimitStore } from "@/lib/ratelimit/memory-store";

/**
 * Pre-launch waitlist signup. Called from the homepage popup. The
 * action is idempotent — submitting the same email twice does NOT
 * resend the welcome email — and rate-limited per-IP so a bot
 * pounding the endpoint can't blow through the 100-coupon cap by
 * pre-claiming with junk addresses.
 */

const SignupSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(200),
});

const PRELAUNCH_RATE_LIMIT = { limit: 5, windowSeconds: 600 } as const;
const memoryStore = new MemoryRateLimitStore();

export async function submitPrelaunchSignup(
  raw: unknown,
): Promise<{ ok: boolean; error?: string; alreadySignedUp?: boolean }> {
  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }
  const emailLower = parsed.data.email;

  const headerBag = await headers();
  const ipResult = resolveClientIp(headerBag, {
    isProduction: process.env.NODE_ENV === "production",
  });
  const ip = ipResult.ok ? ipResult.ip : "unknown";
  const userAgent = headerBag.get("user-agent")?.slice(0, 500) ?? null;

  // Rate-limit before DB writes — 5 signups per IP per 10 min.
  // Stops a bot from precomputing the FIRST100 redemption pool.
  try {
    const supaForLimit = getSupabaseServer();
    const store = supaForLimit
      ? new SupabaseRateLimitStore(supaForLimit)
      : memoryStore;
    const rl = await checkAndIncrement({
      bucket: `prelaunch:${ip}`,
      limit: PRELAUNCH_RATE_LIMIT.limit,
      windowSeconds: PRELAUNCH_RATE_LIMIT.windowSeconds,
      store,
    });
    if (!rl.allowed) {
      return {
        ok: false,
        error: "Too many signups from this network. Please try again in a few minutes.",
      };
    }
  } catch {
    // Rate-limit infra error → continue. Better to over-accept than
    // to lock people out of the waitlist.
  }

  const supa = getSupabaseServer();
  if (!supa) {
    return { ok: false, error: "Signup is temporarily unavailable. Try again shortly." };
  }

  // Idempotent insert. If the row already exists we don't resend the
  // welcome email but we still surface a friendly UI state.
  const { data: existing } = await supa
    .from("prelaunch_signups")
    .select("email_lower, welcome_sent_at")
    .eq("email_lower", emailLower)
    .maybeSingle();

  if (existing) {
    return { ok: true, alreadySignedUp: true };
  }

  const { error: insertError } = await supa.from("prelaunch_signups").insert({
    email_lower: emailLower,
    ip: ip === "unknown" ? null : ip,
    user_agent: userAgent,
  });
  if (insertError) {
    console.error("[prelaunch] insert failed:", insertError);
    return { ok: false, error: "Could not save your signup. Please try again." };
  }

  // Send the welcome email. Best-effort: if Resend fails we still
  // return ok=true — the row is in place and we can resend manually.
  try {
    const resend = getResend();
    if (resend) {
      const { subject, html, text } = prelaunchWelcomeEmail();
      const { error: sendErr } = await resend.emails.send({
        from: EMAIL_FROM,
        to: emailLower,
        subject,
        html,
        text,
      });
      if (sendErr) {
        console.error("[prelaunch] resend send error:", sendErr);
      } else {
        await supa
          .from("prelaunch_signups")
          .update({ welcome_sent_at: new Date().toISOString() })
          .eq("email_lower", emailLower);
      }
    } else {
      console.warn(
        "[prelaunch] Resend not configured; signup recorded but no email sent:",
        emailLower,
      );
    }
  } catch (err) {
    console.error("[prelaunch] welcome email threw:", err);
  }

  return { ok: true, alreadySignedUp: false };
}
