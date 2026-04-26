import Link from "next/link";
import Image from "next/image";
import type { SubscriptionRow } from "@/lib/supabase/types";
import { SubscriptionStatusPill } from "@/components/account/SubscriptionStatusPill";
import { formatPrice } from "@/lib/utils";

/**
 * Read-only summary card for an active/paused subscription. Used on the
 * dashboard and on /account/subscription as the top-of-page summary.
 *
 * Visual language matches the editorial chrome — Cinzel display headings,
 * Cormorant editorial italic for ship/total, Inter mono for cycle counts,
 * JetBrains Mono for the BGP-SUB eyebrow. No box-shadows; hairline rule.
 */

interface SubscriptionCardProps {
  sub: SubscriptionRow;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function planLine(sub: SubscriptionRow): string {
  const pay =
    sub.payment_cadence === "prepay" ? "prepay" : "monthly bill-pay";
  return `${sub.plan_duration_months}-month plan · ${pay}`;
}

export function SubscriptionCard({ sub }: SubscriptionCardProps) {
  const cycleTotal = sub.cycle_total_cents;
  const planTotal =
    sub.payment_cadence === "prepay"
      ? cycleTotal * sub.cycles_total
      : cycleTotal * sub.cycles_total;

  const showNextShip =
    sub.status === "active" && typeof sub.next_ship_date === "string" && sub.next_ship_date;

  return (
    <section
      className="border rule bg-paper p-6 lg:p-8"
      aria-labelledby={`sub-${sub.id}-heading`}
      data-subscription-id={sub.id}
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="font-mono-data text-xs text-ink-muted uppercase tracking-wider">
            BGP-SUB-{sub.id.slice(0, 8)}
          </div>
          <h3
            id={`sub-${sub.id}-heading`}
            className="mt-2 font-display uppercase text-[15px] tracking-[0.14em] text-ink"
          >
            {planLine(sub)}
          </h3>
          {showNextShip && (
            <p
              className="mt-2 font-editorial italic text-lg text-ink-soft"
              style={{ fontFamily: "var(--font-editorial)" }}
            >
              Next ship: {formatDate(sub.next_ship_date as string)}
            </p>
          )}
        </div>
        <SubscriptionStatusPill status={sub.status} />
      </div>

      <div className="font-mono-data text-xs uppercase tracking-wider text-ink-muted mb-4">
        Cycle {Math.min(sub.cycles_completed + 1, sub.cycles_total)} of{" "}
        {sub.cycles_total}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {sub.items.map((it, idx) => (
          <li
            key={`${it.sku}-${idx}`}
            className="flex items-center gap-3 border rule bg-paper-soft p-3"
          >
            {it.vial_image ? (
              <Image
                src={it.vial_image}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
              />
            ) : (
              <span aria-hidden className="h-10 w-10 bg-paper border rule" />
            )}
            <div className="min-w-0">
              <div className="text-sm text-ink truncate">{it.name}</div>
              <div className="font-mono-data text-[11px] text-ink-muted">
                {it.size_mg} mg · qty {it.quantity}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-baseline justify-between gap-3 border-t rule pt-4">
        <div>
          <div
            className="font-editorial text-2xl text-ink"
            style={{ fontFamily: "var(--font-editorial)" }}
          >
            {formatPrice(cycleTotal)}/cycle
          </div>
          <div className="text-xs text-ink-muted mt-1">
            {sub.payment_cadence === "prepay"
              ? `${formatPrice(planTotal)} prepaid`
              : `${formatPrice(planTotal)} plan total`}
          </div>
        </div>
        <Link
          href="/account/subscription/manage"
          className="font-display uppercase text-[11px] tracking-[0.14em] text-gold-dark hover:text-ink transition-colors duration-200 ease-out"
        >
          Manage →
        </Link>
      </div>
    </section>
  );
}
