import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Launch Status",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LaunchStatusPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <article className="max-w-5xl mx-auto px-6 lg:px-10 py-12 space-y-12">
      <header>
        <div className="label-eyebrow text-ink-muted mb-2">Admin · Build status</div>
        <h1 className="font-display text-4xl lg:text-5xl text-ink leading-tight mb-4">
          Launch Status — End to End.
        </h1>
        <p className="text-base text-ink-soft max-w-prose leading-relaxed">
          Every workstream landed on this codebase, in one place. Use the
          companion <Link href="/admin/launch-test-plan" className="text-teal underline">test plan</Link> to walk
          each customer-facing flow before flipping DNS.
        </p>
      </header>

      <Section title="Customer-facing surfaces" status="ready">
        <Item label="Homepage hero + feature carousel">
          Catalogue tease with auto-spinning, uniform-height cards (60 px/sec mobile, 90 px/sec desktop).
          Hides on scroll-down, returns on scroll-up. Edge gradients removed.
        </Item>
        <Item label="Catalogue browser (5-per-row)">
          Sidebar with search box + category checkboxes. Filters every product (66 SKUs)
          client-side. Uniform 452px cards.
        </Item>
        <Item label="Product detail pages (PDPs)">
          Per-product schema (Product + AggregateOffer JSON-LD), variant picker,
          add-to-cart, RUO statement, COA messaging.
        </Item>
        <Item label="Stack pages">
          Curated multi-vial stacks (Wolverine, Metabolic Pair, etc.) at /catalogue/stacks/[slug].
        </Item>
        <Item label="Research literature browser">
          /research with sidebar (search + class checkboxes + companion-animal filter).
          64 verified PubMed citations across 8 compound classes, with per-article detail
          pages at /research/[slug] and ScholarlyArticle JSON-LD.
        </Item>
        <Item label="Multi-step checkout (4 steps)">
          1. Contact + shipping
          2. Add-ons + first-time-buyer bonus vial picker (any catalog SKU at 25% off)
          3. Subscribe & save OR continue with one-time order (explicit choice)
          4. Payment method + coupon + notes + RUO certification
        </Item>
        <Item label="Cart drawer">
          Stack & Save progress, FIRST250-cohort lifetime-shipping pill recognition.
        </Item>
        <Item label="Pre-launch popup">
          Bot-suppressed (Googlebot, AdsBot, social link-fetchers). Email capture →
          branded welcome email with launch perk teaser. Override URL <code>?prelaunch=show</code>.
        </Item>
      </Section>

      <Section title="Customer accounts" status="ready">
        <Item label="Magic-link sign-in">
          Branded Supabase auth emails (5 templates: magic-link, confirm signup,
          reset password, change email, security notifications). Wine + gold + serif
          shell matching the rest of the brand.
        </Item>
        <Item label="/account dashboard">
          Order history, subscription status, recent messages.
        </Item>
        <Item label="/account/orders + /account/orders/[id]">
          Order timeline, status pills, edit-shipping + cancel-before-payment flows.
        </Item>
        <Item label="/account/subscription">
          Pause / Resume / Cancel-with-reason / Skip-next-cycle. Lifecycle confirmation
          emails on every transition.
        </Item>
        <Item label="/account/referrals">
          Auto-generated referral code + share link. No "Create my code" button —
          link is just there.
        </Item>
        <Item label="/account/security">
          Marketing-email opt-out, password set/change.
        </Item>
        <Item label="/account/messages">
          Two-way thread with admin (lab notes, order questions).
        </Item>
      </Section>

      <Section title="Subscriptions" status="ready">
        <Item label="Plan combinations">
          1, 3, 6, 9, 12 month durations × prepay/bill-pay × monthly/quarterly/once cadence.
          Discount validity computed server-side; invalid combos fall through to one-shot.
        </Item>
        <Item label="Cycle lifecycle">
          Started, payment-due (bill-pay), shipped, renewal — each with branded email.
        </Item>
        <Item label="Self-service controls">
          Pause, resume, skip-next-cycle, cancel-with-reason — all with confirmation
          emails to the customer.
        </Item>
      </Section>

      <Section title="Promo / discount system" status="ready">
        <Item label="Coupon engine">
          Best-of stacking (coupon vs. Stack &amp; Save + same-SKU + affiliate + referral).
          Atomic Postgres RPC (<code>redeem_coupon</code>) with FOR UPDATE row lock.
        </Item>
        <Item label="FIRST250 cohort coupon">
          Marketed as "first 250 orders." Real cap is 50 to create scarcity floor.
          Auth-gated (researcher must have an account). Tier structure:
          baseline 10% + free shipping for life; $250+ → progressive 30% on spend
          above $250; $500+ → free vial; $1000+ → 2 free vials; subscription prepay
          3mo → 18% override; 6mo → 25% override.
        </Item>
        <Item label="FOUNDER fallback coupon">
          Surfaced when FIRST250 hits cap. 25% off when cart has 3+ vials (server-enforced
          with reversal on bypass). $500+ → free vial; $1000+ → 2 free vials.
          One-time per email, no global cap.
        </Item>
        <Item label="First-time-buyer bonus vial">
          Any catalog SKU at 25% off, ADDED to the order on top of cart (not a discount
          on existing). Shipped as a real line item at retail × 0.75.
        </Item>
        <Item label="Lifetime free shipping ledger">
          email_lower-keyed table populated when FIRST250 redeems. Cart and checkout
          both recognize and flip the shipping pill.
        </Item>
        <Item label="Coupon admin">
          /admin/coupons — create/list/expire/delete codes with redemption count + total $ saved.
        </Item>
      </Section>

      <Section title="Affiliate portal" status="ready-with-manual">
        <Item label="Invite-only signup">
          Admin generates one-time-use invite link from /admin/affiliates. Atomic claim
          (<code>.is(consumed_at, null)</code>) so two concurrent clicks can't both succeed.
        </Item>
        <Item label="3-step onboarding">
          Read agreement → type-name e-signature → upload W9 (PDF, ≤5MB, magic-bytes
          verified, per-user rate-limited). Each step gated by the prior.
        </Item>
        <Item label="1099 contractor agreement">
          ~1100 words, plainly written, Delaware governing law. Snapshot HTML +
          signed name + IP + UA + version persisted in <code>affiliate_agreements</code>.
        </Item>
        <Item label="Document access (read-only)">
          Both admin (in /admin/affiliates/[userId]) and affiliate (in /account/affiliate
          Documents tab) see signed agreement + W9 download via short-lived (5-min)
          signed URLs.
        </Item>
        <Item label="Existing affiliate dashboard (separate)">
          /account/affiliate — tier, commission balance, vial-credit redemption,
          referral link, payout request.
        </Item>
      </Section>

      <Section title="Admin tooling" status="ready">
        <Item label="/admin (Orders)">
          Order list, status filters, per-order management, AgeRecode fulfillment
          handoff trigger, COA URL lookup.
        </Item>
        <Item label="/admin/analytics">
          Top-line KPIs (sessions, conversion, AOV, abandoned-checkout rate, email
          capture). 30d spark, 5-step conversion funnel, traffic-source attribution
          by session_id (no double-counting), top pages, top SKUs, geo, device split.
        </Item>
        <Item label="/admin/visitors">
          Per-session drill-down with outcome (browsed / abandoned / ordered) and
          full event timeline per session.
        </Item>
        <Item label="/admin/coupons">CRUD with usage stats.</Item>
        <Item label="/admin/affiliates">
          Cohort table, "Generate invite" dialog, per-affiliate detail with
          signed agreement HTML + W9 download.
        </Item>
        <Item label="/admin/reconciliation">Wire/ACH/Zelle reconciliation aid.</Item>
        <Item label="/admin/email-preview">
          Browse all 12 customer-facing email templates + 4 subscription lifecycle
          variants, rendered live.
        </Item>
        <Item label="/admin/briefs">
          Long-form research / press briefs.
        </Item>
      </Section>

      <Section title="Analytics + observability" status="ready">
        <Item label="First-party analytics">
          Custom <code>analytics_sessions</code> + <code>analytics_events</code> tables.
          No third-party tracker. Beacon survives unload; bots filtered; rate-limited
          (300 events / IP / 5 min); properties JSON capped at 8KB.
        </Item>
        <Item label="Funnel events wired">
          pageview, product_view, add_to_cart, remove_from_cart, checkout_start,
          checkout_step, coupon_attempt, order_submitted.
        </Item>
        <Item label="Sentry">
          Server + edge runtime instrumentation. (Requires SENTRY_DSN env vars in prod.)
        </Item>
      </Section>

      <Section title="Compliance + SEO" status="ready">
        <Item label="RUO compliance lint">
          Banned-term patterns at <code>src/lib/compliance/banned-terms.ts</code>.
          Catches therapeutic claims, dosing language, branded-drug comparisons,
          standalone outcome nouns in product names.
        </Item>
        <Item label="robots.txt + meta posture">
          Cart, checkout, account, affiliate, login, auth, news, COA paths blocked
          from Googlebot + AdsBot. PDPs, categories, stacks set
          <code>nosnippet</code> + <code>noimageindex</code> so SERP cards don't
          auto-extract therapeutic-claim-adjacent body text.
        </Item>
        <Item label="Per-page SEO metadata">
          Unique title + description on every public route. Per-page Open Graph + Twitter.
          Canonical URLs everywhere.
        </Item>
        <Item label="Structured data">
          Organization + WebSite (with SearchAction) site-wide. Product +
          AggregateOffer on PDPs. BreadcrumbList on category pages. ScholarlyArticle
          on research articles.
        </Item>
        <Item label="Sitemap">
          Every public route — including all 64 research articles and all stack pages.
        </Item>
      </Section>

      <Section title="Email infrastructure" status="ready-with-manual">
        <Item label="Resend integration">
          Best-effort dispatchers for every transactional email. Failures don't roll
          back order state.
        </Item>
        <Item label="Branded templates (12 total)">
          Order confirmation (4 payment-method variants) · Payment confirmed · Order
          shipped · AgeRecode fulfillment handoff · Account-claim magic link ·
          Crypto payment link · Order refunded · 4 subscription lifecycle (started,
          paused, resumed, cancelled, skipped) · Pre-launch welcome.
        </Item>
        <Item label="Branded Supabase auth emails (5)">
          Magic link, confirm signup, reset password, change email, security
          notifications. HTML pasted into Supabase dashboard manually.
        </Item>
      </Section>

      <Section title="What's NOT yet built (deferred to post-launch)" status="not-yet">
        <Item label="$25 referral in-store credit ledger">
          The "wallet" system that pays out when a referee crosses $250 spend.
          Schema design is sketched in earlier convos. Real ledger system needs
          its own focused session — balance table, transactions append-only,
          checkout-time redemption with anti-double-spend.
        </Item>
        <Item label="DB-backed catalogue admin">
          Today: catalog is a static TypeScript array (<code>src/lib/catalogue/data.ts</code>).
          Founder edits via PR. A full admin UI to create/edit/delete products + image
          upload via Supabase Storage was scoped and explicitly deferred.
        </Item>
        <Item label="Performance budget tooling">
          Lighthouse perf score is not in scope of this sprint. SEO target only (≥95).
        </Item>
        <Item label="Full WCAG accessibility audit">
          Site is mostly clean (semantic HTML, keyboard-reachable carousel, focus-visible
          states) but no formal WCAG 2.1 AA pass yet.
        </Item>
        <Item label="Live FedEx label generation">
          AgeRecode + BioSafe Solutions handle this manually outside the platform.
        </Item>
      </Section>

      <Section title="Needs your attention before launch" status="needs-you">
        <Item label="Vercel env vars">
          Walk <Link href="https://github.com/DocAck23/benchgrade-peptides/blob/main/docs/LAUNCH-CHECKLIST.md" className="text-teal underline">docs/LAUNCH-CHECKLIST.md</Link> §A1.
          Required: <code>ADMIN_PASSWORD</code> (change from dev placeholder),
          all Supabase keys, Resend, NOWPayments (if crypto), Sentry. Wire instructions
          for the 4 payment methods, Zelle ID, AgeRecode email.
        </Item>
        <Item label="Resend domain verification">
          DKIM + SPF on benchgradepeptides.com. Resend dashboard must show "Verified"
          on the FROM domain. Without this, every transactional email lands in spam
          or bounces silently.
        </Item>
        <Item label="DNS pointing at Vercel">
          benchgradepeptides.com + www.benchgradepeptides.com → Vercel IPs. SSL
          auto-provisions in &lt; 5 minutes after.
        </Item>
        <Item label="Supabase Storage: create the affiliate-w9 bucket">
          PRIVATE bucket. RLS policies are already applied via migration 0022.
          Walkthrough at <Link href="https://github.com/DocAck23/benchgrade-peptides/blob/main/docs/AFFILIATE-PORTAL-MANUAL.md" className="text-teal underline">docs/AFFILIATE-PORTAL-MANUAL.md</Link>.
        </Item>
        <Item label="Smoke-order end-to-end test">
          Per the <Link href="/admin/launch-test-plan" className="text-teal underline">test plan</Link>
          {" "}— one full order against the production deploy with a real email address you
          control. Confirms every payment method's instruction email, the
          account-claim magic link, status-transition emails, and the AgeRecode
          fulfillment handoff all wire up correctly.
        </Item>
        <Item label="Codex pass 2 deferred items">
          4 issues documented in <Link href="https://github.com/DocAck23/benchgrade-peptides/blob/main/docs/MANUAL-ATTENTION.md" className="text-teal underline">docs/MANUAL-ATTENTION.md</Link> —
          two HIGH (financial-state lost-update races on affiliate balance / payout)
          and two MEDIUM. Each needs a transactional Postgres RPC. Not blocking
          the small-volume launch but should land before scale.
        </Item>
        <Item label="Submit sitemap to Google Search Console + Bing Webmaster">
          After DNS flips. <code>/sitemap.xml</code> covers everything.
        </Item>
      </Section>

      <Section title="Verification snapshot" status="ready">
        <Item label="Test suite">
          534 tests passing, 5 skipped, 0 failures. <code>tsc --noEmit</code> clean.
        </Item>
        <Item label="Codex review pass 1">
          Focused on the W4 + W6 sprint commits. 6 issues found, all 6 fixed in
          commit <code>11d1e41</code>.
        </Item>
        <Item label="Codex review pass 2">
          Full-codebase sweep. 7 issues found. 3 fixed in commit <code>8795065</code>
          (CRITICAL FIRST250 math, HIGH FOUNDER server enforcement, MEDIUM analytics
          property cap). 4 documented in MANUAL-ATTENTION for follow-up.
        </Item>
        <Item label="Tests passing per workstream">
          W6 affiliate portal: +22 tests. Total +22 from sprint (was 512 → 534).
        </Item>
      </Section>

      <footer className="border-t rule pt-6 text-sm text-ink-muted">
        Last updated by the build-status page generator on the latest commit.
        For runtime test instructions, see <Link href="/admin/launch-test-plan" className="text-teal underline">/admin/launch-test-plan</Link>.
      </footer>
    </article>
  );
}

