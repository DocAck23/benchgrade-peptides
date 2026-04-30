import type { Metadata } from "next";
import Link from "next/link";
import { getMyAffiliateState } from "@/app/actions/affiliate";
import {
  getMyAffiliateOnboarding,
  getAffiliateW9SignedUrlForMe,
} from "@/app/actions/affiliate-portal";
import { TierBadge } from "@/components/affiliate/TierBadge";
import { TierProgressBar } from "@/components/affiliate/TierProgressBar";
import { CommissionLedgerTable } from "@/components/affiliate/CommissionLedgerTable";
import { RedeemCommissionForm } from "@/components/affiliate/RedeemCommissionForm";
import { ReferralCard } from "@/components/account/ReferralCard";
import { formatPrice } from "@/lib/utils";

/**
 * /account/affiliate — affiliate dashboard (Sprint 4 Wave C).
 *
 * Auth-gated by parent layout. RLS-scoped via getMyAffiliateState (cookie
 * client). Empty state for non-affiliates is itself a sales surface — we
 * route them to /affiliate/apply rather than dead-end them.
 */

export const metadata: Metadata = {
  title: "Affiliate Dashboard · Bench Grade Peptides",
  description: "Track your affiliate commission, tier, and payouts.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/affiliate" },
};

const eyebrow =
  "font-display uppercase text-[12px] tracking-[0.18em] text-gold-dark";
const display =
  "font-editorial italic text-3xl lg:text-4xl text-ink leading-[1.1]";
const sectionHead =
  "font-display uppercase text-[12px] tracking-[0.16em] text-ink";

