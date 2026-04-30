import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Launch Test Plan",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LaunchTestPlanPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <article className="max-w-4xl mx-auto px-6 lg:px-10 py-12 space-y-12">
      <header>
        <div className="label-eyebrow text-ink-muted mb-2">Admin · Manual QA</div>
        <h1 className="font-display text-4xl lg:text-5xl text-ink leading-tight mb-4">
          Launch Test Plan — End to End.
        </h1>
        <p className="text-base text-ink-soft max-w-prose leading-relaxed">
          Walk these flows on the production deploy with a real email inbox you
          control before flipping DNS to public. Each flow has explicit STEPS and
          EXPECTED OUTCOMES — if reality and expectation diverge, that's a launch
          blocker. For a build-status overview see{" "}
          <Link href="/admin/launch-status" className="text-gold underline">
            /admin/launch-status
          </Link>.
        </p>
        <Callout>
          <strong>Test-data hygiene.</strong> Use a real email inbox you can
          actually open. Stub addresses (<code>+test@</code>, plus-tags) are
          fine — Resend treats them as deliverable. Do NOT use throwaway/burner
          addresses; the magic-link flow needs you to actually click through.
        </Callout>
      </header>

      <Flow
        n={1}
        title="Anonymous browse → cart → checkout → submit"
        why="The bread-and-butter purchase flow. Every customer touches this."
      >
        <Step>
          Open <code>https://benchgradepeptides.com/</code> in an incognito window.
        </Step>
        <Expected>
          Wine header (auto-hides on scroll-down, shows on scroll-up). Featured
          carousel scrolls automatically. No console errors. Pre-launch popup
          appears after ~4 seconds.
        </Expected>
        <Step>Dismiss the popup with the X.</Step>
        <Expected>Popup disappears + does not return on this tab.</Expected>
        <Step>
          Navigate to <code>/catalogue</code>. Use the sidebar search box to
          search "GLP-1". Toggle a category checkbox.
        </Step>
        <Expected>
          Grid filters in real-time. "Showing N of 66 compounds" counter updates.
          5 cards per row on desktop. Every card same height.
        </Expected>
        <Step>
          Click any product card. Verify the PDP loads with vial photo, summary,
          variant picker (size + pack), and "Add to cart" button.
        </Step>
        <Expected>
          PDP renders. Title + description visible. View source: a
          <code>{`<script type="application/ld+json">`}</code> block with the
          Product schema is present.
        </Expected>
        <Step>
          Pick a variant. Click "Add to cart". Open the cart drawer.
        </Step>
        <Expected>
          Cart drawer slides in from the right with the line. Stack & Save
          progress bar shows. "Free shipping" pill OR threshold counter, depending
          on cart size.
        </Expected>
        <Step>Click "Checkout".</Step>
        <Expected>
          Land on /checkout step 1 (Contact + shipping). Fields: name, email,
          phone, institution, ship address, city, state, ZIP.
        </Expected>
        <Step>
          Fill in your real email + a real-looking US shipping address. Click
          "Continue to add-ons".
        </Step>
        <Expected>
          Step 2 expands. Add-on options visible. If your email has no prior
          order, "First-time researcher · 25% off an additional vial" picker
          shows with full-catalog dropdown.
        </Expected>
        <Step>
          Skip the bonus. Click "Continue to subscribe & save".
        </Step>
        <Expected>
          Step 3 shows two equally-prominent buttons: "Subscribe & save" and
          "Continue with one-time".
        </Expected>
        <Step>Click "Continue with one-time".</Step>
        <Expected>Step 4 expands. Payment method selector + coupon field + notes textarea + RUO certification.</Expected>
        <Step>
          Pick "Wire" (most reliable to test — no external API). Click "Submit".
        </Step>
        <Expected>
          RUO acknowledgment dialog appears. Tick all 3 boxes. Submit again.
        </Expected>
        <Expected>
          Redirect to /checkout/success with the order memo. Order appears in
          /admin orders list within 5 seconds. Inbox: 4 emails arrive within
          ~30 seconds — Order Confirmation (with wire instructions), Admin
          Notification, AgeRecode Fulfillment Handoff (to AgeRecode email),
          Account-Claim Magic Link.
        </Expected>
      </Flow>

      <Flow
        n={2}
        title="First-time-buyer bonus vial = 25% off ADDITIONAL"
        why="The first-order incentive. Should add a NEW line at retail × 0.75 — NOT discount an existing line."
      >
        <Step>
          Use a fresh email address (incognito helps). Add ONE product to cart.
        </Step>
        <Step>
          Walk through checkout step 1 (info + shipping). At step 2, the bonus-vial
          picker should be visible.
        </Step>
        <Step>
          Pick a DIFFERENT vial from the cart, e.g. if cart has GLP-1 S 5mg, pick
          BPC-157 5mg as the bonus.
        </Step>
        <Step>Continue through to step 4. Submit.</Step>
        <Expected>
          Order in admin shows TWO line items: the original cart vial at full
          retail, AND the bonus vial at retail × 0.75. The discount line
          captures retail × 0.25 (the savings). Customer pays:{" "}
          <code>cart_total + bonus_retail * 0.75</code>.
        </Expected>
        <Expected>
          If you immediately submit a second order from the SAME email, the
          bonus-vial picker should be ABSENT in step 2 (no longer first-time).
        </Expected>
      </Flow>

      <Flow
        n={3}
        title="FIRST250 cohort signup → claim → tier perks"
        why="The marquee launch promo. Auth-gated, progressive math, multiple tier overlays."
      >
        <Step>
          Sign up via the pre-launch popup (or hit{" "}
          <code>?prelaunch=show</code> on the homepage). Use a real email.
        </Step>
        <Expected>
          Branded "Welcome to Bench Grade Peptides" email arrives. Mentions
          FIRST250 perk structure. <code>welcome_sent_at</code> on the{" "}
          <code>prelaunch_signups</code> row.
        </Expected>
        <Step>
          Sign in via magic link (use the <code>/login</code> page; enter same
          email).
        </Step>
        <Expected>Magic-link email arrives, branded wine + gold. Click; land authed at /account.</Expected>
        <Step>
          Browse /catalogue, add ONE $200 vial to cart, check out. At step 4
          payment, type code <code>FIRST250</code> and click "Apply".
        </Step>
        <Expected>
          Coupon preview shows "FIRST250 applied — saves $20" (10% baseline on
          $200, no progressive bonus yet at &lt; $250).
        </Expected>
        <Step>Submit.</Step>
        <Expected>
          Order persists. <code>orders.first_250_member</code> = true.
          <code>orders.discount_cents</code> = 2000. Customer pays $180. Lifetime-
          shipping ledger gets a row for this email.
        </Expected>
        <Step>
          Now go back to /catalogue, add a $300 cart, check out. Apply FIRST250.
        </Step>
        <Expected>
          Preview message: cap warning "1 redemption per email" — FIRST250 only
          applies once. No discount on this cart.
        </Expected>
        <Step>
          Open the cart drawer or re-walk checkout. Look at the free-shipping pill.
        </Step>
        <Expected>
          Pill reads "Free domestic shipping included — FIRST-250 cohort perk"
          regardless of cart size. (Once the lifetime-ledger row exists, every
          future cart from this email recognizes the perk.)
        </Expected>
      </Flow>

      <Flow
        n={4}
        title="FIRST250 cap exhausted → FOUNDER fallback"
        why="The customer-facing message when the cohort is full. Validates the in-flight cap-aware messaging."
      >
        <Step>
          From admin DB or via test orders, push the FIRST250 redemption count to
          50. (Quick way: in Supabase SQL editor:{" "}
          <code>UPDATE coupons SET max_redemptions = 0 WHERE code = 'first250'</code>{" "}
          for the test, then revert.)
        </Step>
        <Step>
          Sign in (FIRST250 needs auth). Build a cart, go to step 4, type
          FIRST250, hit Apply.
        </Step>
        <Expected>
          Preview message: "Sorry — all 250 launch-cohort orders have been placed.
          As a thank-you from the founder, use code FOUNDER for 25% off when
          you stack 3+ vials. Spend $500 → free vial; spend $1,000 → 2 free vials."
        </Expected>
        <Step>
          Type <code>FOUNDER</code> instead. Apply.
        </Step>
        <Expected>
          If cart has ≥ 3 peptide vials: "FOUNDER applied — saves $X". If ≤ 2:
          "FOUNDER applies when you stack 3 or more vials. Add a few more to your
          cart and try again."
        </Expected>
        <Step>Adjust cart to 3+ vials, re-apply, submit.</Step>
        <Expected>
          Order persists with 25% off. If subtotal ≥ $500: free vial entitlement
          on the order row. If ≥ $1000: 2 free vials.
        </Expected>
        <Step>
          Try a hostile path: sign in, add 1 vial, type FOUNDER directly into the
          checkout text field, submit (without clicking Apply).
        </Step>
        <Expected>
          Server reverses the redemption automatically. Order persists at full
          price, <code>coupon_redemptions</code> row deleted, log line warns
          "FOUNDER applied with only 1 vial(s) — reversing redemption."
        </Expected>
      </Flow>

      <Flow
        n={5}
        title="Subscription create → manage (pause / skip / resume / cancel)"
        why="Self-service subscription management. Each transition emits a confirmation email."
      >
        <Step>
          Build a cart. At checkout step 3, click "Subscribe & save". Pick a
          3-month prepay plan, monthly cadence.
        </Step>
        <Step>Continue + submit.</Step>
        <Expected>
          Order persists with prepay total = (cycle subtotal × 3 - tier discount).
          Subscription row created in <code>subscriptions</code>, status="active".
          Confirmation email + subscription-started email both arrive.
        </Expected>
        <Step>
          Sign into /account/subscription. You should see the subscription row
          with status pill, next ship date, and 4 buttons: Skip next cycle,
          Pause, Cancel.
        </Step>
        <Step>Click "Skip next cycle".</Step>
        <Expected>
          Inline confirmation: "Skipped — next shipment now [date]". Email arrives:
          "Subscription cycle skipped". Next-ship-date in DB advances by 30 days.
        </Expected>
        <Step>Click "Pause".</Step>
        <Expected>
          Status pill flips to "Paused". Email arrives: "Subscription paused".
          Resume button appears.
        </Expected>
        <Step>Click "Resume".</Step>
        <Expected>
          Status flips to "Active". Email: "Subscription resumed". Next-ship-date
          recomputed from now.
        </Expected>
        <Step>
          Click "Cancel subscription". Confirm dialog appears with optional
          reason textarea. Type a reason. Click "Confirm cancel".
        </Step>
        <Expected>
          Status flips to "Cancelled". Email arrives: "Subscription cancelled".
          <code>subscriptions.cancellation_reason</code> persisted.
        </Expected>
      </Flow>

      <Flow
        n={6}
        title="Magic-link sign-in → account dashboard → subscriptions / orders / referrals"
        why="The full researcher account experience post-launch."
      >
        <Step>
          From /login, enter your email. Submit. Check inbox for the branded
          magic-link email.
        </Step>
        <Expected>
          Email arrives with wine + gold logo, "Researcher account · Sign in"
          eyebrow, big "Sign in to your account" CTA.
        </Expected>
        <Step>Click the link.</Step>
        <Expected>
          Lands authed at /account. Hero shows order count + subscription status
          summary + last activity.
        </Expected>
        <Step>Visit /account/orders.</Step>
        <Expected>
          Every prior order from this email is listed (the auth flow back-fills
          customer_user_id on guest orders by lower-cased email match).
        </Expected>
        <Step>
          Click into one order. Status pill, item list, COA messaging,
          "Edit shipping address" button (if status is awaiting_payment).
        </Step>
        <Step>Visit /account/referrals.</Step>
        <Expected>
          Referral link auto-generated:{" "}
          <code>https://benchgradepeptides.com/r/&lt;CODE&gt;</code>. Copy
          button works. "Successful referrals" + "Free vials available" stat
          tiles.
        </Expected>
        <Step>Visit /account/security.</Step>
        <Expected>
          Marketing-email opt-out toggle persists. (Optional) password
          set/change form.
        </Expected>
      </Flow>

      <Flow
        n={7}
        title="Affiliate portal — invite → accept → sign 1099 → upload W9 → admin sees both"
        why="The affiliate onboarding. Admin-gated invite, 3-step flow, document storage."
      >
        <Step>
          (Pre-test) Manually create the <code>affiliate-w9</code> bucket in
          Supabase Storage (PRIVATE). RLS policies are already in migration 0022.
          Walkthrough: docs/AFFILIATE-PORTAL-MANUAL.md.
        </Step>
        <Step>
          Sign in to admin. Visit /admin/affiliates. Click "Generate invite".
          Add a note like "Spring 2026 cohort #1". Submit.
        </Step>
        <Expected>
          Modal shows the one-time URL with a copy button. Format:{" "}
          <code>/affiliate/invite/&lt;uuid&gt;</code>.
        </Expected>
        <Step>
          Open the invite URL in an incognito browser (different account). Sign in
          via magic link with a fresh email.
        </Step>
        <Expected>
          After auth, lands at /account/affiliate-onboarding step 1 (read agreement).
        </Expected>
        <Step>Read the agreement. Click "Continue".</Step>
        <Expected>
          Step 2: type your full legal name into the e-signature field. Submit.
        </Expected>
        <Expected>
          Step 3: PDF upload. Pick a real PDF you have on disk.
        </Expected>
        <Step>Upload the PDF.</Step>
        <Expected>
          Success state: "You're onboarded as an affiliate." Redirects to
          /account/affiliate.
        </Expected>
        <Step>
          Back in admin: visit /admin/affiliates → click into the new affiliate.
        </Step>
        <Expected>
          Detail page renders the signed agreement HTML, signed name, IP, UA,
          version. "Download W9" button generates a 5-minute signed URL on click.
        </Expected>
        <Step>
          Try a hostile path: open the same invite URL in a third browser.
        </Step>
        <Expected>
          Page shows "This invite has already been used." (Atomic{" "}
          <code>.is(consumed_at, null)</code> filter wins exactly once.)
        </Expected>
        <Step>
          Try a hostile path: while signed in as the affiliate, fetch the
          PUBLIC URL of your own W9 (not the signed URL).
        </Step>
        <Expected>
          Returns 4xx — bucket is private, RLS rejects unsigned reads.
        </Expected>
      </Flow>

      <Flow
        n={8}
        title="Admin — coupons + analytics + visitor drilldown"
        why="The launch-week monitoring view. You'll be in here several times a day."
      >
        <Step>
          Visit /admin/coupons. Verify FIRST250 + FOUNDER are listed with
          redemption counts.
        </Step>
        <Step>
          Click "Create code". Make a test coupon (e.g. "TEST20", 20% off, 1
          redemption max). Confirm it appears in the list.
        </Step>
        <Step>Visit /admin/analytics.</Step>
        <Expected>
          KPI tiles populated. 30d spark chart. 5-step conversion funnel. Top
          paths, top SKUs, country/device split. "Last 7 days" period.
        </Expected>
        <Step>Visit /admin/visitors.</Step>
        <Expected>
          Session list with outcome pills (browsed / abandoned / ordered) for
          every visitor in the last 7d. UTM source + landing path + email (if
          captured).
        </Expected>
        <Step>Click "Path →" on any session.</Step>
        <Expected>
          Per-session timeline: every event with timestamp, type pill,
          path, properties. You can reconstruct the full visitor journey.
        </Expected>
        <Step>Visit /admin/email-preview.</Step>
        <Expected>
          Sidebar lists all template names. Each renders in the iframe on click.
        </Expected>
      </Flow>

      <Flow
        n={9}
        title="Pre-launch popup → branded welcome → FIRST250 perks email"
        why="The acquisition funnel. Every signup eventually becomes an order."
      >
        <Step>
          Open homepage in fresh incognito. Append <code>?prelaunch=show</code>
          {" "}to bypass any prior dismissal.
        </Step>
        <Expected>
          Popup appears immediately. "First-250 cohort · launching this week".
          Email field. Perk list (10% off + free shipping for life, $250 → 30%,
          $500 → free vial, sub prepay tiers).
        </Expected>
        <Step>Submit a real email.</Step>
        <Expected>
          Success state: "Your cohort code is on its way — check your inbox in
          a minute." Row in <code>prelaunch_signups</code>.
        </Expected>
        <Step>Check inbox.</Step>
        <Expected>
          Branded "Welcome to Bench Grade Peptides — your launch code inside"
          email. Wine logo header, "You're on the list." headline, FIRST250 in
          big gold caps, full perk list, "Why this won't be like the rest"
          (Made in USA, 3rd-party tested, always-current COAs, QR per vial,
          video tour coming soon). Footer with company address.
        </Expected>
      </Flow>

      <Flow
        n={10}
        title="Bot-suppression check — Googlebot does NOT see promo copy"
        why="SEO compliance. The popup must never leak promo text into Google's index."
      >
        <Step>From your terminal, curl the homepage with a Googlebot UA:</Step>
        <Pre>
{`curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \\
  https://benchgradepeptides.com/ | grep -ic "First 250\\|FIRST250"`}
        </Pre>
        <Expected>Returns 0. Popup component is not mounted in SSR for bots.</Expected>
        <Step>
          Confirm the contrast: same curl with a real browser UA returns &gt; 0
          matches.
        </Step>
        <Pre>
{`curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \\
  https://benchgradepeptides.com/ | grep -ic "PrelaunchPopup"`}
        </Pre>
        <Expected>Returns ≥ 1.</Expected>
      </Flow>

      <Flow
        n={11}
        title="Sitemap + robots audit"
        why="Google needs the right surface area indexed and the wrong surface area blocked."
      >
        <Step>
          Hit <code>/sitemap.xml</code>. Confirm it includes home, catalogue,
          every category + product + stack, /research + every article, legal
          pages.
        </Step>
        <Step>
          Hit <code>/robots.txt</code>. Confirm Googlebot + AdsBot are blocked
          from <code>/admin</code>, <code>/checkout</code>, <code>/account</code>,
          <code>/affiliate</code>, <code>/cart</code>, <code>/api/</code>,
          <code>/news</code>, <code>/coa</code>.
        </Step>
        <Step>
          (Post-DNS) Submit the sitemap to Google Search Console + Bing
          Webmaster.
        </Step>
      </Flow>

      <Flow
        n={12}
        title="Sentry test event"
        why="Confirms server-side error reporting actually reaches Sentry in production."
      >
        <Step>
          With <code>SENTRY_DSN</code> set on Vercel, trigger a deliberate
          5xx (e.g. visit a route that throws — temporarily add a
          <code>throw new Error("sentry-test")</code> to a debug route).
        </Step>
        <Expected>
          Event appears in Sentry within 30 seconds with the stack trace.
        </Expected>
        <Step>Remove the deliberate throw, redeploy.</Step>
      </Flow>

      <footer className="border-t rule pt-6 space-y-3">
        <p className="text-sm text-ink-soft">
          <strong className="text-ink">If any flow fails</strong>, do not flip
          DNS. Roll back the latest deploy in Vercel (one click), file a
          ticket against the failing flow, and re-run after the fix.
        </p>
        <p className="text-sm text-ink-soft">
          <strong className="text-ink">If every flow passes</strong>, you're
          launch-ready. Walk{" "}
          <Link
            href="https://github.com/DocAck23/benchgrade-peptides/blob/main/docs/LAUNCH-CHECKLIST.md"
            className="text-gold underline"
          >
            docs/LAUNCH-CHECKLIST.md
          </Link>{" "}
          one more time, then flip DNS.
        </p>
      </footer>
    </article>
  );
}

