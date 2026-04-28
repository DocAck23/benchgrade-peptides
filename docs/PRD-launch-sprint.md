# PRD: Pre-Launch Sprint

**Owner:** Ahmed
**Eng:** Claude (Opus 4.7)
**Status:** Draft → awaiting sign-off
**Date:** 2026-04-27
**Target ship:** This week

---

## 1. Objective

Land the work that gates Bench Grade Peptides going live to real
researchers. Five workstreams, executed in order, each with its own
test plan + acceptance bar + codex adversarial review checkpoint.

---

## 2. Scope

### In scope (this sprint)

| ID | Workstream | Why it's blocking |
|----|----|----|
| **W1** | Launch-blocker hardening | Production env, DNS-readiness, end-to-end smoke. Without this nothing reaches a real customer. |
| **W2** | Launch-day polish (5 items) | Customer-flow gaps the founder asked to close before launch |
| **W3** | SEO optimization | Findability — every day post-launch with weak SEO is lost demand |
| **W4** | Research content (peptide journal articles) | Real citations make the catalogue findable AND defend the RUO positioning |
| **W5** | FIRST250 account-gating | Founder requirement — only authenticated researchers can claim |

### Out of scope (post-launch)

- $25 referral in-store credit ledger system
- DB-backed catalogue admin (TS file remains source of truth for v1)
- Performance budget + Lighthouse perf >= 95 (SEO target only)
- Full WCAG audit
- Live FedEx label generation (AgeRecode + BioSafe handle this manually)

---

## 3. Workstreams

### W1 — Launch-blocker hardening

**Goal:** zero "wait, the prod env doesn't have…" moments at launch.

**Tasks**
- **W1.1** Env-var audit. Walk every `process.env.*` reference; build a checklist of which Vercel project envs MUST be set. Flag every default that's still `change-me` or empty.
- **W1.2** Resend domain verification. Confirm DKIM + SPF records on `benchgradepeptides.com` resolve and `RESEND_FROM_EMAIL`'s domain shows "Verified" in Resend dashboard. Without this, every transactional email lands in spam (or bounces silently).
- **W1.3** Admin password rotation. Replace dev placeholder with a real strong password in Vercel. Verify cookie-hash login works.
- **W1.4** NOWPayments live credentials confirmed (or wire-only at launch with crypto disabled).
- **W1.5** End-to-end smoke order on the production deploy: cart → 4-step checkout → submit → admin sees row → admin marks status forward → all transactional emails arrive in a real inbox with correct content.
- **W1.6** Sentry DSN + org + project set; throw a manual error from a debug page to confirm it lands in Sentry.

**Tests**
- Bash one-liner enumerating every required env var checked against `vercel env ls --environment production`.
- DNS sanity: `dig +short benchgradepeptides.com` returns Vercel IPs; `dig +short MX benchgradepeptides.com` returns the chosen email host (or empty if outbound-only via Resend).
- Manual: place a smoke order, confirm 4 emails (order confirmation, payment-due/admin notification, account-claim magic link, eventually shipped) all land.

**Acceptance**
- Vercel env tab shows every required var with non-default value.
- DNS resolves; SSL valid; site reachable at https://benchgradepeptides.com.
- Smoke-order test produces no errors in logs OR Sentry; all 4 emails received.

---

### W2 — Launch-day polish

#### W2.1 — Explicit Subscribe-OR-OneTime choice in checkout step 3

**Problem.** Step 3 currently shows the SubscriptionUpsellCard with a single "Continue to payment" button. If a researcher doesn't engage the card, they don't realize one-time is the implicit default — they just push the same button. The UX hides the choice.

**Fix.** Replace the single continue button with two equally-weighted CTAs:
- "Subscribe & save" — opens / commits the subscription mode and advances
- "Continue with one-time order" — clears any prior subscription mode and advances

Both buttons are visible side-by-side. Selecting "Subscribe & save" without configuring the plan opens the upsell card inline.

**Tests**
- Vitest: rendering of both buttons in step 3.
- Vitest: clicking "one-time" clears `subscriptionMode`.
- Preview: walkthrough — both paths advance to step 4.

