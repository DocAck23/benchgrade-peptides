import type { Metadata } from "next";
import { getMyAffiliateOnboarding } from "@/app/actions/affiliate-portal";
import { AGREEMENT_HTML } from "@/lib/affiliate/agreement-1099-v1";
import { AffiliateOnboardingFlow } from "./AffiliateOnboardingFlow";

export const metadata: Metadata = {
  title: "Affiliate onboarding · Bench Grade Peptides",
  robots: { index: false, follow: false },
};

const eyebrow =
  "font-display uppercase text-[12px] tracking-[0.18em] text-gold-dark";
const display =
  "font-editorial italic text-3xl lg:text-4xl text-ink leading-[1.15]";

export default async function AffiliateOnboardingPage() {
  const status = await getMyAffiliateOnboarding();

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className={eyebrow}>AFFILIATE ONBOARDING</p>
        <h1 className={display}>Three steps to activation.</h1>
        <p className="font-editorial text-base text-ink-soft leading-relaxed max-w-2xl">
          Read the 1099 agreement, sign with your full legal name, and
          upload a completed W9. Once both are on file your affiliate
          dashboard unlocks.
        </p>
      </header>

      <AffiliateOnboardingFlow
        agreementHtml={AGREEMENT_HTML}
        initialStatus={{
          agreement_signed: status.agreement_signed,
          agreement_signed_name: status.agreement_signed_name,
          agreement_signed_at: status.agreement_signed_at,
          w9_uploaded: status.w9_uploaded,
          w9_filename: status.w9_filename,
        }}
      />
    </article>
  );
}
