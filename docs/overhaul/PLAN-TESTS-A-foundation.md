# Plan · Sub-project A — Tests (revised)

Codex Review #1 fixed the original plan-tests doc, which assumed Vitest could test computed styles, focus traps, viewport layout, and tab cycling — none of which work in this repo's `environment: "node"` Vitest. The corrected plan classifies every test into one of three buckets:

| Bucket | Runner | Environment | What it covers |
|---|---|---|---|
| **B1 — Pure unit** | Vitest | `node` (existing) | Logic, prop forwarding, render-tree shape, prop-to-className mapping |
| **B2 — DOM unit** | Vitest | `jsdom` (new) | DOM queries, ARIA attributes, keyboard event handling, focus management |
| **B3 — Browser smoke** | Playwright | real browser | Computed style, viewport layout, font swap CLS, full-screen drawer behavior, revenue-flow integration |

**Tooling additions** (each lands as part of commit 21 in the revised build sequence):

- `vitest.dom.config.ts` (new) with `environment: "jsdom"`, `setupFiles: ["./vitest.dom.setup.ts"]`
- Dev deps: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
- `npm test:dom` script alongside existing `npm test`
- `playwright.config.ts` with three projects: mobile-375, tablet-768, desktop-1280
- Dev dep: `@playwright/test`
- `npm test:smoke` script

**Mobile-first applies to test viewport choice. 375 px is primary; 1280 px is secondary.**

---

## B1 · Pure unit (Vitest, node env)

### `src/components/brand/__tests__/Logo.test.tsx`

Element tree inspection only. No DOM, no computed style.

| # | Case | Assertion |
|---|---|---|
| L1 | Default render | `<Logo />` produces an element with `src="/brand/logo-gold.png"`, `alt="Bench Grade Peptides"`, `width=180` |
| L2 | Each variant resolves to the right asset | gold→png, wine→svg with `style={{color:'#4A0E1A'}}`, red→svg with red color, cream→svg with cream color, black→svg with black color |
| L3 | Each named size | `nav→180`, `footer→280`, `hero→320` |
| L4 | Numeric size | `<Logo size={240} />` → `width=240` |
| L5 | Surface auto-pick | `<Logo surface="cream" />` (no variant) → wine variant |
| L6 | Variant beats surface | `<Logo variant="gold" surface="cream" />` → gold |
| L7 | priority prop forwarded | `<Logo priority />` produces `priority` on the underlying element |
| L8 | Aspect ratio | width / height = 1709 / 441 ± 1 px |
| L9 | Legacy size shim | `size="md"→180`, `size="lg"→280`, `size="xl"→320` |

### `src/components/ui/__tests__/Button.test.tsx`

| # | Case | Assertion |
|---|---|---|
| B1 | Variant → className | primary maps to gold-pill class set, secondary to wine-pill, tertiary to outline-wine, destructive to red-pill |
| B2 | Size → className | sm/md/lg map to size class set; default is md |
| B3 | fullWidthMobile prop forwarded | `data-fullwidth-mobile` attribute set when prop true |
| B4 | Disabled state | `disabled` attribute set, click handler not wired |
| B5 | Loading state | renders spinner, disables click |

### `src/lib/__tests__/brand.test.ts`

Snapshot lock for centralized brand metadata.

| # | Case | Assertion |
|---|---|---|
| BR1 | BRAND.name | "Bench Grade Peptides" |
| BR2 | BRAND.description starts with | "Research-grade synthetic peptides. Synthesized in Tampa" |
| BR3 | BRAND.logoMetallic | "/brand/logo-gold.png" |
| BR4 | BRAND.address.addressCountry | "US" |
| BR5 | snapshot of full BRAND object | locks the contract |

### `src/lib/__tests__/routes.test.ts`

| # | Case | Assertion |
|---|---|---|
| R1 | ROUTES.CATALOG | "/catalogue" (Foundation value; B will change this) |
| R2 | ROUTES.PRODUCT() | builder produces correct URL |
| R3 | All ROUTES are strings or string-builders | type guard |

### `src/app/__tests__/tokens.test.ts` (UPDATED)

| # | Case | Assertion |
|---|---|---|
| T1 | Palette tokens | `--color-paper`, `--color-wine`, `--color-gold`, `--color-red`, `--color-grey`, `--color-ink`, `--color-ink-muted` resolve to exact hexes |
| T2 | Semantic v2 aliases | `--link`, `--focus`, `--cta`, `--status-info` resolve correctly |
| T3 | Radius tokens | `--r-sm: 12px`, `--r-md: 16px`, `--r-lg: 24px`, `--r-pill: 999px`, `--r-input: 10px` |
| T4 | Deprecation alias | `--color-teal` resolves to `var(--link)` |
| T5 | Spacing scale | `--sp-1` through `--sp-8` |