**Acceptance.** A researcher can clearly see both paths from step 3; either path advances.

---

#### W2.2 — First-time vial discount: 25% off ADDITIONAL vial

**Problem.** Today: 50% off one existing vial in cart (customer picks). User feedback: too generous + wrong incentive — discount should be on something added on TOP, not on what's already there.

**New rule.** Researcher who's a first-time buyer can add ONE extra vial of their choice; that extra vial line is 25% off retail. Existing cart untouched.

**Implementation**
- Server: `submitOrder` `first_time_vial_sku` field semantics shift — it's now the EXTRA vial appended to the order at 25% off, not a discount applied to an existing line.
- Cart math: extra line at `unit_price * 0.75`. We add 1 unit of the chosen SKU regardless of whether it's already in cart (it gets its own line at the discount).
- UI: checkout step 2 (addons) re-skin: "First-time researcher offer — pick any vial for 25% off, added to your order."
- Eligibility: `checkIsFirstTimeBuyer(email)` already exists.

**Tests**
- Vitest: discount math — pick BGP-GLP1S-5 ($110), expect extra line at $82.50.
- Vitest: server-side eligibility re-validation — non-first-time email gets no discount even if SKU passed.
- Vitest: existing cart lines never modified by the addon.
- Preview: pick first-time-vial → confirm extra line in summary.

**Acceptance.** First-time buyer adds extra vial; line shows at 75% of retail; existing cart unchanged.

---

#### W2.3 — FIRST250 $250+ tier becomes progressive

**Problem.** Currently: subtotal ≥ $250 → entire cart at 30% off. That makes a $251 order much cheaper than a $249 order — bad threshold UX.

**New rule (progressive, like income-tax brackets):**
- $0–$250 → 10% off (baseline)
- Spend above $250 → 30% off (only the portion above)

Subscription-prepay tiers (18% / 25%) still REPLACE the cart-tier discount when applicable.

**Math examples**
| Subtotal | Discount | Math |
|----------|----------|------|
| $200 | $20 | $200 × 10% |
| $250 | $25 | $250 × 10% |
| $300 | $40 | $250 × 10% + $50 × 30% |
| $500 | $100 | $250 × 10% + $250 × 30% |
| $1000 | $250 | $250 × 10% + $750 × 30% |

**Implementation**
- Refactor the FIRST250 perk block in `submitOrder` to compute progressive discount.
- Cart preview surfaces both lines: "First-250 baseline · 10% off ($250)" and "First-250 tier 2 · 30% off ($50 above $250)".

**Tests**
- Vitest: boundary table above ($199, $200, $250, $251, $500, $1000) — exact discount cents per case.
- Vitest: subscription-prepay 3-month → 18% override (not 30%); 6-month → 25% override.

**Acceptance.** Math matches the boundary table; subscription overrides still work.

---

#### W2.4 — Cart-drawer free-shipping pill for lifetime members

**Problem.** A FIRST250 cohort member with a $50 cart sees "$150 away from free shipping" — but their lifetime perk says shipping's already free. Optical inconsistency that erodes trust.

**Fix.** Cart drawer detects whether the current researcher (signed-in OR cookie-correlated) is in `lifetime_free_shipping` and replaces the threshold pill with "Free shipping included — FIRST-250 cohort perk."

**Implementation**
- New cookie-scoped server action `getLifetimeShippingForMe()` returning `{ eligible: boolean }`.
- Cart drawer (client) calls it on hydration; caches in memory until session ends.
- `<FreeShippingBar>` accepts a `lifetimeOverride: boolean` prop; flips text + bar when true.

**Tests**
- Vitest: `<FreeShippingBar>` renders the override copy when `lifetimeOverride={true}`.
- Manual: log in as a FIRST250 member, see the cart pill flip.

**Acceptance.** Lifetime member with cart < $200 still sees free-shipping pill (not threshold).

---

#### W2.6 — Catalogue card description cutoff (founder spotted)

