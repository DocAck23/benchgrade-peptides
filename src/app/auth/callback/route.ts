import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/client";
import { linkOrdersToUser } from "@/app/actions/account";

/**
 * Open-redirect guard for the `next` query param. Only same-origin
 * absolute paths are honored; anything else (null, empty, protocol-
 * relative `//evil.com`, absolute `https://evil.com`) falls back to
 * `/account`.
 */
export function safeNextRedirect(next: string | null | undefined): string {
  if (!next) return "/account";
  if (typeof next !== "string") return "/account";
  if (next.length === 0) return "/account";
  if (!next.startsWith("/")) return "/account";
  if (next.startsWith("//")) return "/account";
  return next;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing-code", url));
  }

  try {
    const supa = await createServerSupabase();
    const { data, error } = await supa.auth.exchangeCodeForSession(code);
    if (error || !data?.session) {
      return NextResponse.redirect(new URL("/login?error=invalid-link", url));
    }
    // Sprint 1 Task 9 — backfill guest orders that match this email.
    // First-claim-wins inside linkOrdersToUser: a second user signing
    // in with the same email gets `linked: 0` and the orders stay
    // with the first claimant. Failures are logged but do NOT block
    // the redirect — the user is already authenticated, and the
    // link-up will retry on next sign-in.
    try {
      if (data.session.user.email) {
        await linkOrdersToUser(
          data.session.user.id,
          data.session.user.email
        );
      }
    } catch (err) {
      console.error("[auth/callback] linkOrdersToUser failed:", err);
    }
    return NextResponse.redirect(new URL(safeNextRedirect(next), url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid-link", url));
  }
}
