import type { Metadata } from "next";
import { ApplicationForm } from "@/components/affiliate/ApplicationForm";
import {
  commissionPercent,
  personalVialDiscount,
  type AffiliateTier,
} from "@/lib/affiliate/tiers";

/**
 * /affiliate/apply — public recruitment landing for the affiliate program
 * (Sprint 4 Wave C). No auth required; the application form captures the
 * applicant_user_id only when a session happens to exist.
 *
 * Tone: confident, premium, recruitment-ready. All copy passes RUO compliance
 * — we describe research-tool partnerships, never therapeutic outcomes.
 */

export const metadata: Metadata = {
  title: "Become an Affiliate · Bench Grade Peptides",
  description:
    "Partner with a US-synthesized, lot-tested research-only peptide lab. Earn 10–18% lifetime commission and a personal discount on your own bench supply.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/affiliate/apply" },
};

const TIER_ROWS: ReadonlyArray<{
  tier: AffiliateTier;
  label: string;
  threshold: string;
}> = [
  { tier: "bronze", label: "Bronze", threshold: "Entry tier on approval" },
  {
    tier: "silver",
    label: "Silver",
    threshold: "5 successful referrals or $1,000 earned",
  },
  {
    tier: "gold",
    label: "Gold",
    threshold: "15 successful referrals or $5,000 earned",
  },
  {
    tier: "eminent",
    label: "Eminent",
    threshold: "50 successful referrals or $25,000 earned",
  },
];

const eyebrow =
  "font-display uppercase text-[12px] tracking-[0.18em] text-gold-dark";
const display =
  "font-editorial italic text-4xl lg:text-5xl text-ink leading-[1.05]";
const sectionHead =
  "font-display uppercase text-[12px] tracking-[0.16em] text-ink mb-3";
const body =
  "font-editorial text-base text-ink-soft leading-relaxed";

export default function AffiliateApplyPage() {
  return (
    <article className="bg-paper">
      <div className="max-w-2xl mx-auto px-6 lg:px-8 py-20 space-y-14">
        <header className="space-y-4">
          <p className={eyebrow}>AFFILIATE PROGRAM</p>
          <h1 className={display}>Help researchers. Earn commission.</h1>
          <p className={body}>
            Bench Grade Peptides supplies US-synthesized, ≥99% HPLC research
            compounds with QR-COA on every vial. If you publish to a research,
            biohacking, or performance audience, we&apos;d like to work with
            you.
          </p>
        </header>

        <section aria-labelledby="how-it-works">
          <h2 id="how-it-works" className={sectionHead}>
            How it works
          </h2>
          <ol className="space-y-3 list-decimal list-inside text-base font-editorial text-ink-soft leading-relaxed">
            <li>
              <span className="text-ink">Apply</span> — tell us about your
              audience and where you publish.
            </li>
            <li>
              <span className="text-ink">Get approved</span> — we review within
              5 business days and email your dashboard credentials.
            </li>
            <li>
              <span className="text-ink">Share your link</span> — every
              researcher who buys through it gets 10% off, you earn lifetime
              commission on every order they ever place.
            </li>
          </ol>
        </section>

        <section aria-labelledby="tiers">
          <h2 id="tiers" className={sectionHead}>
            Tiers
          </h2>
          <div className="border rule bg-paper-soft overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b rule text-left">
                  <th className="px-4 py-3 font-display uppercase text-[11px] tracking-[0.14em] text-ink-soft">
                    Tier
                  </th>
                  <th className="px-4 py-3 font-display uppercase text-[11px] tracking-[0.14em] text-ink-soft text-right">
                    Commission
                  </th>
                  <th className="px-4 py-3 font-display uppercase text-[11px] tracking-[0.14em] text-ink-soft text-right">
                    Personal discount
                  </th>
                  <th className="px-4 py-3 font-display uppercase text-[11px] tracking-[0.14em] text-ink-soft">
                    Threshold
                  </th>
                </tr>
              </thead>
              <tbody>
                {TIER_ROWS.map((row) => (
                  <tr
                    key={row.tier}
                    className="border-b rule last:border-0"
                    data-tier={row.tier}
                  >
                    <td className="px-4 py-3 font-display uppercase text-[12px] tracking-[0.14em] text-gold-dark">
                      {row.label}
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-ink">
                      {commissionPercent(row.tier)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-ink">
                      {personalVialDiscount(row.tier)}%
                    </td>
                    <td className="px-4 py-3 text-ink-soft text-xs">
                      {row.threshold}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Tier promotions are automatic — whichever threshold you cross first
            (referrals or earnings) lifts you to the next band.
          </p>
        </section>

        <section aria-labelledby="who">
          <h2 id="who" className={sectionHead}>
            What we look for
          </h2>
          <p className={body}>
            We work best with peptide content creators, biohacking newsletters,
            performance and longevity coaches, and serious lab-supply
            reviewers. The common thread: you write or speak to people who
            already understand research compounds and know what &ldquo;research
            use only&rdquo; actually means. We do not partner with channels
            that imply therapeutic use or target a clinical audience.
          </p>
        </section>

        <section aria-labelledby="apply" className="space-y-5">
          <h2 id="apply" className={sectionHead}>
            Apply
          </h2>
          <ApplicationForm />
        </section>
      </div>
    </article>
  );
}