export default async function AffiliateDashboardPage() {
  const state = await getMyAffiliateState();

  if (!state.ok || !state.is_affiliate || !state.affiliate) {
    return (
      <article className="space-y-10">
        <header className="space-y-3">
          <p className={eyebrow}>AFFILIATE</p>
          <h1 className={display}>You&apos;re not an affiliate yet.</h1>
        </header>
        <section className="border rule bg-paper-soft p-8 space-y-4 max-w-xl">
          <p className="font-editorial text-base text-ink-soft leading-relaxed">
            The affiliate program pays 10–18% lifetime commission and a 10–25%
            personal discount on your own bench supply. Apply in two minutes.
          </p>
          <Link
            href="/affiliate/apply"
            className="inline-flex items-center justify-center h-11 px-6 bg-wine text-paper font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep transition-colors duration-200 ease-out"
          >
            Apply now →
          </Link>
        </section>
      </article>
    );
  }

  const aff = state.affiliate;
  const successfulRefs = state.successful_referrals_count ?? 0;
  const ledger = state.recent_ledger ?? [];
  const payouts = state.recent_payouts ?? [];

  // W6 — read-only Documents section. Best-effort: any failure here just
  // hides the section rather than breaking the whole dashboard.
  const onboarding = await getMyAffiliateOnboarding().catch(() => null);
  let w9Url: string | null = null;
  if (onboarding?.w9_uploaded) {
    const u = await getAffiliateW9SignedUrlForMe().catch(() => null);
    w9Url = u?.ok ? u.url ?? null : null;
  }

  return (
    <article className="space-y-12">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <p className={eyebrow}>AFFILIATE</p>
          <TierBadge tier={aff.tier} />
        </div>
        <h1 className={display}>Your affiliate dashboard.</h1>
      </header>

      <section
        aria-labelledby="aff-stats"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <h2 id="aff-stats" className="sr-only">
          Stats
        </h2>
        <Stat
          label="Available balance"
          value={formatPrice(aff.available_balance_cents)}
          accent
        />
        <Stat label="Total earned" value={formatPrice(aff.total_earned_cents)} />
        <Stat label="Total paid out" value={formatPrice(aff.total_paid_cents)} />
        <Stat label="Successful referrals" value={String(successfulRefs)} />
      </section>

      <section aria-labelledby="aff-progress" className="space-y-3">
        <h2 id="aff-progress" className={sectionHead}>
          Tier progress
        </h2>
        <TierProgressBar
          current={aff.tier}
          totalRefs={successfulRefs}
          totalEarned={aff.total_earned_cents}
        />
      </section>

      <section aria-labelledby="aff-link" className="space-y-3">
        <h2 id="aff-link" className={sectionHead}>
          Your referral link
        </h2>
        <ReferralCard />
      </section>

      <section aria-labelledby="aff-redeem" className="space-y-3">
        <h2 id="aff-redeem" className={sectionHead}>
          Redeem commission
        </h2>
        <RedeemCommissionForm affiliate={aff} />
      </section>

      <section aria-labelledby="aff-ledger" className="space-y-3">
        <h2 id="aff-ledger" className={sectionHead}>
          Recent activity
        </h2>
        <CommissionLedgerTable entries={ledger} />
      </section>

      {onboarding?.ok ? (
        <section aria-labelledby="aff-docs" className="space-y-3">
          <h2 id="aff-docs" className={sectionHead}>
            Documents
          </h2>
          <div className="border rule bg-paper divide-y rule">
            <div className="px-5 py-4 flex items-center justify-between gap-4 text-sm">
              <div>
                <div className="text-ink">1099 contractor agreement</div>
                <div className="text-xs text-ink-muted mt-1">
                  {onboarding.agreement_signed
                    ? `Signed by ${onboarding.agreement_signed_name} · ${
                        onboarding.agreement_signed_at
                          ? new Date(onboarding.agreement_signed_at).toLocaleDateString()
                          : ""
                      } · ${onboarding.agreement_version}`
                    : "Not signed yet."}
                </div>
              </div>
              {!onboarding.agreement_signed ? (
                <Link
                  href="/account/affiliate-onboarding"
                  className="text-xs text-gold hover:underline"
                >
                  Complete onboarding →
                </Link>
              ) : null}
            </div>
            <div className="px-5 py-4 flex items-center justify-between gap-4 text-sm">
              <div>
                <div className="text-ink">W9 (read-only)</div>
                <div className="text-xs text-ink-muted mt-1">
                  {onboarding.w9_uploaded
                    ? `${onboarding.w9_filename} · uploaded ${
                        onboarding.w9_uploaded_at
                          ? new Date(onboarding.w9_uploaded_at).toLocaleDateString()
                          : ""
                      }`
                    : "Not uploaded yet."}
                </div>
              </div>
              {w9Url ? (
                <a
                  href={w9Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-4 bg-ink text-paper text-xs uppercase tracking-[0.1em] hover:bg-gold inline-flex items-center"
                >
                  Download (5 min)
                </a>
              ) : !onboarding.w9_uploaded ? (
                <Link
                  href="/account/affiliate-onboarding"
                  className="text-xs text-gold hover:underline"
                >
                  Upload →
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {payouts.length > 0 && (
        <section aria-labelledby="aff-payouts" className="space-y-3">
          <h2 id="aff-payouts" className={sectionHead}>
            Recent payouts
          </h2>
          <div className="border rule bg-paper overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b rule text-left">
                  <th className="px-4 py-3 font-display uppercase text-[11px] tracking-[0.14em] text-ink-soft">
                    Date
                  </th>
                  <th className="px-4 py-3 font-display uppercase text-[11px] tracking-[0.14em] text-ink-soft">
                    Method
                  </th>
                  <th className="px-4 py-3 font-display uppercase text-[11px] tracking-[0.14em] text-ink-soft">
                    Status
                  </th>
                  <th className="px-4 py-3 font-display uppercase text-[11px] tracking-[0.14em] text-ink-soft text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b rule last:border-0">
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-ink uppercase text-xs tracking-[0.1em]">
                      {p.method}
                    </td>
                    <td className="px-4 py-3 text-ink-soft text-xs uppercase tracking-[0.1em]">
                      {p.status}
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-ink whitespace-nowrap">
                      {formatPrice(p.amount_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </article>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="border rule bg-paper-soft p-5">
      <div className="font-display uppercase text-[10px] tracking-[0.14em] text-ink-muted">
        {label}
      </div>
      <div
        className={
          "mt-2 font-mono text-2xl " +
          (accent ? "text-gold-dark" : "text-ink")
        }
      >
        {value}
      </div>
    </div>
  );
}
