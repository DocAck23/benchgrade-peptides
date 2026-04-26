import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";
import { OrderStatusPill } from "@/components/account/OrderStatusPill";
import { isValidStatus, type OrderStatus } from "@/lib/orders/status";
import { formatPrice } from "@/lib/utils";

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
              No orders on the bench yet. The catalog runs deep — stack-and-save kicks in at three vials.
            </p>
            <Link
              href="/catalog"
              className="inline-flex items-center h-11 px-6 bg-wine text-paper font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep transition-colors duration-200 ease-out"
            >
              Browse the catalog
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <PlaceholderCard
          eyebrow="Subscription"
          headline="Auto-replenish on its way."
          body="Lock in your stack at a tier price and ship on cadence. Coming in v1.2."
        />
        <PlaceholderCard
          eyebrow="Messages"
          headline="Direct line to the bench."
          body="Order updates and lab notes will surface here. For now, contact us directly."
          ctaHref="/contact"
          ctaLabel="Contact us"
        />
        <PlaceholderCard
          eyebrow="Referrals"
          headline="Stack the bench."
          body="Refer another researcher — both labs get a free vial credit. Coming soon."
        />
      </div>
    </article>
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
