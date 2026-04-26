import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/client";

/**
 * Header right-side slot — Sign-in link when anon, account badge when
 * signed-in. Server component so the auth state is correct on the very
 * first paint with no client flash.
 *
 * If Supabase env isn't configured (local dev without a project), we
 * fall back to a Sign-in link so the header still renders cleanly.
 */
export async function HeaderAccountSlot() {
  let user: { email?: string | null } | null = null;
  try {
    const supa = await createServerSupabase();
    const { data } = await supa.auth.getUser();
    user = data.user ?? null;
  } catch {
    user = null;
  }

  const navLinkBase =
    "font-display uppercase text-[13px] tracking-[0.12em] text-ink-soft transition-colors duration-200 ease-out";
  const navLinkUnderline =
    "relative after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-px after:bg-gold-light after:scale-x-0 after:origin-left after:transition-transform after:duration-200 after:ease-out hover:text-ink hover:after:scale-x-100";

  if (!user) {
    return (
      <Link
        href="/login"
        className={`hidden md:inline-block ${navLinkBase} ${navLinkUnderline}`}
      >
        Sign in
      </Link>
    );
  }

  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <Link
      href="/account"
      aria-label="Account"
      className="hidden md:inline-flex items-center justify-center w-8 h-8 rounded-full bg-paper-soft border rule text-gold-dark font-display text-sm hover:bg-paper hover:text-ink transition-colors duration-200 ease-out"
    >
      <span aria-hidden="true">{initial}</span>
    </Link>
  );
}
