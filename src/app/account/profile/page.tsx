import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";
import { getMyProfile } from "@/app/actions/profile";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = {
  title: "Profile · Bench Grade Peptides",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/profile" },
};

/**
 * Customer profile page.
 *
 * Server component handles auth + initial data fetch; the form is a
 * client island so the customer gets fast feedback and a clear save
 * affordance. Auth is double-gated (parent /account layout + this
 * page) so a missed-cookie race never renders someone else's profile.
 */
export default async function ProfilePage() {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect("/login?next=/account/profile");

  const result = await getMyProfile();
  if (!result.ok || !result.profile) {
    // Should never happen post-auth; render a safe empty form so the
    // customer can save fresh values rather than seeing a hard error.
    return (
      <article className="space-y-8 max-w-2xl">
        <header className="space-y-2">
          <p className="font-display uppercase text-[11px] tracking-[0.18em] text-gold-dark">
            PROFILE
          </p>
          <h1
            className="font-editorial italic text-3xl lg:text-4xl text-ink leading-tight"
            style={{ fontFamily: "var(--font-editorial)" }}
          >
            Your details.
          </h1>
        </header>
        <p className="text-sm text-ink-soft">
          Couldn&rsquo;t load your profile. Try again in a moment.
        </p>
      </article>
    );
  }

  return (
    <article className="space-y-8 max-w-2xl">
      <header className="space-y-2">
        <p className="font-display uppercase text-[11px] tracking-[0.18em] text-gold-dark">
          PROFILE
        </p>
        <h1
          className="font-editorial italic text-3xl lg:text-4xl text-ink leading-tight"
          style={{ fontFamily: "var(--font-editorial)" }}
        >
          Your details.
        </h1>
        <p className="text-sm text-ink-soft max-w-prose">
          Address and contact info we use as the default for new orders. Each
          order still keeps a snapshot of the address it shipped to.
        </p>
      </header>

      <section className="border rule bg-paper p-6 lg:p-8">
        <div className="text-[10px] font-display uppercase tracking-[0.18em] text-ink-muted mb-1">
          Email
        </div>
        <div className="font-mono-data text-sm text-ink break-all">
          {result.email}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Email is tied to your sign-in. Contact{" "}
          <a className="underline hover:text-ink" href="mailto:admin@benchgradepeptides.com">
            admin@benchgradepeptides.com
          </a>{" "}
          to change it.
        </p>
      </section>

      <ProfileForm initial={result.profile} />
    </article>
  );
}
