/**
 * Auth gate for `/account/*`. Next.js 16 renamed the `middleware.ts`
 * file convention to `proxy.ts` (the function is named `proxy`, the
 * old `middleware` symbol is deprecated — see
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
 *
 * This runs before the route renders, reads the Supabase session from
 * cookies via `@supabase/ssr`'s `createServerClient` (the only client
 * shape that works in this context — `next/headers`-based helpers are
 * not available here), and redirects unauthenticated users to /login
 * with the original path preserved as `?next=`.
 *
 * If env vars are missing we let the request through unchanged so dev
 * works without Supabase. The /account pages must still server-render
 * a session check (belt + suspenders).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return res;

  const supa = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options as CookieOptions)
        );
      },
    },
  });

  const { data } = await supa.auth.getUser();
  if (!data.user) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }
  return res;
}

export const config = {
  matcher: ["/account/:path*"],
};