function Flow({
  n,
  title,
  why,
  children,
}: {
  n: number;
  title: string;
  why: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border rule bg-paper">
      <header className="px-6 py-4 border-b rule bg-paper-soft">
        <div className="flex items-baseline gap-3">
          <span className="font-mono-data text-xs text-ink-muted uppercase tracking-wider">
            Flow {n.toString().padStart(2, "0")}
          </span>
          <h2 className="font-display text-xl text-ink">{title}</h2>
        </div>
        <p className="text-sm text-ink-muted mt-1 italic">{why}</p>
      </header>
      <ol className="px-6 py-4 space-y-3">{children}</ol>
    </section>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="font-mono-data text-[10px] text-ink-muted uppercase tracking-wider mt-1 w-12 shrink-0">
        Step
      </span>
      <div className="text-sm text-ink leading-relaxed flex-1">{children}</div>
    </li>
  );
}

function Expected({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="font-mono-data text-[10px] text-gold-dark uppercase tracking-wider mt-1 w-12 shrink-0">
        Expect
      </span>
      <div className="text-sm text-ink-soft leading-relaxed flex-1">
        {children}
      </div>
    </li>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <li>
      <pre className="bg-paper-soft border rule p-3 text-[11px] font-mono-data text-ink overflow-x-auto whitespace-pre-wrap">
        {children}
      </pre>
    </li>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 border-l-4 border-wine bg-paper-soft px-4 py-3 text-sm text-ink-soft">
      {children}
    </div>
  );
}