**Problem.** Product descriptions in the catalogue grid are being cut off mid-word. The card's description area is `h-8` (32px) but `text-xs` (12px) at `leading-relaxed` (1.625) renders each line at ~19.5px — two lines need ~39px, so the second line gets visually clipped without a proper ellipsis, AND many descriptions read mid-sentence. Title is `line-clamp-1` + `h-7`, also truncating long compound names ("Melanotan-2…", "Oxytocin…").

**Fix.** In `<ProductCard>` (and the same shape inside `<ProductCarouselCard>`):
- Title row: allow up to 2 lines (`line-clamp-2`), increase reserved height to fit 2 lines of the `sm:text-lg` size.
- Description row: bump to `line-clamp-3`, use `leading-snug` (1.375) instead of `leading-relaxed`, set fixed height to fit 3 lines of `text-xs` cleanly.
- Keep all cards uniform-height by adjusting the new fixed totals across the grid.

**Tests**
- Vitest: card renders with a long description and shows 3 lines, ends with the natural Tailwind line-clamp ellipsis (no mid-word visual clip).
- Manual: catalogue grid at 1440 width — every card same height; descriptions readable.

**Acceptance.** No card description is visually clipped mid-line; long names wrap to 2 lines instead of getting `…` truncated; cards remain uniform height.

---

#### W2.5 — Customer-backend verification end-to-end

**Goal.** No "the customer page is broken" moment at launch. Walk the journey.

**Test script (manual + automated)**
1. Open homepage → see PrelaunchPopup → close it.
2. Click "Sign in" → enter email → receive magic-link email → click → land signed in at /account.
3. Visit catalogue → add to cart → 4-step checkout → submit.
4. Receive order confirmation email → click account-claim magic-link → land at /account/orders.
5. Visit order detail → status pill correct → ship address editable.
6. Visit /account/subscription → pause / resume / cancel / skip — confirm each works + confirmation email arrives.
7. Visit /account/referrals → confirm referral link auto-generated.
8. Visit /account/security → confirm marketing prefs editable.
9. Sign out; sign back in via magic link; confirm session restores cleanly.

**Tests**
- Vitest snapshots remain green.
- Playwright happy-path E2E (one test, all 9 steps stitched).

**Acceptance.** Every step succeeds with no console errors, no 5xx, no broken UI.

---

### W3 — SEO optimization

**Goal.** Lighthouse SEO ≥ 95 on home, catalogue, sample PDP, sample research article. Real findability for keywords like "research peptides USA," "peptide certificate of analysis," "BPC-157 research-grade," etc.

**Tasks**
- **W3.1** Meta-title + description audit. Every public page has a unique, keyword-targeted, ≤160-char description.
- **W3.2** Structured data audit. Verify `Product` schema on PDPs, `Organization` on root layout, `BreadcrumbList` on category/product, `FAQPage` on /faq, `Article` on each research article.
- **W3.3** Open Graph + Twitter card per page (currently uniform — should be per-page).
- **W3.4** Sitemap confirms every public URL (catalogue, PDPs, stacks, research articles, blog stubs, legal pages).
- **W3.5** Internal linking. Every PDP cross-links to research articles for that compound; every research article links back to the related PDP(s).
- **W3.6** Image alt text on every `<img>` / `<Image>`; flagged in lint.
- **W3.7** robots.txt + nosnippet/noimageindex on PDPs preserved (already done).
- **W3.8** Canonical URLs set on every public page.

**Tests**
- Playwright: assert `<meta name="description">`, `<title>`, structured-data JSON-LD presence on home, catalogue, one PDP, one research article.
- Lighthouse run on each of the 4 pages.

**Acceptance**
- Lighthouse SEO ≥ 95 on the four sentinel pages.
- Every PDP has unique title + description.
- Sitemap contains every public route.

---

### W4 — Research content

**Goal.** Real, citable peptide research articles in /research, structured for findability. Researchers respect citations; SEO loves them.

**Updated targets (founder revision):** minimum **7** articles per class, **10 optimal**. When the class includes animal studies, allocate **1–2 specifically to pet / companion-animal contexts** (canine / feline / equine veterinary research) — distinct from rodent-model preclinical work.

