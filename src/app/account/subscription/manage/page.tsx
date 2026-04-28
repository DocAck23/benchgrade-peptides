import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { createServerSupabase } from "@/lib/supabase/client";
import { SubscriptionStatusPill } from "@/components/account/SubscriptionStatusPill";
import type { SubscriptionRow } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Manage subscription",
  description: "Request changes to your subscription stack.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/subscription/manage" },
};

/**
 * /account/subscription/manage — admin-approval gate (spec §C2).
 *
 * v1 keeps stack changes off the self-service path: customer reviews the
 * locked-in items, then emails admin with a pre-filled subject. We don't
 * accept self-service swaps yet because inventory + cycle timing need a
 * human in the loop.
 */

const ADMIN_EMAIL = "admin@benchgradepeptides.com";

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

export default async function ManageSubscriptionPage() {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect("/login?next=/account/subscription/manage");

  const { data } = await supa
    .from("subscriptions")
    .select("*")
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false })
    .limit(1);

  const sub = Array.isArray(data) && data.length > 0 && isSubscriptionRow(data[0]) ? data[0] : null;
  if (!sub) redirect("/account/subscription");

  const subjectShort = `Swap subscription BGP-SUB-${sub.id.slice(0, 8)}`;
  const mailto = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subjectShort)}`;

  return (
    <article className="space-y-10">
      <header>
        <div className="label-eyebrow text-ink-muted mb-3">Bench Journal · Manage stack</div>
        <h1 className="font-display text-4xl lg:text-5xl leading-tight text-ink">
          Want to change what&apos;s in your stack?
        </h1>
      </header>

      <section className="border rule bg-paper p-6 lg:p-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="font-mono-data text-xs text-ink-muted uppercase tracking-wider">
              BGP-SUB-{sub.id.slice(0, 8)}
            </div>
            <h2 className="mt-2 font-display uppercase text-[15px] tracking-[0.14em] text-ink">
              Current stack
            </h2>
          </div>
          <SubscriptionStatusPill status={sub.status} />
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </section>

      <section className="border rule bg-paper-soft p-6 lg:p-8 space-y-5">
        <div>
          <h2 className="font-display uppercase text-[13px] tracking-[0.18em] text-ink mb-2">
            Swap a vial in the stack
          </h2>
          <p
            className="font-editorial text-base text-ink-soft max-w-prose"
            style={{ fontFamily: "var(--font-editorial)" }}
          >
            Item swaps go through our team to ensure inventory and timing.
            Email{" "}
            <a href={`mailto:${ADMIN_EMAIL}`} className="text-gold-dark underline">
              {ADMIN_EMAIL}
            </a>{" "}
            with subject{" "}
            <code className="font-mono-data text-sm text-ink bg-paper px-1.5 py-0.5 border rule">
              {subjectShort}
            </code>{" "}
            and we&apos;ll confirm within 1 business day.
          </p>
        </div>
        <a
          href={mailto}
          className="inline-flex items-center h-11 px-6 bg-wine text-paper font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep transition-colors duration-200 ease-out"
        >
          Email the team
        </a>
        <hr className="border-rule" />
        <div>
          <h2 className="font-display uppercase text-[13px] tracking-[0.18em] text-ink mb-2">
            Pause, skip, resume, or cancel
          </h2>
          <p
            className="font-editorial text-base text-ink-soft max-w-prose mb-4"
            style={{ fontFamily: "var(--font-editorial)" }}
          >
            These are all self-service. Head back to your subscription
            overview to pause shipments, skip the next cycle, resume after
            a pause, or cancel entirely.
          </p>
          <Link
            href="/account/subscription"
            className="inline-flex items-center h-11 px-6 border-2 border-ink text-ink font-display uppercase text-[12px] tracking-[0.14em] hover:bg-ink hover:text-paper transition-colors duration-200 ease-out"
          >
            ← Back to subscription
          </Link>
        </div>
      </section>
    </article>
  );
}
