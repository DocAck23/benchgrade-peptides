import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/client";

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
    // TODO: Sprint 1 Task 9 — call linkOrdersToUser(user.id, user.email)
    // to backfill any guest orders matching this email.
    return NextResponse.redirect(new URL(safeNextRedirect(next), url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid-link", url));
  }
}
