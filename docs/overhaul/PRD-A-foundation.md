# PRD · Sub-project A — Foundation

**Owner:** Bench Grade v2 overhaul
**Branch:** `feat/v2-overhaul` (integration). Foundation work lands directly here as the upstream layer; no sub-feature branch needed because B–K all depend on this.
**Worktree:** `/Users/ahmed/benchgrade-v2`. Production untouched on `main`.
**Approach (locked):** Approach 2 — design tokens + global primitives swap. The site visually shifts to the new identity in one PR. Layout/IA stays as-is (that's sub-project F's job).
**Codex Review #1 incorporated:** see `CODEX-REVIEW-1-FINDINGS.md` for the audit and fix plan. All CRITICAL + HIGH findings are reflected in this revised PRD; MEDIUM + LOW addressed in implementation.

> **Light-only by design.** No dark-mode strategy. `globals.css` keeps `color-scheme: light` and Foundation does not introduce dark-mode media queries. Future dark-mode is explicitly deferred and out of scope for the entire v2 overhaul.

> **Foundation-gate rule.** No parallel sub-project branches (B–K) cut off `feat/v2-overhaul` until Foundation lands on `main`. This prevents downstream branches inheriting unstable token aliases mid-codemod and exploding on rebase.

---

## 0a. Pre-foundation — measure current LCP

Codex Review #1 caught that "preload the logo" presumes the logo IS the LCP. It usually isn't. Before commit 1 of the build sequence:

1. Open `npm run dev` against current `main` (production state).
2. In Chrome DevTools → Performance → record a page load on `/` at 375 px viewport.
3. Find the LCP entry. Note the element (most likely the hero headline or hero image, NOT the logo).
4. Document the finding at `docs/overhaul/LCP-MEASUREMENT.md`.
5. Apply `priority` / preload to **that** element in Foundation, not to the logo by default.

