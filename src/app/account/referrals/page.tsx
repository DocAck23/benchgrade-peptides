import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";
import { ReferralCard } from "@/components/account/ReferralCard";
import type {
  ReferralRow,
  FreeVialEntitlementRow,
} from "@/lib/supabase/types";

/**
 * Customer portal — Referrals (Sprint 3 Wave C).
 *
 * Server component. Renders the hero <ReferralCard/> (which fetches its own
 * code/stats) plus two RLS-scoped sections:
 *   1. Past referrals with status pills.
 *   2. Free-vial entitlements (available + redeemed).
 *
 * All data reads use the cookie-scoped client; RLS enforces ownership.
 */

export const metadata: Metadata = {
  title: "Referrals · Bench Grade Peptides",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/referrals" },
};

const eyebrow =
  "font-display uppercase text-[11px] tracking-[0.18em] text-gold-dark";
const sectionHeading =
  "font-editorial italic text-2xl text-ink leading-tight";

const STATUS_TONE: Record<ReferralRow["status"], string> = {
  pending: "border-ink-muted text-ink-muted",
  shipped: "border-gold text-gold-dark",
  redeemed: "border-gold text-gold-dark",
  cancelled: "border-ink-muted text-ink-muted line-through",
};

const ENT_STATUS_TONE: Record<FreeVialEntitlementRow["status"], string> = {
  available: "border-gold text-gold-dark",
  redeemed: "border-ink-muted text-ink-muted",
  expired: "border-ink-muted text-ink-muted line-through",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 1) return email;
  const head = email[0] ?? "";
  const domain = email.slice(at);
  return `${head}•••${domain}`;
}

export default async function ReferralsPage() {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect("/login?next=/account/referrals");

  const [referralsRes, entitlementsRes] = await Promise.all([
    supa
      .from("referrals")
      .select("*")
      .eq("referrer_user_id", user.id)
      .order("created_at", { ascending: false }),
    supa
      .from("free_vial_entitlements")
      .select("*")
      .eq("customer_user_id", user.id)
      .order("granted_at", { ascending: false }),
  ]);

  const referrals = (referralsRes.data ?? []) as ReferralRow[];
  const entitlements = (entitlementsRes.data ?? []) as FreeVialEntitlementRow[];

  return (
    <main className="space-y-12">
      <header className="space-y-2">
        <p className={eyebrow}>REFERRALS</p>
        <h1
          className="font-editorial italic text-3xl lg:text-4xl text-ink leading-tight"
          style={{ fontFamily: "var(--font-editorial)" }}
        >
          Your share-the-bench dashboard.
        </h1>
      </header>

      <ReferralCard />

      <section
        aria-labelledby="past-referrals-heading"
        className="space-y-5"
      >
        <div className="flex items-baseline justify-between">
          <h2 id="past-referrals-heading" className={sectionHeading}>
            Past referrals
          </h2>
          {referrals.length > 0 && (
            <span className="font-mono-data text-xs text-ink-muted uppercase tracking-wider">
              {referrals.length} total
            </span>
          )}
        </div>

        {referrals.length === 0 ? (
          <div className="border rule bg-paper-soft p-8 text-center">
            <p
              className="font-editorial italic text-lg text-ink-soft"
              style={{ fontFamily: "var(--font-editorial)" }}
            >
              Your first referral starts the streak. Share your link.
            </p>
          </div>
        ) : (
          <ul
            className="border rule bg-paper divide-y rule"
            data-testid="past-referrals-list"
          >
            {referrals.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] items-center gap-3 sm:gap-6 px-4 py-4"
              >
                <div className="min-w-0">
                  <div className="text-sm text-ink truncate">
                    {maskEmail(r.referee_email)}
                  </div>
                  <div className="font-mono-data text-[11px] text-ink-muted uppercase tracking-wider mt-0.5">
                    Referred {formatDate(r.created_at)}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center justify-center px-2.5 py-1 border rule font-display uppercase text-[10px] tracking-[0.14em] ${STATUS_TONE[r.status]}`}
                >
                  {r.status}
                </span>
                <span className="font-mono-data text-[11px] text-ink-muted uppercase tracking-wider">
                  {r.code}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="entitlements-heading"
        className="space-y-5"
      >
        <div className="flex items-baseline justify-between">
          <h2 id="entitlements-heading" className={sectionHeading}>
            Free-vial entitlements
          </h2>
        </div>

        {entitlements.length === 0 ? (
          <div className="border rule bg-paper-soft p-8 text-center">
            <p
              className="font-editorial italic text-lg text-ink-soft"
              style={{ fontFamily: "var(--font-editorial)" }}
            >
              Earn your first vial — every shipped referral lands one here.
            </p>
          </div>
        ) : (
          <ul
            className="border rule bg-paper divide-y rule"
            data-testid="entitlements-list"
          >
            {entitlements.map((e) => (
              <li
                key={e.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] items-center gap-3 sm:gap-6 px-4 py-4"
              >
                <div>
                  <div className="text-sm text-ink">
                    Free {e.size_mg}&nbsp;mg vial
                  </div>
                  <div className="font-mono-data text-[11px] text-ink-muted uppercase tracking-wider mt-0.5">
                    Granted {formatDate(e.granted_at)}
                    {e.redeemed_at
                      ? ` · Redeemed ${formatDate(e.redeemed_at)}`
                      : ""}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center justify-center px-2.5 py-1 border rule font-display uppercase text-[10px] tracking-[0.14em] ${ENT_STATUS_TONE[e.status]}`}
                >
                  {e.status}
                </span>
                <span className="font-mono-data text-[11px] text-ink-muted uppercase tracking-wider">
                  {e.source.replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