| Compound class | Min / Opt | Pet-animal allocation |
|---|---|---|
| GLP-1 family (sema, tirz, reta, cagri, mazdu, survodu) | 7 / 10 | 1–2 canine/feline metabolic |
| BPC-157 + TB-500 | 7 / 10 | 1–2 canine tendon / equine wound |
| GH secretagogues (CJC, ipamorelin, sermorelin, tesamorelin, GHRP-2/6, hexarelin, MGF, IGF-1 LR3) | 7 / 10 | 1–2 canine GH-axis if literature exists |
| Tissue repair (KPV, MOTS-c, beyond BPC/TB) | 7 / 10 | 1–2 equine/canine wound-closure |
| Neuropeptides (cerebrolysin, semax, selank, dihexa) | 7 / 10 | 1–2 canine cognitive ageing |
| Longevity (epitalon, GHK-Cu) | 7 / 10 | 1–2 companion-animal lifespan |
| Sexual wellness (PT-141, kisspeptin) | 7 / 10 | — |
| Immune (thymosin alpha-1, LL-37) | 7 / 10 | 1–2 canine/feline immune |

**Total target: 56–80 real, citable articles.**

**UI pattern (founder revision):** match the catalogue-browser sidebar treatment.
- Left sidebar: search box + compound-class checkboxes.
- Right column: filtered article cards in a uniform-height grid (3-up on lg+, 2-up on sm, 1-up on mobile).
- Card: title, compound-class badge(s), journal · year, 2-line summary, "Read citation →" link.
- Pure client-side cosmetic filtering, same pattern as `<CatalogueBrowser>`.

**Sourcing**
- Use web search to surface real PubMed / Google Scholar entries.
- Each article record: `{ title, authors, journal, year, pmid, doi, url, summary (≤300 chars, RUO-compliant), related_compound_slugs }`.
- Summaries pass `complianceLint` (no therapeutic claims, no first-person, etc.).

**Implementation**
- New file `src/lib/research/articles.ts` — typed array of `ResearchArticle` records. Source of truth.
- New /research page renders a filterable grid (by compound class + free-text search).
- Each PDP gets a "Research literature" section listing related articles (links to /research/[slug]).
- Each article gets `/research/[slug]` page with full citation, abstract excerpt, and "Compounds referenced" linking to PDPs.

**Tests**
- Vitest: snapshot of /research filter behavior.
- Vitest: every article passes `complianceLint`.
- Vitest: every related_compound_slug resolves to a real `PRODUCTS` row.
- Manual: every external link returns HTTP 200 (script).

**Acceptance**
- ≥40 real, citable articles in the catalog.
- Every catalog compound with research literature links to ≥1 article.
- Every external citation link resolves.
- All summaries pass lint.

---

### W6 — Affiliate portal

**Goal.** Founder-only invite flow → researcher signs up as affiliate → executes 1099 agreement + uploads W9 → both docs visible read-only to founder + affiliate.

**Roles + boundaries**
- **Admin (founder):** generates one-time-use invite links; views every affiliate's signed agreement + W9; cannot edit signed/uploaded docs.
- **Invitee:** clicks link, creates Supabase auth user (or signs into existing), becomes affiliate, signs the 1099 agreement (typed-name e-signature with timestamp + IP), uploads a W9 PDF.
- **Affiliate:** views own signed 1099 + uploaded W9 read-only after submission.

**Schema (`supabase/migrations/00xx_affiliate_portal.sql`)**

```sql
-- One-time invite tokens. Admin generates; consumed on first sign-up
-- via the invite link.
CREATE TABLE public.affiliate_invites (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_admin BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,                          -- nullable: open invites
  consumed_at TIMESTAMPTZ,
  consumed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT                                        -- internal label e.g. "Spring 2026 cohort"
);

-- 1099 agreement signature ledger. One row per affiliate per signed
-- version. Append-only — re-signing creates a NEW row; the historical
-- one stays as evidence.
CREATE TABLE public.affiliate_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreement_version TEXT NOT NULL,                  -- e.g. "1099-v1-2026-04-27"
  signed_name TEXT NOT NULL,                        -- typed e-signature
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT,
  agreement_html TEXT NOT NULL                      -- full text snapshot at sign time
);

-- W9 uploads. PDF lands in Supabase Storage (private bucket
-- "affiliate-w9"); this row tracks the storage path + upload metadata.
CREATE TABLE public.affiliate_w9 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,                       -- "affiliate-w9/<userid>/<uuid>.pdf"
  original_filename TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT,
  byte_size INT NOT NULL,
  superseded_at TIMESTAMPTZ                         -- set when a newer W9 replaces this one
);

CREATE INDEX affiliate_invites_consumed_idx ON public.affiliate_invites (consumed_at);
CREATE INDEX affiliate_agreements_user_idx ON public.affiliate_agreements (affiliate_user_id, signed_at DESC);
CREATE INDEX affiliate_w9_user_idx ON public.affiliate_w9 (affiliate_user_id, uploaded_at DESC);
```