If the logo turns out to be the LCP (unlikely given it's only ~180px wide and below the RUO banner), then the original plan stands. Otherwise, the logo gets standard image loading, and the actual LCP element gets the priority hint.

---

## 0. First principle — mobile-first, every line

> **Most Bench Grade sales come from mobile.** Every component, page, and PRD section in this overhaul is designed at **375 px viewport first.** Desktop is the derivative, never the source. If a decision can't survive at 375 px, it doesn't ship — period. Repeated explicitly so it's impossible to skim past:
>
> 1. Mockups review **at 375 px first**, then validated at 768 / 1024 / 1280.
> 2. Tap targets ≥ **44 × 44 px**.
> 3. Buttons default to **full-width** below 768 px; constrained-width above.
> 4. Type scale picks the **mobile size first**, then steps up at breakpoints.
> 5. Padding tokens picks the **mobile value first**.

Source: `feedback_mobile_first.md` in memory.

---

## 1. Goal

Land every locked Foundation decision (Q1–Q6 from the brainstorm) into the codebase, so:

- The whole site visually reads in the v2 brand the moment this PR lands — palette, typography, lockup, favicon, radius, surface language.
- Every downstream sub-project (B–K) can pull design tokens and primitives without redoing brand decisions.
- No regressions on existing functionality (cart, checkout, account, admin).

This is **not** a layout overhaul. Existing routes, IA, page copy, product data, and information architecture stay exactly where they are. Sub-project F handles the homepage layout. Sub-project C handles the catalog UI. The Foundation PR only changes how every existing surface *looks*, not what it shows.

---

## 2. Non-goals

Explicitly **out of scope** for sub-project A:

- Catalog data shape / category structure (sub-project B)
- Catalog UI / product cards (sub-project C)
- Product detail page layout (sub-project D)
- Stack picker / Build-Your-Stack rework (sub-project E)
- Homepage layout / carousel removal (sub-project F)
- Cart drawer animation / add-to-cart UX (sub-project G)
- Checkout UI revamp (sub-project H)
- Founder-letter content / tone (sub-project I)
- Vial photography (sub-project J)
- Vial label SVGs (sub-project K)
- New copy / brand voice rewrites (already done; lives in repo)

The PR **only** touches: tokens, fonts, logo / monogram assets, the brand `Logo` component, global layout primitives (`Header`, `Footer`, `RUOBanner`), shared UI primitives (`Button`, `Callout`, `Breadcrumb`, `DataRow`), and the new `GoldBand` anchor component.

---

## 3. Locked decisions (recap from brainstorm)

| Decision | Value |
|---|---|
| Pinyon Script usage | logo asset only — **never load as a webfont** |
| Display + body type | Glacial Indifference (self-hosted) |
| Sub-display / UI / labels | Montserrat (200 / 500 / 700 weights from Google Fonts) |
| Mono / data | JetBrains Mono |
| `--c-red` | `#711911` |
| `--c-wine` | `#4A0E1A` |
| `--c-gold` | `#B89254` |
| `--c-cream` | `#FDFAF1` |
| `--c-black` | `#000000` |
| `--c-grey` | `#DFDFDF` |
| `--c-ink` | `#1A1A1A` |
| `--c-ink-muted` | `#5A5A5A` |
| `--r-sm` / `--r-md` / `--r-lg` | `12px` / `16px` / `24px` |
| `--r-pill` | `999px` (constant for CTAs regardless of scale) |
| `--r-input` | `10px` (NEW after Codex Review #1; smaller than card radius so dense forms don't waste horizontal space and small text doesn't clip) |
| Default page surface | `--c-cream` |
| Primary CTA | gold pill, full-width on mobile |
| Headlines on cream | `--c-wine` |
| Body on cream | `--c-ink` |
| Muted on cream | `--c-ink-muted` |
| Gold-on-cream label weight | **700** (bumped from default 500) |
| Lockup display sizes | 180 / 280 / 320 px (nav / footer / hero) |
| Logo variants | gold (metallic) · wine · red · cream · black — all transparent |
| BG monogram on web | favicon + footer crest only |
| Favicon colorway | gold mark on wine field |
| Surface language | cream throughout + one optional gold band per page |
| Border-radius scale | Medium (flagged for revisit if too sharp) |

---

## 4. Design sections (build phases inside this PR)

Each section ships as its own commit on `feat/v2-overhaul`. Order matters; later sections depend on earlier ones.

### Section 4.1 — Logo + monogram + favicon assets

Place the brand assets under `public/brand/` so they're served from the CDN, not bundled.

**Files added:**
- `public/brand/logo-gold.png` (primary, metallic transparent — 1709×441)
- `public/brand/logo-wine.png` (alpha-tinted)
- `public/brand/logo-red.png`
- `public/brand/logo-cream.png`
- `public/brand/logo-black.png`
- `public/brand/bg-monogram.png` (transparent BG monogram, wine fill)
- `public/brand/favicon-512.png` (gold mark on wine, 512×512, rounded for iOS)
- `public/brand/favicon-180.png` (Apple touch icon)
- `public/brand/favicon-32.png`, `public/brand/favicon-16.png`

Source for the chroma-keyed transparent variants: the script at `scripts/extract-logo-variants.py` (also added in this section). Keep the script in-repo so future regeneration from a true-vector source is one command away.

**Acceptance:**
- `curl /brand/logo-gold.png` → 200, image
- All five wordmark variants load
- Favicon resolves at all four sizes
- File size budget: each PNG ≤ 200 KB

### Section 4.2 — Design tokens layer

**Migration strategy (revised after Codex Review #1): semantic v2 aliases, classified codemod, then deprecation.**

Codex correctly flagged that `--color-teal` carries real semantics — it appears as link color, focus rings, info badges, and "ready/confirmed" status across 47+ files. Blindly remapping it to `--color-gold` would compile cleanly while changing meaning silently — a rebase trap.

The corrected approach:

1. **Add semantic v2 aliases** as an additive layer (the `--color-X` palette tokens stay):
   - `--link: var(--color-gold)` · for hyperlink color
   - `--link-hover: var(--color-gold-dark)` · for hover state
   - `--focus: var(--color-gold)` · for focus rings
   - `--cta: var(--color-gold)` · for primary buttons
   - `--status-info: var(--color-wine)` · for info badges, "ready" pills
   - `--status-success: existing green token if present, else add` · for success
2. **Classify every existing `teal` hit** by semantic role first (link / focus / info / cta / etc.). Output a CSV at `docs/overhaul/teal-classification.csv`.
3. **Codemod each class to its semantic alias.** A link-purposed `text-teal` becomes `text-link`; an info-purposed `text-teal` becomes `text-status-info`. Not blind sed.
4. **Legacy `--color-teal` becomes a deprecated alias** (`--color-teal: var(--link); /* DEPRECATED */`) that exists until every reference migrates, then is removed in the final cleanup commit.

The existing palette tokens (`--color-paper`, `--color-wine`, `--color-gold`) keep their names; their VALUES are aligned to the locked palette (most already are).

The audit (§4.7) confirmed:
- 12 files reference Cinzel / Cormorant directly (font tokens — need replacing)
- ≥96 hits of `text-teal` / `bg-teal` / `border-teal` (teal is not in the new palette — needs migration target)
- 15 hits of `--color-paper` family (values already align, just verify)

**File modified:** `src/app/globals.css`

- **Verify and align values** of existing tokens to match §3:
  - `--color-paper` → `#FDFAF1` (already correct)
  - `--color-wine` → `#4A0E1A` (verify; current value may differ)
  - `--color-gold` → `#B89254` (verify)
  - `--color-paper-soft`, `--color-paper-deep` → review whether to keep as variants or deprecate
- **Add missing tokens:**
  - `--color-red: #711911`
  - `--color-grey: #DFDFDF`
  - `--color-ink: #1A1A1A`, `--color-ink-muted: #5A5A5A`
- **Replace `--color-teal`** with a redirect alias to `--color-gold` for the duration of this PR, plus a `// DEPRECATED: --color-teal → --color-gold; remove after Foundation lands` comment. Then in §4.7, codemod `text-teal` → `text-gold` and `bg-teal` → `bg-gold` across all 96+ hits.
- **Add the radius scale** from §3.
- **Surface-aware helpers:** `[data-surface="cream"]`, `[data-surface="wine"]`, `[data-surface="gold"]` setting `bg`, `text`, `border-color`, `link-color` defaults — extend the existing helpers, don't rebuild.
- **Mobile-first spacing scale:** `--sp-1: 4px` … `--sp-8: 64px`. Extend, don't replace, the existing spacing tokens.
- **Type scale at mobile defaults** (`--font-size-h1: 30px` etc.), with desktop bumps inside a `@media (min-width: 768px)` block.

**File modified:** `src/app/layout.tsx` (revised per Codex Review #1)

- **Remove** Cinzel and Cormorant Garamond imports. Token aliases `--font-cinzel` and `--font-cormorant` remain (pointing at the new fonts) for the duration of this PR, with a deprecation comment, so the 12 files referencing them don't all need touching in one commit. Codemod replaces them in §4.7.
- Keep Inter as the transitional body fallback during the swap (Glacial Indifference fallback metrics align to Arial via `adjustFallback`).
- Add Montserrat (Google Fonts, weights 200/500/700) and JetBrains Mono.
- **Self-host Glacial Indifference via `next/font/local`** (NOT raw `@font-face` in globals.css — Codex called this out as the wrong approach for Next 16). Convert the downloaded `.otf` files to `.woff2` for HTTP/2 efficiency. Setup:
  ```ts
  import localFont from "next/font/local";
  const glacialIndifference = localFont({
    src: [
      { path: "../public/fonts/glacial-indifference/GlacialIndifference-Regular.woff2", weight: "400", style: "normal" },
      { path: "../public/fonts/glacial-indifference/GlacialIndifference-Bold.woff2",    weight: "700", style: "normal" },
    ],
    variable: "--font-glacial",
    display: "swap",
    adjustFallback: "Arial",
  });
  ```
- **`font-display: swap` semantics acknowledged.** A fallback-to-final font swap WILL occur. The acceptance criterion is no longer "no FOUC" — it is **CLS ≤ 0.05 on the font swap**, achieved via `adjustFallback: "Arial"` size-matching.

**Prerequisite status:**
- Glacial Indifference Regular + Bold downloaded under SIL OFL and committed at `public/fonts/glacial-indifference/` (already done).
- Italic NOT downloaded — the original spec wanted italic for footer tagline; revised spec uses Regular only (no italic in v2 brand).
- `.otf` → `.woff2` conversion: pending. Convert via `fonttools` (`pyftsubset --flavor=woff2`) or online converter. Commit alongside §4.1.

**Acceptance:**
- `npm run build` succeeds
- Page renders with new fonts (no FOUC at 375 px)
- All locked CSS variables resolve to the right hex values via DevTools

### Section 4.3 — Brand `Logo` component

**File modified:** `src/components/brand/Logo.tsx`

Replace the existing laurel-logo component with the new wordmark component. New API:

```ts
type LogoVariant = "gold" | "wine" | "red" | "cream" | "black";
type LogoSize = "nav" | "footer" | "hero" | number;
interface LogoProps {
  variant?: LogoVariant;       // default "gold"
  size?: LogoSize;             // default "nav"
  surface?: "wine" | "cream" | "black" | "red" | "gold"; // optional, picks variant if not set
  priority?: boolean;
  className?: string;
}
```

`size`-to-pixel map: `nav: 180`, `footer: 280`, `hero: 320`. Numeric sizes pass through.

Surface-to-variant auto-pick (when `variant` is omitted but `surface` is set): wine→gold, cream→wine, black→gold, red→gold, gold→wine.

Implementation: `<Image>` from next/image, `width`/`height` from the lockup's natural ratio (1709×441), `priority` propagated.

**Acceptance:**
- All five variants render correctly on their respective surfaces (visual diff vs visual companion)
- `<Logo size="hero" />` is 320 px wide on desktop; mobile shrinks naturally inside its container
- No layout shift on page load

### Section 4.4 — Global layout primitives

#### NEW: `src/components/ui/Overlay.tsx` + `useOverlay` hook

Codex Review #1 caught that `CartDrawer` and `Modal` already each have bespoke focus-trap + scroll-lock implementations. Adding a third in Header guarantees inconsistent Escape handling, focus restoration, and stacked-overlay bugs. Foundation extracts a shared primitive instead.

```ts
export function useOverlay(open: boolean, opts: {
  closeOnEscape?: boolean;       // default true
  restoreFocus?: boolean;        // default true
  lockScroll?: boolean;          // default true; ref-counted across stack
  trapFocus?: boolean;           // default true
}): { containerRef: RefCallback<HTMLElement> };
```

Implementation notes:
- **Ref-counted scroll lock.** A module-level counter tracks how many overlays are open. Lock applied when count goes 0→1, released 1→0. Avoids the iOS Safari edge case where two overlays unlock prematurely. Beats `document.body.style.overflow = "hidden"`.
- **Focus restore.** Captures `document.activeElement` on open, restores on close.
- **Focus trap.** Tab cycles within the container; first/last interactive elements wrap.
- **Escape handler.** Optional (some overlays — e.g., a confirm modal — should swallow Escape).

Migrate `CartDrawer` and `Modal` to consume `useOverlay`. Header drawer adopts it directly.

#### `src/components/layout/Header.tsx`
- Lockup at `size="nav"` (180 px). On mobile, container caps at `min(180px, 38vw)`.
- Surface remains `data-surface="wine"` (locked). Sticky behavior + scroll-hide preserved.
- **Tap targets — enforced via class.** All interactive elements (hamburger, account avatar, cart button) get `min-w-[44px] min-h-[44px]`. Codex audit found avatar at 32 px and hamburger at ~40 px in current code — this commit fixes both.
- **Mobile nav drawer pattern — locked specification:**
  - **Side drawer from the LEFT**, full viewport height, width `min(80vw, 320px)`.
  - Surface: cream, wine type, gold accent.
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` referencing the visible nav heading.
  - Scrim: `rgba(0,0,0,0.42)`, click-to-close.
  - Safe-area: `padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom)`.
  - Close affordance: × button top-right (≥ 44 × 44 px). Escape closes. Scrim click closes.
  - Animation: 240 ms ease-out slide-in. **Respects `prefers-reduced-motion`** (snap-to instead of slide).
  - Uses `useOverlay({ closeOnEscape: true, restoreFocus: true, lockScroll: true, trapFocus: true })`.
- Tab order: skip-to-content link first, logo, nav, account, cart, mobile-toggle.

#### `src/components/layout/Footer.tsx`
- New: BG monogram crest at 56 px (mobile) / 80 px (desktop) sits **above** the lockup.
- Lockup at `size="footer"` (280 px).
- Footer columns stack on mobile (2 cols), become 4 across at ≥1024 px.

#### `src/components/layout/RUOBanner.tsx`
- Switch font from Cinzel to Montserrat 600 tracked.
- Type size 10 px mobile, 11 px desktop.
- Padding tightened on mobile so it doesn't eat hero real estate.

**Acceptance:**
- Header height at 375 px ≤ 64 px (excludes the scroll-hide animation)
- Footer renders without horizontal scroll at 320 px
- RUO banner remains non-dismissible

### Section 4.5 — Shared UI primitives

#### `src/components/ui/Button.tsx`

```ts
type Variant = "primary" | "secondary" | "tertiary" | "destructive";
type Size = "sm" | "md" | "lg";
```

- `primary`: gold pill (`bg: var(--c-gold)`, `color: var(--c-wine)`, `radius: var(--r-pill)`, soft gold shadow)
- `secondary`: wine pill (`bg: var(--c-wine)`, `color: var(--c-cream)`)
- `tertiary`: transparent + wine 1px border + wine text
- `destructive`: red pill
- All sizes hit min-height 44 px on mobile (locked tap target). `sm` is for desktop dense surfaces only.
- `fullWidth` prop defaults to `true` below 768 px when `variant === "primary"` (controlled via `data-fullwidth-mobile` + CSS).

#### `src/components/ui/Callout.tsx`
- Radius `var(--r-md)` (16 px). RUO callout: cream background, wine left border 4 px, wine type.

#### `src/components/ui/Breadcrumb.tsx`
- Montserrat 500 tracked. Separator: `›` not `/`. Hover: gold underline 200 ms.

#### `src/components/ui/DataRow.tsx`
- Label: Montserrat 500 tracked, ink-muted color.
- Value: JetBrains Mono, ink color, right-aligned on desktop, left-aligned on mobile.

**Acceptance:**
- Every primitive renders correctly under both `data-surface="cream"` and `data-surface="wine"` (no white-on-white, no black-on-black)
- Mobile primary CTAs are full-width below 768 px
- All radii pull from CSS vars, not hard-coded

### Section 4.6 — `GoldBand` component (the surface-language anchor)

**File added:** `src/components/brand/GoldBand.tsx`

Drop-in section component representing the "one gold band per page" anchor moment from Q6 option C. Renders a full-bleed gold strip with optional monogram dividers (mirroring the vial label band).

```ts
interface GoldBandProps {
  eyebrow?: string;        // tracked uppercase, wine
  headline: string;        // wine, large
  withMonogramDividers?: boolean;  // default true
}
```

Mobile: stacks vertically, monogram dividers move to top/bottom. Desktop: horizontal three-column (text · monogram · text · monogram · text).

**Acceptance:**
- Renders on cream pages without breaking surrounding flow
- Monograms align vertically with the text on mobile
- Used by §4.7 audit script to drop into the homepage stat strip + product detail purity strip

### Section 4.7 — Compatibility audit + codemod

Audit, then codemod, then re-audit. Confirmed scope from the self-review pass:

| Pattern | Hits | Action |
|---|---|---|
| `cinzel` / `cormorant` (case-insensitive) | 12 files | Codemod: `font-cinzel` → `font-display`, `font-cormorant` → `font-editorial` (the new alias names) |
| `text-teal` / `bg-teal` / `border-teal` | ≥96 hits | Codemod: `teal` → `gold` site-wide (use sed with file-list filter) |
| `--color-paper` family | 15 hits | Verify values, keep names |
| `#5C1A1A` / `#FAF6EC` hard-coded hexes | 1 hit | Replace with token |

**Codemod commands** (executed in §4.7's commit):

```bash
# 1. Teal → gold across all source files
git grep -lE "text-teal|bg-teal|border-teal" src | \
  xargs sed -i '' -E 's/(text|bg|border)-teal/\1-gold/g'

# 2. Cinzel → display, Cormorant → editorial in font-class references
git grep -lE "font-cinzel|font-cormorant" src | \
  xargs sed -i '' -E 's/font-cinzel/font-display/g; s/font-cormorant/font-editorial/g'

# 3. Replace hard-coded hexes with token vars
git grep -lE "#5C1A1A" src | xargs sed -i '' 's/#5C1A1A/var(--color-wine)/g'
```

**Post-codemod re-audit (must all return zero hits):**

```bash
git grep -nE "text-teal|bg-teal|border-teal" src
git grep -nE "font-cinzel|font-cormorant" src
git grep -nE "#5C1A1A|#FAF6EC" src
git grep -nE "--font-cinzel|--font-cormorant" src
```

Each remaining hit gets resolved manually or tagged with `// TODO(v2-foundation):` and logged in `ROADMAP.md` for follow-up.

### Section 4.8 — Mobile audit pass

Manual checklist run at 375 px in Chrome DevTools after every other section completes:

- [ ] Header height ≤ 64 px
- [ ] No horizontal scroll on any page at 375 px
- [ ] Every primary CTA is full-width
- [ ] Every tap target ≥ 44 × 44
- [ ] Type scale legible (body ≥ 14 px, headlines ≥ 28 px on hero pages)
- [ ] Footer columns stack cleanly
- [ ] Mobile drawer opens, closes, traps focus, restores scroll
- [ ] Sticky elements don't overlap content (header + cart-drawer interplay)

Run the same checklist at 320 px (smallest realistic phone) for any horizontal-overflow regression.

---

## 5. Test plan

### Unit / component tests (Vitest)

- `Logo.test.tsx` — renders each variant, applies correct width per size prop, falls back from surface→variant correctly.
- `Button.test.tsx` — primary applies gold pill class, mobile full-width prop sets data attribute.
- `Header.test.tsx` — hamburger toggles aria-expanded, nav drawer traps focus, escape closes.
- `Footer.test.tsx` — renders monogram crest above lockup at correct sizes.
- `GoldBand.test.tsx` — eyebrow + headline render, monogram dividers toggle.

### Visual regression (manual at this stage)

Capture screenshots at 375 / 768 / 1280 px for:
- `/` (home — current layout, new tokens)
- `/catalogue` (current layout)
- `/about`, `/faq`, `/contact`, `/shipping`, `/payments`, `/terms`, `/privacy`
- `/account` (logged-in state)

Record any layout shifts and triage: real regression vs intended (the brand IS supposed to look different).

### Compliance lint

`npm run lint:content` — must remain at 0 violations. The new Foundation copy work doesn't introduce new prose; the lint should be untouched.

### Build + typecheck

`npm run build` — must succeed with no warnings beyond the existing baseline.

---

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Cinzel/Cormorant references buried in 50+ files cause page-by-page font fallbacks | §4.7 audit script. Replace at the source token, not per-file. |
| Self-hosting Glacial Indifference adds ~120 KB to first-page payload | `font-display: swap` + `preload` only on the home page. Acceptable for a one-time install. |
| Header sticky-hide regression on mobile due to logo height change | Test at 320 / 375 / 414 px. If the bigger logo pushes header height beyond 64 px on 320 px viewport, scale the nav variant to 140 px on mobile. |
| Logo PNG variants look soft at large sizes (raster-derived, not true-vector) | Acceptable per Q4. Document the limitation in `ROADMAP.md`; commit to swap when a true SVG arrives. |
| Mobile drawer focus-trap regression breaks accessibility | Add focus-trap library or hand-rolled escape/tab handling; test with VoiceOver. |
| Old branch `feat/premium-reframe` had partial copy work that's now orphaned | Already declared dead and deleted. No mitigation needed. |
| `GoldBand` component's gold-on-cream contrast fails WCAG | Test with WebAIM contrast checker — wine text on gold passes; ink text on gold passes; only cream-on-gold needs to be avoided in body copy. |

---

## 7. Acceptance criteria

This PR is mergeable when **all of the following** are green:

- [ ] All 5 logo variants present at `/public/brand/logo-{variant}.png`
- [ ] BG monogram present at `/public/brand/bg-monogram.png`
- [ ] Favicon serves at `/icon`, `/apple-icon`, `/favicon.ico` (Next.js conventions)
- [ ] Home page renders at 375 px with new tokens, lockup, surfaces — no horizontal overflow
- [ ] Every page in §5 visual regression list renders without layout breakage at 375 / 768 / 1280
- [ ] All Vitest unit tests pass
- [ ] `npm run build` succeeds
- [ ] `npm run lint:content` returns 0 violations
- [ ] §4.7 grep audit returns 0 hits for dead tokens
- [ ] §4.8 mobile audit checklist all green
- [ ] User has approved the visual diff at 375 px (mandatory checkpoint before merge)

---

## 8. Out of scope (deferred)

For absolute clarity, here is what this PR will **not** change, with the sub-project that owns each:

| Deferred | Owner |
|---|---|
| Catalog data shape (BAC water removal, liquid category dissolution, "(Liquid)" rename, "catalogue"→"catalog") | B |
| Product card UI / Zara-style minimalist list / hover animation / category color theming | C |
| Product detail page reorder + Praetorian-style stepper | D |
| Stack picker fix + Build-Your-Stack rework | E |
| Carousel removal + top-6 grid + homepage hero rework | F |
| Cart drawer animation + add-to-cart confirmation animation | G |
| Checkout UI revamp on Praetorian/MyTide reference | H |
| Founder-letter copy + signoff treatment | I |
| Re-rendered SKU vial photography | J |
| Vial label SVGs | K |
| `/news` page removal | F (homepage IA) — defer until then |

---

## 9. Build sequence (revised: compatibility-first — Codex Review #1 fix)

Commit-by-commit on `feat/v2-overhaul`. **Each commit independently builds AND passes existing tests** — no broken intermediate states. Codex flagged the original sequence as guaranteed-broken because consumers reference assets/fonts that get added separately from their consumers.

The corrected ordering: add NEW (with aliases keeping legacy paths valid) → migrate consumers → remove legacy last.

1. `chore(foundation): add brand metadata module (src/lib/brand.ts) + routes module (src/lib/routes.ts)`
2. `chore(foundation): add brand asset extraction script (scripts/extract-logo-variants.py)`
3. `feat(foundation): add brand assets to public/brand/ (1 metallic gold PNG + 1 SVG-with-currentColor + monogram + favicon sizes)`
4. `feat(foundation): convert + commit Glacial Indifference woff2 files (Regular + Bold)`
5. `feat(foundation): wire next/font/local for Glacial Indifference + Montserrat + JetBrains Mono in layout.tsx; keep --font-cinzel / --font-cormorant aliases pointing at Glacial`
6. `feat(foundation): add semantic v2 token aliases (--link, --focus, --cta, --status-info) + new palette tokens (--c-red, --c-grey, --c-ink, --c-ink-muted) + radius scale + spacing scale; legacy --color-teal kept as deprecated alias`
7. `feat(foundation): add useOverlay shared hook + Overlay primitive`
8. `refactor(foundation): migrate CartDrawer and Modal to useOverlay`
9. `feat(foundation): rebuild Logo component (variant + size API; uses brand.ts paths)`
10. `feat(foundation): rebuild Button primitive (gold pill / wine pill / tertiary / destructive; min 44px tap targets)`
11. `feat(foundation): retheme Header — new lockup at 180 px, mobile drawer side-from-left with full pattern spec, 44px tap targets enforced`
12. `feat(foundation): retheme Footer — monogram crest above 280 px lockup, mobile-stacked columns`
13. `feat(foundation): retheme RUOBanner in Montserrat`
14. `feat(foundation): retheme Callout / Breadcrumb / DataRow primitives + add Input radius token`
15. `feat(foundation): add GoldBand primitive (NOT placed on any page — Foundation ships the component only)`
16. `chore(foundation): classify all teal hits to docs/overhaul/teal-classification.csv; portable Node codemod script`
17. `chore(foundation): codemod teal → semantic aliases (link / focus / status-info / etc.) per classification`
18. `chore(foundation): codemod font-cinzel → font-display, font-cormorant → font-editorial`
19. `chore(foundation): remove deprecated aliases (--color-teal, --font-cinzel, --font-cormorant) once all consumers migrated`
20. `chore(foundation): mobile audit fixes (header height @ 320 px, drawer trap, tap-target verification)`
21. `test(foundation): vitest-jsdom + Playwright smoke + brand snapshot tests`
22. `docs(foundation): update ROADMAP with shipped status and revisit flags`

Mid-sequence verification: after every commit, `npm run build && npm test && npm run lint:content` must succeed.

---

## 10. Rollback plan

Foundation is a token + primitive swap; rollback is mechanical:

- If the merged PR causes regressions on production, revert the merge commit. All changes are isolated to the listed files; no DB schema change, no env var change, no data migration.
- The `main` branch is untouched until merge — preview testing happens on the worktree's `feat/v2-overhaul` branch.
- If a single section needs rollback (e.g., the gold-band component), revert just that commit.

---

## 11. Open questions for user before code starts

Resolved after Codex Review #1:

1. **Glacial Indifference fonts:** path **B** taken — downloaded under SIL OFL, committed to `public/fonts/glacial-indifference/`. `.otf → .woff2` conversion is part of the build sequence (commit 4).
2. **Teal codemod:** revised approach — semantic v2 aliases (`--link`, `--focus`, `--cta`, `--status-info`) per the codex finding. Each `teal` reference classified by role first, then codemodded to its semantic alias. Default replacement is `--link → var(--color-gold)` for hyperlinks; status-info contexts go to wine; CTAs to gold (already covered by `--cta`).

Open prerequisite still requires user acknowledgement: **drawer pattern lock** (side-from-left, 80vw cap 320px) — flagged in §4.4. Confirm or specify a different pattern (top sheet, full-screen, side-from-right).

After this PRD is approved, the next workflow stages are:

12. Plan code (file-level diff inventory) — derived from this PRD's §4 sections
13. Plan tests — derived from §5
14. Code (commit by commit per §9)
15. Test
16. Debug
17. Codex review
18. Fix
19. Land into `feat/v2-overhaul`

Per the locked build workflow (`feedback_build_workflow.md`): no shortcuts.
