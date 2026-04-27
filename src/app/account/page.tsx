import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";
import { OrderStatusPill } from "@/components/account/OrderStatusPill";
import { SubscriptionCard } from "@/components/account/SubscriptionCard";
import { isValidStatus, type OrderStatus } from "@/lib/orders/status";
import type { SubscriptionRow } from "@/lib/supabase/types";
import { formatPrice } from "@/lib/utils";
import { getMyAffiliateState } from "@/app/actions/affiliate";
import { TierBadge } from "@/components/affiliate/TierBadge";
import type { AffiliateTier } from "@/lib/affiliate/tiers";

export const metadata: Metadata = {
  title: "Account",
  description: "Your Bench Grade Peptides account.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};

/**
 * Dashboard — entry surface after sign-in.
 *
 * Cards:
 *   • Recent orders (top 3 by created_at desc, scoped via cookie-RLS)
 *   • Active subscription placeholder (v1.2)
 *   • Messages placeholder
 *   • Referral link placeholder
 *
 * Empty state for orders is itself a sales surface (spec §16.4 UX-to-close)
 * — we never render a dead-end "nothing here yet."
 */

interface RecentOrderRow {
  order_id: string;
  created_at: string;
  status: OrderStatus;
  total_cents: number | null;
  subtotal_cents: number;
  items: Array<{ quantity: number }> | null;
}

function firstNameFor(user: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null) {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fn = typeof meta.first_name === "string" ? meta.first_name.trim() : "";
  if (fn) return fn;
  const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (fullName) return fullName.split(/\s+/)[0];
  const email = user?.email ?? "";
  if (email) {
    const prefix = email.split("@")[0] ?? "";
    if (prefix) return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return "researcher";
}

function itemCount(items: Array<{ quantity: number }> | null): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, it) => sum + (typeof it.quantity === "number" ? it.quantity : 0), 0);
}

