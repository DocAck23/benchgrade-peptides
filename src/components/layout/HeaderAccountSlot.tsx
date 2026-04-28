import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/client";
import { getMyAffiliateState } from "@/app/actions/affiliate";
import { getAccountAttention } from "@/lib/account/attention";
import { AccountMenuDropdown } from "./AccountMenuDropdown";

/**
 * Header right-side slot.
 *
 * Anonymous: a Sign-in link.
 * Signed-in: an avatar that opens a dropdown menu mirroring the
 * /account sidebar — same items, same attention badges. This lets
 * a customer browse the catalogue and still get one-click access
 * to orders/messages/etc. that need their action.
 *
 * Server component so the auth state is correct on the very first
 * paint (no client flash). Attention counts and affiliate flag are
 * also fetched here once and threaded down to the client dropdown.
 *
 * If Supabase env isn't configured (local dev without a project), we
 * fall back to a Sign-in link so the header still renders cleanly.
 */
export async function HeaderAccountSlot() {
  let user: { id: string; email?: string | null } | null = null;
  let supa: Awaited<ReturnType<typeof createServerSupabase>> | null = null;
  try {
    supa = await createServerSupabase();
    const { data } = await supa.auth.getUser();
    user = data.user ?? null;
  } catch {
    user = null;
  }

  const navLinkBase =
    "font-display uppercase text-[13px] tracking-[0.12em] text-ink-soft transition-colors duration-200 ease-out";
  const navLinkUnderline =
    "relative after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-px after:bg-gold-light after:scale-x-0 after:origin-left after:transition-transform after:duration-200 after:ease-out hover:text-ink hover:after:scale-x-100";

  if (!user || !supa) {
    return (
      <Link
        href="/login"
        className={`hidden md:inline-block ${navLinkBase} ${navLinkUnderline}`}
      >
        Sign in
      </Link>
    );
  }

  // Best-effort: any failure here defaults to "no badges" / "not an
  // affiliate" so the header renders even when the portal data layer
  // is in trouble.
  let isAffiliate = false;
  try {
    const state = await getMyAffiliateState();
    isAffiliate = state.ok && state.is_affiliate === true;
  } catch {
    isAffiliate = false;
  }
  const attention = await getAccountAttention(supa, user.id);

  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <AccountMenuDropdown
      email={user.email ?? ""}
      initial={initial}
      isAffiliate={isAffiliate}
      attention={attention}
    />
  );
}