**Storage**
- New private Supabase Storage bucket `affiliate-w9`.
- Upload path: `affiliate-w9/<auth.uid>/<uuid>.pdf`. RLS policy: only auth.uid owner can SELECT/INSERT for their own folder; service-role (admin) can SELECT all.
- File constraints: PDF only, ≤ 5 MB, validated server-side.

**Server actions (`src/app/actions/affiliate-portal.ts`)**
- `generateAffiliateInvite({ note?, expiresInDays? })` — admin only. Returns `{ token, url }`.
- `consumeAffiliateInvite(token)` — invitee, after auth. Marks invite consumed + creates affiliate row.
- `signAffiliateAgreement({ signed_name })` — captures snapshot HTML + name + IP + UA.
- `uploadAffiliateW9(formData)` — accepts multipart PDF, validates, uploads to Storage, inserts ledger row.
- `getMyAffiliateOnboarding()` — affiliate-scope read of own status (invite consumed?, agreement signed?, W9 uploaded?).
- `listAffiliatesAdmin()` + `getAffiliateDetailAdmin(userId)` — admin-only list + detail with signed agreement HTML + W9 download URL.
- `getAffiliateW9SignedUrlAdmin(userId)` + `getAffiliateW9SignedUrlForMe()` — short-lived (5 min) signed URL into Storage.

**UI**
- `/admin/affiliates` — table of all affiliates with status pills (invite/signed/W9). "Generate invite" button opens dialog → outputs one-time URL with copy button.
- `/admin/affiliates/[userId]` — detail page: signed-agreement HTML rendered read-only + W9 download button.
- `/affiliate/invite/[token]` — invitee landing. If valid + not consumed: prompts for sign-in (magic link). After auth: marks invite consumed, redirects to `/account/affiliate-onboarding`.
- `/account/affiliate-onboarding` — three steps: (1) read agreement, (2) type full legal name to sign, (3) upload W9. Each step gated by the prior.
- `/account/affiliate` (existing) — once onboarded, the existing affiliate dashboard. Add a "Documents" tab showing the read-only signed 1099 + W9.

**Tests**
- Vitest: `generateAffiliateInvite` requires admin auth.
- Vitest: `consumeAffiliateInvite` rejects expired / already-consumed tokens (concurrency-safe via `.is("consumed_at", null)`).
- Vitest: `signAffiliateAgreement` writes snapshot HTML + name + ip + UA.
- Vitest: `uploadAffiliateW9` rejects non-PDF, files > 5MB, missing auth.
- Vitest: signed-URL generation is admin-OR-owner only; cross-user attempts denied.
- Manual: full happy path — admin generates link → opens in different browser/incognito → signs in → signs agreement → uploads W9 → admin sees both in detail page.

**Acceptance**
- Admin can generate one-time invite link; consumed link returns "already used" on second visit.
- Invitee can complete the 3-step onboarding without errors.
- Both admin AND affiliate see signed 1099 + W9 read-only after submission.
- W9 file is NOT publicly accessible (storage RLS verified by attempting public-URL fetch).

---

### W5 — FIRST250 account-gating

**Goal.** Researcher must have authenticated (Supabase user) to claim FIRST250.