export default async function AccountDashboardPage() {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: rows } = await supa
    .from("orders")
    .select("order_id, created_at, status, total_cents, subtotal_cents, items")
    .order("created_at", { ascending: false })
    .limit(3);

  const { data: subRows } = await supa
    .from("subscriptions")
    .select("*")
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false })
    .limit(1);

  // Sprint 3 Wave C — unread admin messages count for badge.
  const { data: unreadMsgRows } = await supa
    .from("messages")
    .select("id")
    .eq("customer_user_id", user.id)
    .eq("sender", "admin")
    .is("read_at", null);
  const unreadCount = Array.isArray(unreadMsgRows) ? unreadMsgRows.length : 0;

  // Sprint 3 Wave C — referral stats for dashboard card.
  const [availableEntRes, successfulRefRes] = await Promise.all([
    supa
      .from("free_vial_entitlements")
      .select("id")
      .eq("customer_user_id", user.id)
      .eq("status", "available"),
    supa
      .from("referrals")
      .select("id")
      .eq("referrer_user_id", user.id)
      .in("status", ["shipped", "redeemed"]),
  ]);
  const availableEntitlements = Array.isArray(availableEntRes.data)
    ? availableEntRes.data.length
    : 0;
  const successfulReferrals = Array.isArray(successfulRefRes.data)
    ? successfulRefRes.data.length
    : 0;

  // Sprint 4 Wave C — affiliate snapshot for the dashboard card. Best-effort:
  // any failure → no card (affiliate is opt-in; we never up-sell apply here).
  let affiliateSnapshot: {
    tier: AffiliateTier;
    available_balance_cents: number;
  } | null = null;
  try {
    const affState = await getMyAffiliateState();
    if (affState.ok && affState.is_affiliate && affState.affiliate) {
      affiliateSnapshot = {
        tier: affState.affiliate.tier,
        available_balance_cents: affState.affiliate.available_balance_cents,
      };
    }
  } catch {
    affiliateSnapshot = null;
  }

  const activeSub: SubscriptionRow | null =
    Array.isArray(subRows) &&
    subRows.length > 0 &&
    subRows[0] &&
    typeof (subRows[0] as { id?: unknown }).id === "string"
      ? (subRows[0] as SubscriptionRow)
      : null;

  const recent: RecentOrderRow[] = Array.isArray(rows)
    ? rows
        .filter((r): r is RecentOrderRow => {
          if (!r || typeof r !== "object") return false;
          const o = r as Record<string, unknown>;
          return (
            typeof o.order_id === "string" &&
            typeof o.created_at === "string" &&
            isValidStatus(o.status) &&
            typeof o.subtotal_cents === "number"
          );
        })
        .map((r) => r)
    : [];

  const firstName = firstNameFor(user);

  return (
    <article className="space-y-12">
      <header>
        <div className="label-eyebrow text-ink-muted mb-3">Bench Journal · Account</div>
        <h1 className="font-display text-4xl lg:text-5xl leading-tight text-ink">
          Welcome back, {firstName}.
        </h1>
        <p className="mt-3 font-editorial text-lg text-ink-soft" style={{ fontFamily: "var(--font-editorial)" }}>
          Track your bench supply, review past lots, and prep your next run.
        </p>
      </header>

      <section
        aria-labelledby="recent-orders-heading"
        className="border rule bg-paper p-6 lg:p-8"
      >
        <div className="flex items-baseline justify-between mb-5">
          <h2
            id="recent-orders-heading"
            className="font-display uppercase text-[13px] tracking-[0.18em] text-ink"
          >
            Recent orders
          </h2>
          {recent.length > 0 && (
            <Link
              href="/account/orders"
              className="font-display uppercase text-[11px] tracking-[0.12em] text-gold-dark hover:text-ink transition-colors duration-200 ease-out"
            >
              View all →
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="border rule bg-paper-soft p-8 text-center">
            <p className="font-editorial text-lg text-ink-soft mb-5" style={{ fontFamily: "var(--font-editorial)" }}>
              No orders on the bench yet. The catalogue runs deep — stack-and-save kicks in at three vials.
            </p>
            <Link
              href="/catalogue"
              className="inline-flex items-center h-11 px-6 bg-wine text-paper font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep transition-colors duration-200 ease-out"
            >
              Browse the catalogue
            </Link>
          </div>
        ) : (
          <ul className="divide-y rule">
            {recent.map((order) => {
              const total = order.total_cents ?? order.subtotal_cents;
              const qty = itemCount(order.items);
              return (
                <li key={order.order_id}>
                  <Link
                    href={`/account/orders/${order.order_id}`}
                    className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] items-center gap-3 md:gap-6 py-4 hover:bg-paper-soft transition-colors duration-200 ease-out -mx-2 px-2"
                  >
                    <div>
                      <div className="font-mono-data text-xs text-ink-muted uppercase tracking-wider">
                        BGP-{order.order_id.slice(0, 8)}
                      </div>
                      <div className="text-sm text-ink mt-0.5">
                        {qty} {qty === 1 ? "vial" : "vials"} · placed{" "}
                        {new Date(order.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                    <OrderStatusPill status={order.status} />
                    <span className="font-mono-data text-sm text-ink">{formatPrice(total)}</span>
                    <span className="font-display uppercase text-[11px] tracking-[0.12em] text-gold-dark">
                      Detail →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {activeSub ? (
        <section aria-labelledby="subscription-heading" className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2
              id="subscription-heading"
              className="font-display uppercase text-[13px] tracking-[0.18em] text-ink"
            >
              Active subscription
            </h2>
            <Link
              href="/account/subscription"
              className="font-display uppercase text-[11px] tracking-[0.12em] text-gold-dark hover:text-ink transition-colors duration-200 ease-out"
            >
              Manage →
            </Link>
          </div>
          <SubscriptionCard sub={activeSub} />
        </section>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {!activeSub && (
          <PlaceholderCard
            eyebrow="Subscription"
            headline="Subscribe & save 18–35%."
            body="Lock in your stack at a tier price. Pause or cancel any time."
            ctaHref="/account/subscription"
            ctaLabel="Start a subscription"
          />
        )}
        <MessagesCard unreadCount={unreadCount} />
        <ReferralsDashboardCard
          availableEntitlements={availableEntitlements}
          successfulReferrals={successfulReferrals}
        />
        {affiliateSnapshot && <AffiliateDashboardCard snapshot={affiliateSnapshot} />}
      </div>
    </article>
  );
}

function MessagesCard({ unreadCount }: { unreadCount: number }) {
  const hasUnread = unreadCount > 0;
  return (
    <section className="border rule bg-paper-soft p-6 flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="label-eyebrow text-ink-muted">Messages</div>
        {hasUnread && (
          <span
            className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 bg-wine text-paper border border-gold font-display uppercase text-[10px] tracking-[0.12em]"
            aria-label={`${unreadCount} unread`}
            data-testid="messages-unread-badge"
          >
            {unreadCount}
          </span>
        )}
      </div>
      <h3
        className="mt-2 font-editorial text-2xl text-ink leading-snug"
        style={{ fontFamily: "var(--font-editorial)" }}
      >
        {hasUnread ? "You have a new reply." : "Direct line to the bench."}
      </h3>
      <p className="mt-3 text-sm text-ink-soft flex-1">
        {hasUnread
          ? "Read what the lab sent over and keep the thread moving."
          : "Order questions or lab notes — we typically reply within one business day."}
      </p>
      <Link
        href="/account/messages"
        className="mt-4 inline-flex items-center font-display uppercase text-[11px] tracking-[0.14em] text-gold-dark hover:text-ink transition-colors duration-200 ease-out"
      >
        Open conversation →
      </Link>
    </section>
  );
}

function ReferralsDashboardCard({
  availableEntitlements,
  successfulReferrals,
}: {
  availableEntitlements: number;
  successfulReferrals: number;
}) {
  const hasActivity = availableEntitlements > 0 || successfulReferrals > 0;
  return (
    <section className="border rule bg-paper-soft p-6 flex flex-col">
      <div className="label-eyebrow text-ink-muted">Referrals</div>
      <h3
        className="mt-2 font-editorial text-2xl text-ink leading-snug"
        style={{ fontFamily: "var(--font-editorial)" }}
      >
        {availableEntitlements > 0
          ? `${availableEntitlements} free vial${availableEntitlements === 1 ? "" : "s"} ready.`
          : "Stack the bench."}
      </h3>
      <p className="mt-3 text-sm text-ink-soft flex-1">
        {hasActivity
          ? `${successfulReferrals} successful referral${successfulReferrals === 1 ? "" : "s"}. Redeem your free vials on your next order.`
          : "Refer another researcher — they get 10% off, you earn a free vial when their order ships."}
      </p>
      <Link
        href="/account/referrals"
        className="mt-4 inline-flex items-center font-display uppercase text-[11px] tracking-[0.14em] text-gold-dark hover:text-ink transition-colors duration-200 ease-out"
      >
        View your referral link →
      </Link>
    </section>
  );
}

function AffiliateDashboardCard({
  snapshot,
}: {
  snapshot: { tier: AffiliateTier; available_balance_cents: number };
}) {
  return (
    <section className="border rule bg-paper-soft p-6 flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="label-eyebrow text-ink-muted">Affiliate</div>
        <TierBadge tier={snapshot.tier} />
      </div>
      <h3
        className="mt-2 font-editorial text-2xl text-ink leading-snug"
        style={{ fontFamily: "var(--font-editorial)" }}
      >
        {formatPrice(snapshot.available_balance_cents)} available.
      </h3>
      <p className="mt-3 text-sm text-ink-soft flex-1">
        Track referrals, redeem commission for vial credit, and watch your tier
        climb.
      </p>
      <Link
        href="/account/affiliate"
        className="mt-4 inline-flex items-center font-display uppercase text-[11px] tracking-[0.14em] text-gold-dark hover:text-ink transition-colors duration-200 ease-out"
      >
        View dashboard →
      </Link>
    </section>
  );
}

function PlaceholderCard({
  eyebrow,
  headline,
  body,
  ctaHref,
  ctaLabel,
}: {
  eyebrow: string;
  headline: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <section className="border rule bg-paper-soft p-6 flex flex-col">
      <div className="label-eyebrow text-ink-muted">{eyebrow}</div>
      <h3
        className="mt-2 font-editorial text-2xl text-ink leading-snug"
        style={{ fontFamily: "var(--font-editorial)" }}
      >
        {headline}
      </h3>
      <p className="mt-3 text-sm text-ink-soft flex-1">{body}</p>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="mt-4 inline-flex items-center font-display uppercase text-[11px] tracking-[0.14em] text-gold-dark hover:text-ink transition-colors duration-200 ease-out"
        >
          {ctaLabel} →
        </Link>
      )}
    </section>
  );
}
