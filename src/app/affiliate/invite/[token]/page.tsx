import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";
import { consumeAffiliateInvite } from "@/app/actions/affiliate-portal";

export const metadata: Metadata = {
  title: "Affiliate invite · Bench Grade Peptides",
  robots: { index: false, follow: false },
};

const eyebrow =
  "font-display uppercase text-[12px] tracking-[0.18em] text-gold-dark";
const display =
  "font-editorial italic text-3xl lg:text-4xl text-ink leading-[1.15]";

export default async function AffiliateInviteLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();

  if (!user) {
    return (
      <article className="max-w-xl mx-auto px-6 lg:px-10 py-16 lg:py-20 space-y-8">
        <header className="space-y-3">
          <p className={eyebrow}>AFFILIATE INVITE</p>
          <h1 className={display}>You&rsquo;ve been invited.</h1>
        </header>
        <p className="font-editorial text-base text-ink-soft leading-relaxed">
          Sign in or create a free Bench Grade Peptides account to accept the
          invitation. After you sign in we&rsquo;ll bring you back here to
          confirm and start onboarding.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/affiliate/invite/${token}`)}`}
          className="inline-flex items-center justify-center h-11 px-6 bg-wine text-paper font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep"
        >
          Sign in to continue →
        </Link>
      </article>
    );
  }

  const res = await consumeAffiliateInvite(token);
  if (res.ok) {
    redirect("/account/affiliate-onboarding");
  }

  return (
    <article className="max-w-xl mx-auto px-6 lg:px-10 py-16 lg:py-20 space-y-6">
      <header className="space-y-3">
        <p className={eyebrow}>AFFILIATE INVITE</p>
        <h1 className={display}>This link can&rsquo;t be used.</h1>
      </header>
      <p className="font-editorial text-base text-ink-soft leading-relaxed">
        {res.error ?? "Invite unavailable."}
      </p>
      <Link
        href="/account"
        className="inline-flex items-center text-sm text-gold hover:underline"
      >
        Go to my account →
      </Link>
    </article>
  );
}
