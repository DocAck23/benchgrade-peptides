# PRD — Analytics Expansion (admin visibility into traffic, conversion, abandonment)

**Status:** Draft → Approved 2026-04-28.
**Owner:** Founder
**Source:** Founder request 2026-04-28 — "I need to see unique visitors over time, how often IPs revisit, first-time-vs-returning conversion, page abandonment, and most-searched products. Eventually ad attribution."

---

## 1. Problem

The existing analytics layer (sessions + events + UTM + funnel) tracks *what* happens but not *who keeps coming back*. The founder needs visibility into:

- **Unique visitors** over rolling time windows (1h / 24h / 7d / 30d). The current `analytics_sessions` table answers "how many sessions" but a single visitor making three returns inside a week shows up as three rows. The founder needs distinct-visitor counts.
- **Revisit cadence** — how often the same human comes back. Sessions only persist 30 days as cookies, so a returning visitor after 31 days appears as a brand-new session. The existing system can't see them as the same person.
- **Conversion split** — first-time visitors vs. returning visitors and their order rates. The current funnel doesn't differentiate.
- **Page abandonment** — what's the LAST page someone saw before leaving without buying? Sessions store `landing_path` only.
- **Search demand** — which products do customers search for the most? The catalogue search filter is purely client-side; nothing reaches the server.
- **Ad attribution (forward-looking)** — when ads launch, the founder needs to see which ad-clicks turn into orders. UTM params are captured but `gclid` (Google Ads) and `fbclid` (Meta) are not.

## 2. Goals

- Distinct-visitor counts over 1h / 24h / 7d / 30d
- Revisit-count distribution (1, 2, 3, 4+ visits in last 30 days)
- First-visit conversion rate (% of fresh visitors who place an order in their first session)
- Returning-visit conversion rate (% of repeat visitors who place an order on any return)
- Last page seen for every abandoning visitor (top abandonment paths)
- Top product searches (term + count over time window)
- Foundation for ad attribution: capture `gclid`, `fbclid`, `utm_id`

## 3. Privacy posture

Storing raw IP addresses creates a GDPR/CCPA-relevant PII surface. We avoid it by storing a **one-way salted hash** of the IP — call this the `visitor_fingerprint_hash`. With it we can:
- Count distinct visitors (count distinct hashes)
- Track revisit cadence (count rows per hash)
- Differentiate first-time vs. returning (does the hash exist before this session?)

We cannot reverse the hash to recover the raw IP. The salt lives in `ANALYTICS_FINGERPRINT_SALT` env var. If that secret ever rotates, prior fingerprints become un-correlatable to new ones — by design, this acts as a periodic data-retention reset.

A best-effort hash isn't bulletproof — VPNs, mobile carriers (CGNAT), and shared workspaces all break the "one IP = one visitor" assumption. The founder accepts this caveat in exchange for any visibility at all. We surface the metric as "estimated unique visitors" everywhere it's displayed.

## 4. Spec

### 4.1 Schema additions

**New table `visitor_fingerprints`:**
- `fingerprint_hash` (text, primary key) — SHA-256(salt + IP + user_agent_class)
- `first_seen_at` (timestamptz)
- `last_seen_at` (timestamptz)
- `session_count` (int, default 1) — cumulative number of distinct `analytics_sessions` rows tied to this fingerprint
- `event_count` (int, default 0) — cumulative number of analytics_events from this fingerprint
- `ordered_at` (timestamptz, nullable) — first time this fingerprint placed a funded order; lets us compute "first session that ordered" cohort

UA-class is included in the hash so a visitor switching from desktop to mobile fingerprints differently — corner-case noise but correct semantically (different devices = different visitors most of the time).

**`analytics_sessions` columns added:**
- `fingerprint_hash` (text, nullable, FK to visitor_fingerprints)
- `last_path` (text, nullable) — updated on every pageview event so we always know the last page the visitor saw
- `is_first_visit` (boolean, nullable) — set at session creation: true iff the fingerprint had zero prior sessions
- `gclid` (text, nullable) — Google Ads click ID, frozen at session start like UTM
- `fbclid` (text, nullable) — Meta click ID
- `utm_id` (text, nullable) — generic ad campaign id (some platforms use this)

**`analytics_events` constraint expansion:**
- Add `product_search` to the allowed event_name list (catalogue search query emission)

**No raw IPs persisted.** The route hashes inline and writes only the hash.

### 4.2 Route changes (`/api/analytics`)

