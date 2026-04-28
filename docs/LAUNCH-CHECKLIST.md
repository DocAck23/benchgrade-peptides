# Launch Checklist — Manual steps before flipping DNS

This is the founder-facing pre-launch run. Each item has a **why** so
you can decide what to skip if launch is tonight vs. tomorrow.

Group A is **launch-blocking** — without these the site cannot serve a
real customer. Group B is **launch-day grade** — the site works
without them but they're worth doing before announcing.

---

## A. Launch-blocking

### A1. Vercel environment variables

Go to your Vercel project → Settings → Environment Variables → make
sure every row below is set for the **Production** environment.

| Variable | Required? | What it does | Notes |
|---|---|---|---|
| `ADMIN_PASSWORD` | **YES** | Cookie-hashed admin login | **Replace the dev placeholder** (`change-me-in-vercel-too`). Use a strong password manager value, ≥ 20 chars. |
| `ADMIN_NOTIFICATION_EMAIL` | YES | Where new-order alerts land | Set to the inbox you'll actually monitor (yours or a shared ops alias). |
| `ORDER_SUCCESS_TOKEN_SECRET` | YES | HMAC for the `/checkout/success` URL token | Random ≥ 32 char hex string. **Different from local dev.** |
| `NEXT_PUBLIC_SUPABASE_URL` | YES | Browser-side Supabase URL | Production Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | YES | Browser-side anon key | Public-safe, RLS-enforced. |
| `SUPABASE_SERVICE_ROLE_KEY` | YES | Server-side privileged client | **NEVER prefix with `NEXT_PUBLIC_`** — must stay server-only. |
| `NEXT_PUBLIC_SITE_URL` | YES | Used in OG tags, sitemap, email links | Set to `https://benchgradepeptides.com` (no trailing slash). |
| `RESEND_API_KEY` | YES | Sends every transactional email | Production key from Resend dashboard. |
| `RESEND_FROM_EMAIL` | YES | "From" address on all emails | Must match a verified domain in Resend (see A2). |
| `RESEND_FROM_NAME` | YES | "From" display name | `Bench Grade Peptides` |
| `WIRE_BANK` | YES (if wire enabled) | Bank name in payment-instructions email | |
| `WIRE_BANK_ADDRESS` | YES (if wire enabled) | Bank address | |
| `WIRE_ROUTING` | YES (if wire enabled) | Routing # | |
| `WIRE_ACCOUNT` | YES (if wire enabled) | Account # | |
| `WIRE_BENEFICIARY` | YES (if wire enabled) | Beneficiary name (your LLC) | |
| `WIRE_BENEFICIARY_ADDRESS` | YES (if wire enabled) | Beneficiary address | |
| `ZELLE_ID` | YES (if Zelle enabled) | Zelle email/phone | |
| `AGERECODE_ORDER_EMAIL` | YES | Where the fulfillment-handoff email goes | AgeRecode/BioSafe ops contact. |
| `AGERECODE_CC_EMAIL` | optional | CC on handoff emails | Leave unset if you don't want CC. |
| `NOWPAYMENTS_API_KEY` | YES (if crypto enabled) | NOWPayments invoice creation | |
| `NOWPAYMENTS_IPN_SECRET` | YES (if crypto enabled) | Webhook signature verification | |
| `SENTRY_DSN` | recommended | Server-side error tracking | Without it, errors land only in Vercel logs. |
| `NEXT_PUBLIC_SENTRY_DSN` | recommended | Browser-side error tracking | |
| `SENTRY_ORG` | recommended | For source-map upload at build time | |
| `SENTRY_PROJECT` | recommended | For source-map upload at build time | |

**How to verify:** in Vercel CLI, `vercel env ls --environment production`
lists everything set. Compare against the table above.

---

### A2. Resend domain verification

**Why:** if your `RESEND_FROM_EMAIL` is `admin@benchgradepeptides.com`
but Resend hasn't verified that domain, every email will either bounce
or land in spam — silently. Customers won't get order confirmations,
magic-link sign-ins won't arrive, and you won't know until someone
emails you to ask why their account doesn't work.

**Steps:**
1. Resend dashboard → Domains → Add Domain → `benchgradepeptides.com`.
2. Resend gives you 3 DNS records (DKIM x2, SPF x1, sometimes a return-path).
3. Add them in your DNS provider (wherever benchgradepeptides.com is hosted).
4. Wait 10–60 minutes for propagation.
5. Resend dashboard shows "Verified" status — green checkmark on each record.

**How to verify yourself:**
```bash
dig +short TXT benchgradepeptides.com | grep "v=spf1"
dig +short TXT resend._domainkey.benchgradepeptides.com
```
Both should return non-empty TXT records.

**Test send:** trigger one magic-link sign-in to your own personal
inbox; confirm it arrives in inbox (not spam) with the wine + gold
branded layout.

---

### A3. DNS pointing at Vercel

**Why:** the supabase magic-link templates and your OG image all
hard-link to `https://benchgradepeptides.com`. Without DNS resolving,
the logo in emails breaks and the auth-callback redirects fail.

**Steps:**
1. Vercel project → Settings → Domains → add `benchgradepeptides.com`
   and `www.benchgradepeptides.com`.
