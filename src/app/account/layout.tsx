import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";
import { AccountNav } from "@/components/account/AccountNav";
import { getMyAffiliateState } from "@/app/actions/affiliate";

/**
 * Customer portal layout (spec §5).
 *
 * Auth gate is belt + suspenders with proxy.ts — proxy redirects
 * unauthenticated requests at the edge, but a missed-cookie or
 * tokens-just-expired race still has to be caught here. RLS on the
 * `orders` table is the actual security boundary; this gate just
 * guarantees the page never renders for an anonymous viewer.
 */

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  // Sprint 4 Wave C — conditionally surface the Affiliate tab. Best-effort:
  // if the affiliate read fails for any reason, default to hidden.
  let isAffiliate = false;
  try {
    const state = await getMyAffiliateState();
    isAffiliate = state.ok && state.is_affiliate === true;
  } catch {
    isAffiliate = false;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
      <AccountNav isAffiliate={isAffiliate} />
      <div className="mt-10 lg:mt-12">{children}</div>
    </div>
  );
}