---

## B2 · DOM unit (Vitest + jsdom + Testing Library)

These run only in the new `vitest.dom.config.ts`.

### `src/components/ui/__tests__/Overlay.dom.test.tsx`

The shared overlay primitive. Highest-leverage test surface in the whole sub-project.

| # | Case | Assertion |
|---|---|---|
| O1 | Open captures focus | `useOverlay(true, ...)` records `document.activeElement` |
| O2 | Close restores focus | When open transitions true → false, the captured element regains focus |
| O3 | Tab cycles within container | Tab from last interactive cycles to first; shift-tab from first cycles to last |
| O4 | Escape closes | keydown Escape triggers close handler when `closeOnEscape: true` |
| O5 | Escape does NOT close | when `closeOnEscape: false` |
| O6 | Scroll lock applied | when one overlay opens, body has overflow:hidden |
| O7 | Scroll lock RELEASED only when last overlay closes | open A, open B, close A → still locked. Close B → unlocked. **Ref-counted.** |
| O8 | trapFocus: false skips trap | tabbing escapes the container |

### `src/components/cart/__tests__/CartDrawer.dom.test.tsx` (UPDATED — migrated to useOverlay)

| # | Case | Assertion |
|---|---|---|
| CD1 | Drawer opens with role="dialog" | aria-modal="true", aria-labelledby points at heading |
| CD2 | Open captures focus on first close button | tab order is correct |
| CD3 | Escape closes drawer | scroll lock released |
| CD4 | Scrim click closes | scroll lock released |
| CD5 | Drawer + cart-button reentrancy | closing drawer restores focus to cart button |

### `src/components/layout/__tests__/Header.dom.test.tsx`