function Section({
  title,
  status,
  children,
}: {
  title: string;
  status: "ready" | "ready-with-manual" | "not-yet" | "needs-you";
  children: React.ReactNode;
}) {
  const tone = {
    ready: { label: "READY", cls: "bg-teal/10 text-teal border-teal/40" },
    "ready-with-manual": {
      label: "READY · MANUAL STEP NEEDED",
      cls: "bg-gold-dark/10 text-gold-dark border-gold-dark/40",
    },
    "not-yet": {
      label: "NOT YET",
      cls: "bg-ink-muted/15 text-ink-muted border-ink-muted/40",
    },
    "needs-you": {
      label: "NEEDS YOU",
      cls: "bg-wine/10 text-wine border-wine/40",
    },
  }[status];

  return (
    <section className="border rule bg-paper">
      <header className="px-6 py-4 border-b rule flex items-center justify-between gap-4">
        <h2 className="font-display text-xl text-ink">{title}</h2>
        <span
          className={`text-[10px] uppercase tracking-[0.1em] px-2 py-1 border ${tone.cls}`}
        >
          {tone.label}
        </span>
      </header>
      <div className="px-6 py-2 divide-y rule">{children}</div>
    </section>
  );
}

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3">
      <div className="font-display text-sm text-ink mb-1">{label}</div>
      <div className="text-sm text-ink-soft leading-relaxed">{children}</div>
    </div>
  );
}