**Implementation**
- `coupon-preview`: when `code === 'first250'` AND no `customer_user_id` resolvable from the cookie-scoped client, return a special status: `auth_required` with message: *"Create a free Bench Grade Peptides account to claim your FIRST-250 cohort perks. We'll save your cart and bring you back here."*
- `submitOrder`: when `code === 'first250'` AND order has no `customer_user_id`, deny redemption (don't call `redeem_coupon` RPC).
- Checkout step 4 UI: when preview returns `auth_required`, show inline CTA "Create my account" → opens magic-link flow without losing cart (cart in localStorage, returns to /checkout).
- Magic-link callback already redirects sensibly; verify cart restoration.

**Tests**
- Vitest: `previewCouponForCheckout` with `code: 'first250'` and no auth → returns `auth_required`.
- Vitest: `submitOrder` with `coupon_code: 'first250'` and no `customer_user_id` → coupon doesn't apply, order proceeds at full price.
- Manual: anon user types FIRST250 → sees CTA → completes magic-link → cart restored → FIRST250 applies.

**Acceptance**
- Anon FIRST250 attempt → friendly rejection with clear sign-up CTA.
- Auth FIRST250 attempt → applies normally.
- Cart survives the magic-link round-trip.

---

## 4. Execution order

```
1. W1     ─ env audit + Resend domain check + smoke order        (~1.5h)
2. W2.1   ─ Subscribe / one-time choice                          (~30m)
3. W2.2   ─ First-time vial = 25% off ADDITIONAL                 (~1h)
4. W2.3   ─ FIRST250 progressive tier                            (~1h)
5. W5     ─ FIRST250 account gate                                (~1h)
6. W2.4   ─ Cart pill for lifetime members                       (~30m)
7. W4     ─ Research content (sourcing + wiring)                 (~4h)
8. W3     ─ SEO sweep                                            (~2h)
9. W2.5   ─ Customer-backend walkthrough                         (~30m)
10. tsc + tests + Codex adversarial review                       (~1h)
11. Fix codex findings; re-run                                   (~1h)
12. Single push to main                                          (~5m)
```

Total estimate: **~14 hours of focused work.**

---

## 5. Codex adversarial review checkpoints

**Checkpoint A — after step 5 (W5 lands):**
Focus: coupon math edge cases, account-gate bypass paths, discount stacking with new progressive tier, first-time-vial extra-line collision.

**Checkpoint B — after step 7 (W4 lands):**
Focus: XSS in research article rendering, citation link validation, schema injection in JSON-LD, off-by-one in compliance lint.

**Checkpoint C — after step 9 (everything):**
Focus: auth boundaries (FIRST250 gate), session cookie handling, cart restoration after magic link, SSR data leaks, secret exposure.

After each checkpoint: fix HIGH severity findings IN that batch before moving on. MED can defer to the final fix pass.

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Resend DNS verification can take hours to propagate | Do W1 step 2 FIRST, in parallel with everything else |
| Hallucinated PubMed citations | Every citation goes through web search; each external link tested for HTTP 200 before commit |
| FIRST250 account gate hurts conversion | Inline CTA with magic-link flow + cart preservation makes signup low-friction; we measure via analytics post-launch |
| Progressive tier math wrong → over-discount | Boundary-case vitest table is authoritative; codex review specifically focuses on this |
| Customer-backend bug discovered at launch | W2.5 walkthrough is the dress rehearsal before DNS flip |

---

## 7. Open questions

1. **First-time vial extra:** which SKUs are eligible? All catalog, or just the lowest-tier vial of each compound? (Default: any catalog peptide vial; supplies excluded.)
2. **Research article ordering:** by compound, by category, or by date? (Default: filterable; landing view sorted by compound popularity.)
3. **FIRST250 account gate UX:** should the magic-link bring them BACK to checkout step 4 with FIRST250 pre-typed, or to /account so they can take a victory lap first? (Default: back to checkout; faster path to conversion.)

If you don't answer these, I use the defaults.

---

## 8. Deliverables

- All code committed in a single launch-sprint branch (or main if you prefer).
- Updated `supabase/migrations/00xx_*.sql` for any schema changes.
- This PRD updated with checkmarks as workstreams land.
- One end-to-end test report at the end (tsc, vitest count, codex result).
- Final note flagging anything that DIDN'T land vs. what shipped.
