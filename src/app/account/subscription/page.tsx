import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";
import { SubscriptionCard } from "@/components/account/SubscriptionCard";
import { SubscriptionActions } from "@/components/account/SubscriptionActions";
import type { SubscriptionRow } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Subscription",
  description: "Manage your active stack subscription.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/subscription" },
};

/**
 * /account/subscription — Wave C2 portal page.
 *
 * RLS-scoped read of the customer's most-recent subscription. If none
 * exists the page is a sales surface (spec §16.4 UX-to-close): we never
 * render a dead-end empty state.
 */

function isSubscriptionRow(r: unknown): r is SubscriptionRow {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.status === "string" &&
    Array.isArray(o.items) &&
    typeof o.cycle_total_cents === "number"
  );
}

export default async function SubscriptionPage() {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect("/login?next=/account/subscription");

  const { data } = await supa
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  const sub = Array.isArray(data) && data.length > 0 && isSubscriptionRow(data[0]) ? data[0] : null;

  return (
    <article className="space-y-10">
      <header>
        <div className="label-eyebrow text-ink-muted mb-3">Bench Journal · Subscription</div>
        <h1 className="font-display text-4xl lg:text-5xl leading-tight text-ink">
          Your subscription.
        </h1>
      </header>

      {!sub ? (
        <section className="border rule bg-paper-soft p-10 text-center">
          <div className="label-eyebrow text-gold-dark mb-3">Subscribe & save 18–35%</div>
          <h2
            className="font-editorial text-3xl text-ink mb-3"
            style={{ fontFamily: "var(--font-editorial)" }}
          >
            Lock in your stack at a tier price.
          </h2>
          <p className="text-ink-soft mb-6 max-w-prose mx-auto">
            Choose a 3-, 6-, 9-, or 12-month plan. Prepay for the deepest discount, or
            bill-pay each cycle. Pause or cancel any time.
          </p>
          <Link
            href="/catalog"
            className="inline-flex items-center h-11 px-6 bg-wine text-paper font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep transition-colors duration-200 ease-out"
          >
            Browse the catalog
          </Link>
        </section>
      ) : (
        <>
          <SubscriptionCard sub={sub} />
          <SubscriptionActions sub={sub} />
        </>
      )}
    </article>
  );
}
