import { createServerSupabase } from "@/lib/supabase/client";
import { ReferralLinkCopy } from "@/components/account/ReferralLinkCopy";
import { generateMyReferralCode } from "@/app/actions/referrals";
import type {
  ReferralCodeRow,
  ReferralRow,
  FreeVialEntitlementRow,
} from "@/lib/supabase/types";

/**
 * <ReferralCard/> — server component (Sprint 3 Wave B2).
 *
 * Reads (cookie-scoped Supabase, RLS enforced):
 *   - referral_codes row owned by the current user (1:1)
 *   - count of referrals where status in ('shipped','redeemed') → "successful"
 *   - count of free_vial_entitlements where status = 'available'
 *
 * Renders the customer-facing hero referral block: eyebrow + display headline +
 * link box (mono) + copy button + stats grid + 3-step "How it works".
 *
 * Empty state (no code yet) shows a <form> that POSTs to the
 * `generateMyReferralCode` server action via a tiny inline client wrapper.
 * The actual action lives in Wave B1 (`@/app/actions/referrals`); this
 * component is wired but the action import resolves at request-time.
 *
 * `siteUrl` is the public origin used to build share links. Defaults to
 * `https://benchgradepeptides.com` if `NEXT_PUBLIC_SITE_URL` isn't set.
 */

interface ReferralCardProps {
  /**
   * Override base URL for testing or for white-label / staging deploys.
   * Falls back to NEXT_PUBLIC_SITE_URL → https://benchgradepeptides.com.
   */
  siteUrl?: string;
}

function resolveSiteUrl(override?: string): string {
  if (override) return override.replace(/\/$/, "");
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  return "https://benchgradepeptides.com";
}

const eyebrow =
  "font-display uppercase text-[11px] tracking-[0.18em] text-gold-dark";
const display =
  "font-editorial italic text-3xl lg:text-4xl text-ink leading-tight";
const stat =
  "font-editorial italic text-2xl text-ink";
const statLabel =
  "font-display uppercase text-[10px] tracking-[0.14em] text-ink-muted mt-1";

export async function ReferralCard({ siteUrl }: ReferralCardProps = {}) {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    return (
      <section
        className="border rule bg-paper p-6 lg:p-8"
        aria-labelledby="referral-card-heading"
        data-testid="referral-card"
      >
        <p
          id="referral-card-heading"
          className="font-editorial italic text-lg text-ink-soft"
        >
          Sign in to earn free vials by inviting researchers.
        </p>
      </section>
    );
  }

  const [codeRes, referralsRes, entitlementsRes] = await Promise.all([
    supa
      .from("referral_codes")
      .select("*")
      .eq("owner_user_id", user.id)
      .maybeSingle(),
    supa
      .from("referrals")
      .select("id,status", { count: "exact", head: false })
      .eq("referrer_user_id", user.id),
    supa
      .from("free_vial_entitlements")
      .select("id,status,size_mg", { count: "exact", head: false })
      .eq("customer_user_id", user.id)
      .eq("status", "available"),
  ]);

  // Auto-generate the customer's referral code on first card render.
  // generateMyReferralCode is idempotent — a returning user with an
  // existing row just gets it handed back without a new insert.
  let code = (codeRes.data ?? null) as ReferralCodeRow | null;
  if (!code) {
    const created = await generateMyReferralCode();
    if (created.ok && created.code) {
      // Reconstruct just the columns we need; the underlying row was
      // inserted by the action and exists in the DB. Defaults for the
      // rest of the schema columns are filled by Postgres.
      code = {
        code: created.code,
        owner_user_id: user.id,
      } as ReferralCodeRow;
    }
  }
  const referralRows = (referralsRes.data ?? []) as Array<
    Pick<ReferralRow, "id" | "status">
  >;
  const successfulCount = referralRows.filter(
    (r) => r.status === "shipped" || r.status === "redeemed"
  ).length;
  const availableCount = (
    (entitlementsRes.data ?? []) as Array<Pick<FreeVialEntitlementRow, "id">>
  ).length;

  const url = code ? `${resolveSiteUrl(siteUrl)}/r/${code.code}` : null;

  return (
    <section
      className="border rule bg-paper p-6 lg:p-8 space-y-6"
      aria-labelledby="referral-card-heading"
      data-testid="referral-card"
    >
      <header className="space-y-2">
        <p className={eyebrow}>REFER A RESEARCHER</p>
        <h2 id="referral-card-heading" className={display}>
          Earn free vials. Help your friends.
        </h2>
        <p className="text-sm text-ink-soft max-w-prose">
          Share your link. When a peer places their first order, you earn a
          free 5&nbsp;mg or 10&nbsp;mg vial on your next checkout. They get
          10% off their first order.
        </p>
      </header>

      {code && url ? (
        <div className="border rule bg-paper-soft p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-display uppercase text-[10px] tracking-[0.14em] text-ink-muted mb-1">
              Your referral link
            </p>
            <p
              className="font-mono-data text-sm text-ink break-all"
              data-testid="referral-url"
            >
              {url}
            </p>
          </div>
          <ReferralLinkCopy code={code.code} url={url} />
        </div>
      ) : (
        // Fallback when auto-generation fails (rare — DB unavailable,
        // service-role missing, etc). We surface a non-fatal note
        // rather than a button so the customer doesn't think the
        // page itself is broken.
        <div
          className="border rule bg-paper-soft p-4"
          data-testid="referral-create-form"
        >
          <p className="text-sm text-ink-soft">
            We couldn&apos;t generate your referral link right now. Refresh
            in a moment, or email{" "}
            <a
              href="mailto:admin@benchgradepeptides.com"
              className="text-teal underline"
            >
              admin@benchgradepeptides.com
            </a>{" "}
            and we&apos;ll set you up.
          </p>
        </div>
      )}

      <div
        className="grid grid-cols-2 gap-4 border-t rule pt-5"
        data-testid="referral-stats"
      >
        <div>
          <div className={stat}>{successfulCount}</div>
          <div className={statLabel}>Successful referrals</div>
        </div>
        <div>
          <div className={stat}>{availableCount}</div>
          <div className={statLabel}>Free vials available</div>
        </div>
      </div>

      <div className="border-t rule pt-5">
        <p className="font-display uppercase text-[10px] tracking-[0.14em] text-ink-muted mb-3">
          How it works
        </p>
        <ol className="space-y-2 text-sm text-ink-soft list-decimal list-inside">
          <li>Share your link with a fellow researcher.</li>
          <li>They get 10% off their first order automatically.</li>
          <li>
            Once their order ships, you earn a free vial — redeem it on your
            next checkout.
          </li>
        </ol>
      </div>
    </section>
  );
}
