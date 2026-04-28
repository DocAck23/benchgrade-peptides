import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";
import { AccountNav } from "@/components/account/AccountNav";
import { getMyAffiliateState } from "@/app/actions/affiliate";
import { getAccountAttention } from "@/lib/account/attention";

/**
 * Customer portal layout (spec §5).
 *
 * Auth gate is belt + suspenders with proxy.ts — proxy redirects
 * unauthenticated requests at the edge, but a missed-cookie or
 * tokens-just-expired race still has to be caught here. RLS on the
 * `orders` table is the actual security boundary; this gate just
 * guarantees the page never renders for an anonymous viewer.
 *
 * Attention counts feed the sidebar badges so a customer can browse
 * the catalogue (header link out of /account) and come back to handle
 * payment-pending orders or unread admin replies without losing
 * context. Counts are fetched here once per render (RSC) so every
 * portal page sees fresh numbers without each page re-querying.
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

  // Attention counts — graceful degradation: any failure resolves to 0
  // so the nav never breaks for a count error. Same helper feeds the
  // global header dropdown so badges stay consistent across surfaces.
  const attention = await getAccountAttention(supa, user.id);

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
      <div className="lg:grid lg:grid-cols-[14rem_1fr] lg:gap-12">
        <AccountNav isAffiliate={isAffiliate} attention={attention} />
        <div className="mt-10 lg:mt-0 min-w-0">{children}</div>
      </div>
    </div>
  );
}