| # | Case | Assertion |
|---|---|---|
| H1 | Logo renders with correct asset | src ends with `logo-gold.png` |
| H2 | Hamburger has aria-label + aria-expanded | toggles correctly |
| H3 | Drawer opens on hamburger click | aria-expanded="true", drawer visible in DOM |
| H4 | Drawer dialog semantics | role="dialog", aria-modal, aria-labelledby |
| H5 | Escape closes | drawer hidden, focus restored |
| H6 | Tap-target sizes | hamburger, account avatar, cart button each report ≥ 44 × 44 in JSDOM bounding box (read from CSS class checks if computed height isn't reliable in jsdom) |

### `src/components/ui/__tests__/Modal.dom.test.tsx` (UPDATED — migrated to useOverlay)

| # | Case | Assertion |
|---|---|---|
| M1 | Modal uses useOverlay | confirms migration via behavior parity |
| M2 | Stacking with CartDrawer | open Modal over CartDrawer → both have correct focus + scroll behavior; close Modal → CartDrawer remains, scroll still locked |

### `src/components/brand/__tests__/GoldBand.dom.test.tsx`

| # | Case | Assertion |
|---|---|---|
| G1 | Eyebrow + headline render | text content visible |
| G2 | Headline only mode | eyebrow element absent |
| G3 | Monogram dividers default true | two img elements with monogram src |
| G4 | withMonogramDividers false | no monogram images |

---

## B3 · Browser smoke (Playwright)

Runs against `npm run dev` in `feat/v2-overhaul` worktree. Three viewport projects: mobile-375, tablet-768, desktop-1280.

### `e2e/foundation-visual.spec.ts`

Visual regressions across the routes Foundation touches.

| # | Case | Viewport | Assertion |
|---|---|---|---|
| V1 | `/` loads with new lockup | 375 + 1280 | logo with src `logo-gold.png` visible in nav, gold pill CTA visible |
| V2 | No horizontal scroll | 375 + 320 | `document.documentElement.scrollWidth <= clientWidth` |
| V3 | Font swap CLS | all | wait for fonts ready, measure layout shift via `PerformanceObserver` — must be ≤ 0.05 |
| V4 | LCP element | 375 | record LCP via `largest-contentful-paint` PerformanceEntry |
| V5 | All 13 public pages render 200 | 375 | parametrized: `/`, `/catalogue`, `/about`, `/faq`, `/contact`, `/shipping`, `/payments`, `/why-no-cards`, `/research`, `/coa`, `/compliance`, `/terms`, `/privacy` |

### `e2e/foundation-mobile-drawer.spec.ts`

The new mobile drawer pattern. Real browser focus + scroll behavior.

| # | Case | Viewport | Assertion |
|---|---|---|---|
| MD1 | Hamburger opens drawer | 375 | drawer visible, animation completes within 300ms |
| MD2 | Body scroll locked | 375 | scroll attempts don't move document while drawer open |
| MD3 | Tab cycles inside drawer | 375 | last tab cycles back to first |
| MD4 | Escape closes drawer | 375 | drawer hidden, body scroll restored |
| MD5 | Scrim click closes | 375 | same |
| MD6 | reduced-motion respected | 375 | with `prefers-reduced-motion: reduce`, drawer snap-opens (no slide) |
| MD7 | Safe-area padding | 375 (iPhone simulation) | computed padding-top reflects env(safe-area-inset-top) |
| MD8 | Drawer slides from LEFT | 375 | initial transform translateX(-100%), final translateX(0) |

### `e2e/foundation-revenue-flows.spec.ts`

Revenue-critical flows must not regress. Codex flagged this as missing.

| # | Case | Viewport | Assertion |
|---|---|---|---|
| RF1 | Login renders | 375 + 1280 | magic-link form visible, email input focused on first interaction |
| RF2 | Add to cart | 375 | open `/catalogue/[category]/[product]`, click "Add to cart" pill, cart drawer slides open, item visible |
| RF3 | Cart drawer opens + closes | 375 | escape closes, cart count updates |
| RF4 | Checkout entry navigable | 375 | from cart drawer, click checkout → `/checkout` renders without console errors |
| RF5 | Account dashboard renders | 375 + 1280 | logged-in fixture (auth state seeded) → account page nav + sections visible |
| RF6 | Admin login renders | 1280 | `/admin/login` form visible (don't drive past login) |

### `e2e/foundation-tap-targets.spec.ts`

Codex caught existing tap-target failures.

| # | Case | Viewport | Assertion |
|---|---|---|---|
| TT1 | Header avatar ≥ 44×44 | 375 | bounding box width and height ≥ 44 |
| TT2 | Header hamburger ≥ 44×44 | 375 | same |
| TT3 | Header cart button ≥ 44×44 | 375 | same |
| TT4 | Drawer close button ≥ 44×44 | 375 | same |
| TT5 | Primary button on mobile | 375 | width = parent width (full-width) for `variant="primary"` |

---

## Codemod safety tests

After commits 16–19 in the revised sequence:

| # | Check | Command |
|---|---|---|
| K1 | No `text-teal`, `bg-teal`, `border-teal`, `ring-teal`, `hover:bg-teal-*`, `var(--color-teal)`, `--font-cinzel`, `--font-cormorant`, `font-cinzel`, `font-cormorant` outside whitelisted deprecation references | exhaustive `rg -n "teal\\|cinzel\\|cormorant" src` audited against `docs/overhaul/codemod-whitelist.txt` |
| K2 | `docs/overhaul/teal-classification.csv` covers every teal hit | every row in the audit either matches a CSV row or is whitelisted |
| K3 | No hard-coded `#5C1A1A`, `#FAF6EC`, `#5A0E1A`, `#0F2A4A` | `rg -n "#5C1A1A\\|#FAF6EC\\|#5A0E1A\\|#0F2A4A" src` returns 0 |
| K4 | False-positive sanity | manual diff review of the codemod commit |

---

## Compliance lint (no regression)

`npm run lint:content` returns 0 violations through every commit. Foundation work doesn't add prose, but RUOBanner / footer / brand.ts touch RUO-adjacent surfaces. Verify post each commit.

---

## Build + typecheck — green at every commit

`npm run build` succeeds at every one of the 22 commits in the build sequence. CI runs the full suite. If a commit introduces warnings beyond the existing baseline, fix them in that commit; don't carry them forward.

---

## Acceptance gate

All of the following must be ✅ before user reviews the visual diff:

- [ ] All B1 + B2 vitest tests pass
- [ ] All B3 Playwright smoke tests pass at 375 + 768 + 1280
- [ ] `npm run build` succeeds
- [ ] `npm run lint:content` returns 0 violations
- [ ] Codemod safety K1–K3 return 0 hits
- [ ] Mobile audit checklist all green at 375 px AND 320 px
- [ ] LCP element measured; logo `priority` only applied if it IS the LCP
- [ ] Brand assets present: `/brand/logo-gold.png`, `/brand/logo-flat.svg`, `/brand/bg-monogram.svg`, font woff2 files, `LICENSE.txt`
- [ ] `/icon` and `/apple-icon` Next file conventions resolve

Then: **codex adversarial review #2** on the code → fix → user visual review at 375 px → merge.

---

## What this plan deliberately does NOT test

- Layout decisions (sub-project F)
- Catalog data model (sub-project B)
- Product card UX (sub-project C)
- Subscription / rewards / affiliate behavior (existing tests, not regressed)
- Deep checkout flow correctness (only checkout entry + page render — full E2E happens in sub-project H)
- Admin internals (only admin login renders — full admin testing is out of scope)
- Email rendering (template content untouched in Foundation)