2. Vercel gives you DNS records (A + CNAME).
3. Set them in your DNS provider.
4. Wait for SSL cert to auto-provision (usually < 5 minutes).

**Verify:**
```bash
dig +short benchgradepeptides.com         # should return Vercel IPs
curl -I https://benchgradepeptides.com    # should return 200 + valid SSL
```

---

### A4. Supabase production project + storage bucket

**Why:** if you've been developing against a dev Supabase project, the
production app needs its own with all migrations applied and storage
buckets created.

**Migrations to apply (in order):**
- All of `supabase/migrations/0001` through `0021_first250_cap_to_50_and_founder.sql` (and any newer ones I add this sprint — W6 affiliate adds ~`0022_affiliate_portal.sql`).

**Storage buckets to create:**
- `affiliate-w9` (PRIVATE — created in W6 sprint). Set RLS policies per the migration file.

**Verify:** Supabase dashboard → Database → Tables — confirm every table
named in `supabase/migrations/0021_first250_cap_to_50_and_founder.sql`
exists in production. Same for any W6 additions.

---

### A5. Real end-to-end smoke order

**Why:** every config item above could be set correctly individually
and the order flow could still break (wrong webhook URL, wrong from
email, wrong storage bucket name). The smoke order is the only test
that proves the full pipeline.

**Run it:**
1. On the production deploy URL (or your final staging URL), with a
   real personal email address you control:
2. Browse `/catalogue` → add a vial → checkout → complete the 4-step
   flow → submit (use Wire as payment method, easiest to test without
   external dependencies).
3. Confirm:
   - Order lands in `/admin` orders list with correct items + total.
   - Order confirmation email lands in your real inbox with the wire
     instructions, all amounts correct.
   - Account-claim magic-link email lands; clicking it logs you in.
   - From `/admin/orders/[id]`, set status → funded. Confirm payment-
     confirmed email arrives.
   - Set status → shipped (with tracking number). Confirm shipped
     email arrives.
   - Visit `/account/orders/[id]` — see status pills + tracking link.
4. If any step fails, **diagnose before launch.**

---

## B. Launch-day grade (do these too if you have time)

### B1. ADMIN_PASSWORD strength

If your current value is < 20 chars or based on a word in any
dictionary, regenerate from a password manager. The cookie hash is
SHA-256 with timing-safe compare, but a weak password is still a weak
password.

### B2. Verify Sentry receives a test event

After A1 (Sentry env vars set), trigger a deliberate error:
- Visit `/api/health` or any debug route, throw a manual error from
  the route handler temporarily.
- Verify it lands in Sentry within 30 seconds.
- Remove the deliberate-error code, re-deploy.

### B3. Magic-link redirect-after-signin destination

Confirm the auth callback (`/auth/callback`) sends researchers to a
sensible page after sign-in (probably `/account` or back to where they
were). Test the flow end-to-end.

### B4. NOWPayments live mode (if crypto)

NOWPayments has separate sandbox + production keys. Confirm
`NOWPAYMENTS_API_KEY` is the **production** key, not sandbox. Run a
small test crypto payment if you can stomach the cost.

### B5. Cold-chain / fulfillment confirm

The fulfillment-handoff email goes to `AGERECODE_ORDER_EMAIL`. Confirm
AgeRecode/BioSafe ops actually expects the format and can act on it.
Run one test order through the handoff flow with them.

### B6. Robots / sitemap sanity check

After DNS flips:
```bash
curl https://benchgradepeptides.com/robots.txt
curl https://benchgradepeptides.com/sitemap.xml
```
- robots.txt should disallow `/admin`, `/checkout`, `/account`, `/affiliate`, `/cart`, `/api/`, `/news`, `/coa`.
- sitemap.xml should list every public route.

### B7. Submit sitemap to Google Search Console

After A3 + B6:
1. Google Search Console → add `https://benchgradepeptides.com` as a property.
2. Verify ownership (DNS TXT record method is easiest).
3. Submit `https://benchgradepeptides.com/sitemap.xml`.
4. Same for Bing Webmaster Tools.

---

## C. Post-launch monitoring (first 24h)

- **`/admin/analytics`** — watch traffic + funnel conversion. If you
  see pageviews but zero `add_to_cart`, something's broken on PDPs.
- **Sentry** — any uncaught error means real customers are hitting
  bugs.
- **Supabase logs** — any DB error in the last hour. Fix immediately.
- **Resend dashboard** — bounce rate. > 5% means deliverability
  problem (DKIM/SPF wrong, or a typo in `RESEND_FROM_EMAIL`).
- **Order count vs. coupon redemptions** — `select count(*) from
  coupon_redemptions where coupon_code = 'first250';` — when this
  hits 50, the FOUNDER fallback messaging will kick in
  automatically.

---

## D. If something breaks at launch

In rough order of "first thing to check":

1. Vercel deployment status — is the latest commit deployed?
2. Sentry — any uncaught errors in the last 5 minutes?
3. Supabase logs — RLS denials, schema errors?
4. Resend dashboard — emails sending or bouncing?
5. DNS — is benchgradepeptides.com still resolving?
6. SSL cert — did it expire?
7. NOWPayments dashboard (if crypto) — webhook receiving events?

If you can't fix in < 5 minutes, **roll back the last deploy** in
Vercel (one-click). Better to be live on yesterday's working code than
broken on today's improved code.
