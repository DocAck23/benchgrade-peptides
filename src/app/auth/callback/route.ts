import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}.`);
  return value;
}

/**
 * Magic-link callback. Exchanges the one-time code for a session and
 * persists the auth cookies on the redirect response itself.
 *
 * The shared `createServerSupabase()` factory writes cookies via
 * `next/headers` `cookies().set()`, which mutates the *request*
 * cookie store and is *not* attached to a `NextResponse.redirect`.
 * If we used that here, the session cookie would be created but never
 * delivered to the browser — the user would silently bounce back to
 * the login form with no error. So we build the response first and
 * thread it through a dedicated client whose `setAll` writes directly
 * to `response.cookies`. This matches the pattern in the official
 * Supabase Next.js SSR docs.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing-code", url));
  }

  const target = new URL(safeNextRedirect(next), url);
  const response = NextResponse.redirect(target);

  const supa = createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set({ name, value, ...options });
          }
        },
      },
    },
  );

  try {
    const { data, error } = await supa.auth.exchangeCodeForSession(code);
    if (error || !data?.session) {
      return NextResponse.redirect(new URL("/login?error=invalid-link", url));
    }
    // Best-effort: backfill any guest orders that match this email.
    // First-claim-wins inside linkOrdersToUser; failures don't block
    // the redirect — the user is already authenticated, the link-up
    // retries on next sign-in.
    try {
      if (data.session.user.email) {
        await linkOrdersToUser(data.session.user.id, data.session.user.email);
      }
    } catch (err) {
      console.error("[auth/callback] linkOrdersToUser failed:", err);
    }
    return response;
  } catch (err) {
    console.error("[auth/callback] exchangeCodeForSession threw:", err);
    return NextResponse.redirect(new URL("/login?error=invalid-link", url));
  }
}