1. Compute `fingerprint_hash` from request IP + user-agent class + env salt.
2. Upsert `visitor_fingerprints` row: increment `event_count`. On insert, set `first_seen_at = now()`. Always update `last_seen_at = now()`.
3. On `isNewSession`: count prior sessions for this fingerprint. Mark `is_first_visit` accordingly. Increment `session_count` on the fingerprint row.
4. Capture `gclid`, `fbclid`, `utm_id` from `init` payload alongside existing UTM fields.
5. On every pageview event: update `analytics_sessions.last_path = path`.
6. On `order_submitted`: also set `visitor_fingerprints.ordered_at` (only if currently null).

### 4.3 Client emission additions

- New event: `product_search` from `CatalogueBrowser`. Debounced 600 ms after the user pauses typing. Properties: `{ term, results_count }`. Empty queries don't emit.
- Init payload extended to include `gclid`, `fbclid`, `utm_id` from the URL query string at first pageview.

### 4.4 Admin dashboard surfaces

A new `/admin/analytics` page (or a section on the existing one) that shows:

**Visitor Counts**
- Distinct visitors in last 1h / 24h / 7d / 30d (count of distinct fingerprints with any activity in window)

**Revisit Distribution**
- Histogram: visitors with 1 visit, 2 visits, 3 visits, 4+ visits in last 30d

**First-vs-Returning Conversion**
- First-visit visitors who ordered / total first-visit visitors (last 30d)
- Returning visitors who ordered (any session) / total returning visitors (last 30d)

**Abandonment**
- Top last_path values among sessions that had pageviews but no order_submitted (last 30d)

**Top Searches**
- Top 20 search terms by count (last 30d)

**Ad Attribution** (forward-looking, empty until ads run)
- Top gclids / fbclids / utm_ids by session count and order count

Window selector at top of page (1d / 7d / 30d / 90d) drives all sections except the visitor-count tile which always shows all four windows.

### 4.5 Out of scope

- Raw IP storage (deliberately avoided — privacy)
- Cross-device identity stitching (would require login-based identity unification; not needed for launch)
- Real-time dashboards (nightly aggregation is enough — admin checks the dashboard manually)
- A/B test cohort segmentation
- Per-product page-views breakdown by visitor (already partially in the funnel page)

## 5. Test plan

- IP hashing is consistent: same IP + UA-class + salt → same hash.
- Fingerprint upsert: first event creates the row; second event increments `event_count` and updates `last_seen_at` only.
- `is_first_visit` flips correctly when a fingerprint reuses the cookie or visits from a fresh browser later.
- `last_path` on session updates on every pageview event.
- `product_search` event validation: term length cap, results_count is a number, debounce in client doesn't double-emit.
- Admin queries don't N+1: each section queries once with appropriate aggregation.
- RLS: `visitor_fingerprints` and the new columns are admin-read-only (no customer access).

## 6. Codex adversarial focus

- Hash collisions / privacy: is SHA-256 + salt enough? IP + UA-class is a low-entropy input — would 30k sessions produce false collisions?
- Salt rotation: if `ANALYTICS_FINGERPRINT_SALT` is missing or rotates mid-deploy, what happens to existing fingerprints?
- Race in `visitor_fingerprints` upsert + session_count increment under concurrent first-event traffic.
- Search term sanitization: free-form text → DB → admin display. XSS in admin renders if not escaped.
- Search emission on every keystroke: even debounced, a user typing "abc" → "abcd" → "abcde" emits three events. Quota on the rate limiter?
- Ad-id capture: `gclid`/`fbclid` are arbitrary strings; cap length and reject suspicious patterns.

## 7. Build sprints

This ships as a single sprint (call it **A1**) — it's smaller than a G-sprint but follows the same plan→test→codex flow.

A1 deliverables:
1. Migration `0028_analytics_visitors.sql`
2. Route update in `/api/analytics`
3. `product_search` emission in `CatalogueBrowser`
4. Admin `/admin/analytics` page sections
5. Unit tests + integration tests
6. Codex adversarial review + fix findings
7. Apply migration to live + push

## 8. Definition of Done

- [ ] Migration applied to live Supabase
- [ ] `ANALYTICS_FINGERPRINT_SALT` env var set on Vercel (founder-owned secret, never logged)
- [ ] All five admin sections render with real data on /admin/analytics
- [ ] Test suite green (existing 572 + new analytics-specific tests)
- [ ] Codex review passed
- [ ] Founder verifies the unique-visitor count looks roughly right against Vercel's own analytics
