# Plan · Sub-project A — Code

File-level diff inventory derived from PRD §4. Every file touch in the Foundation PR is listed here so the next codex pass + the user review can spot omissions before any code is written. **Mobile-first applies to every component decision below.**

**Revised after Codex Review #1.** See `CODEX-REVIEW-1-FINDINGS.md` for the changes. Major shifts:
- New modules: `src/lib/brand.ts` (centralized brand metadata), `src/lib/routes.ts` (route constants), `src/components/ui/Overlay.tsx` + `useOverlay` hook (shared focus-trap + ref-counted scroll lock)
- Dropped from inventory: `src/app/page.tsx` (doesn't render `<Logo>`), `src/lib/email/templates.ts` (already uses inline system stacks), manual `<link>` favicon injection in `layout.tsx` (use Next file conventions instead)
- Logo asset strategy: 1 metallic gold PNG + 1 SVG-with-currentColor for flat variants (was 5 PNGs)
- Font loading: `next/font/local` + `.woff2` (was raw `@font-face` + `.otf` in globals.css)
- Codemod: portable Node script, exhaustive teal classification (was BSD `sed` + 3 patterns)

---

## Files added (greenfield)

### `public/brand/` — new brand assets (revised)

| File | Source | Size |
|---|---|---|
| `logo-gold.png` | chroma-keyed metallic gradient (cannot be replicated in flat SVG) | ~170 KB |
| `logo-flat.svg` | single SVG with `fill="currentColor"`, used for wine / red / cream / black variants — color set via CSS at render time | ~12 KB |
| `bg-monogram.svg` | single SVG with `fill="currentColor"`, used for wine / red / cream / gold renderings | ~6 KB |

Apple icon and favicon are produced by Next.js file conventions, not static PNGs:

| File | Convention |
|---|---|
| `src/app/icon.tsx` | generates 32×32 favicon via `ImageResponse` using `bg-monogram.svg` + brand tokens |
| `src/app/apple-icon.tsx` | generates 180×180 Apple touch icon |
| `src/app/icon-large.tsx` (optional) | 512×512 for PWA / Android home screen, if needed |

Codex Review #1 fix: 5 PNG variants reduced to 1 PNG + 1 SVG. The metallic gold MUST stay as a raster (gradient + shading don't translate to flat-color SVG); the four flat variants collapse to one SVG that's recolored via CSS. The `<Logo>` component picks the correct asset based on variant prop.

Source assets at `/Users/ahmed/Research Only Peptides/benchgrade-peptides/.superpowers/brainstorm/52228-1777513211/content/assets/` will be copied (gold PNG) and converted (flat variants → single SVG) into `public/brand/`.

### `public/fonts/glacial-indifference/`

| File | Source | Size |
|---|---|---|
| `GlacialIndifference-Regular.otf` | Hanken Design Co. via 1001fonts.com (SIL OFL) | 53 KB |
| `GlacialIndifference-Bold.otf` | same | 32 KB |
| `LICENSE.txt` | SIL Open Font License v1.1 | 4 KB |

**Already installed** in the worktree.

### `scripts/extract-logo-variants.py`

Python script that takes the source asset (`Bench Grade-2/1.svg`'s embedded raster, or a future true-vector source) and emits the metallic gold PNG + the flat SVG with `currentColor`. Keeps the regeneration recipe in-repo so the next time the source changes, one command rebuilds the lot. Wraps the chroma-key + alpha-trace logic from the visual-companion bash scripts.

### `scripts/codemod-teal-to-semantic.mjs`

Portable Node script (replaces the BSD-only `sed -i ''` from the original plan). Reads `docs/overhaul/teal-classification.csv`, walks each file → token mapping, applies replacements, writes back. Has `--dry-run` flag that prints the diff without writing. Uses `node:fs` only, no dependencies.

```js
// Usage: node scripts/codemod-teal-to-semantic.mjs [--dry-run]
// Reads teal-classification.csv (file, line, original, replacement)
// Applies each replacement with line-anchored regex
```

### `scripts/convert-fonts-to-woff2.mjs`

One-shot script that converts the downloaded `.otf` files to `.woff2` using `wawoff2` (Google's WASM port of woff2). Run once; commits both `.otf` (kept for source-of-truth) and `.woff2` (referenced by `next/font/local`).

### `src/lib/brand.ts` — centralized brand metadata (NEW)

Single source of truth for brand description, asset paths, and entity metadata. Codex Review #1 caught that the brand description / logo URL was duplicated in root metadata, page metadata, OG, Twitter, JSON-LD, OG-image, apple-icon, contact page, and email templates.

```ts
export const BRAND = {
  // Identity
  name: "Bench Grade Peptides",
  legalName: "Bench Grade Peptides LLC",
  shortName: "Bench Grade",

  // Brand voice — single source of truth for SEO + social cards
  tagline: "Synthesized in Tampa. Vialed in Orlando.",
  description: "Research-grade synthetic peptides. Synthesized in Tampa, vialed in Orlando, HPLC-verified per lot by an independent US laboratory. CoA on every vial. For laboratory research use only.",
  shortDescription: "HPLC-verified research peptides. Made in the United States.",

  // Asset paths (served from /public/brand)
  logoMetallic: "/brand/logo-gold.png",
  logoFlat: "/brand/logo-flat.svg",
  monogram: "/brand/bg-monogram.svg",
  ogImage: "/brand/og-default.png",

  // Entity (used by Schema.org JSON-LD)
  address: {
    streetAddress: "8 The Green",
    addressLocality: "Dover",
    addressRegion: "DE",
    postalCode: "19901",
    addressCountry: "US",
  },
  email: "admin@benchgradepeptides.com",
  sameAs: [] as string[],
} as const;

export type Brand = typeof BRAND;
```

Migrate `layout.tsx` (root metadata + JSON-LD), every `page.tsx` with metadata, `apple-icon.tsx`, `icon.tsx`, `opengraph-image.tsx`, `contact/page.tsx` (email link) to read from `BRAND`. Email templates already use system stacks (per codex finding) — they reference `BRAND.name` and `BRAND.email` only.

### `src/lib/routes.ts` — route constants (NEW)

Codex caught that `/catalogue` is hardcoded in nav, footer, JSON-LD `SearchAction`, sitemap, and tests. Sub-project B will rename `catalogue → catalog`. Without route constants, B requires hunting through 30+ files.

```ts
export const ROUTES = {
  HOME: "/",
  CATALOG: "/catalogue",        // B will change this string only here
  CATEGORY: (slug: string) => `/catalogue/${slug}`,
  PRODUCT: (cat: string, slug: string) => `/catalogue/${cat}/${slug}`,
  STACK: (slug: string) => `/catalogue/stacks/${slug}`,
  RESEARCH: "/research",
  ARTICLE: (slug: string) => `/research/${slug}`,
  ABOUT: "/about",
  COMPLIANCE: "/compliance",
  SHIPPING: "/shipping",
  PAYMENTS: "/payments",
  PAYMENTS_ACH: "/payments/ach",
  WHY_NO_CARDS: "/why-no-cards",
  CONTACT: "/contact",
  FAQ: "/faq",
  TERMS: "/terms",
  PRIVACY: "/privacy",
  COA: "/coa",
  CART: "/cart",
  CHECKOUT: "/checkout",
  LOGIN: "/login",
  ACCOUNT: "/account",
} as const;
```

Foundation migrates Header nav, Footer columns, `layout.tsx` JSON-LD `SearchAction`, sitemap, and any test that hardcodes a URL to read from `ROUTES`. Sub-project B then changes only the value of `ROUTES.CATALOG` and propagation is automatic.

### `src/components/ui/Overlay.tsx` + `useOverlay` hook (NEW)

See PRD §4.4. Shared focus-trap + ref-counted scroll lock primitive. Migrates `CartDrawer` and `Modal` away from their bespoke implementations.

### `src/components/brand/GoldBand.tsx`

The "one gold band per page" anchor component locked in Q6 option C.

```tsx
"use client";
import { Image } from "next/image";

interface GoldBandProps {
  eyebrow?: string;
  headline: string;
  withMonogramDividers?: boolean; // default true
  className?: string;
}

export function GoldBand({ eyebrow, headline, withMonogramDividers = true, className }: GoldBandProps) {
  // mobile: stacked vertical
  // desktop ≥768: horizontal row with monogram dividers between text segments
}
```

Mobile-first layout: a vertical stack with eyebrow → headline → optional monogram below. Desktop adds horizontal divider monograms flanking the headline.

### `src/components/brand/__tests__/GoldBand.test.tsx`

See plan-tests for cases.

---

## Files modified

### `src/app/globals.css`

**Strategy: update existing tokens in place, add missing ones, deprecate retired ones.**

Current state already has aligned values for some tokens (e.g. `--color-paper: #FDFAF1`). Audit and patch:

- **Verify / fix existing color tokens:**
  - `--color-paper: #FDFAF1` ✓
  - `--color-paper-soft: #F4EBD7` → review, may keep as a card surface or deprecate
  - `--color-paper-deep: #e7e0d0` → likely deprecate
  - `--color-wine` → set to `#4A0E1A` (verify current value)
  - `--color-gold` → set to `#B89254`
  - `--color-gold-light`, `--color-gold-dark` → derive from `#B89254` (lighten/darken 12%)
  - `--color-ink` → `#1A1A1A`
  - `--color-ink-soft` / `--color-ink-muted` → `#5A5A5A`

- **Add net-new tokens:**
  - `--color-red: #711911`
  - `--color-grey: #DFDFDF`
  - `--r-sm: 12px; --r-md: 16px; --r-lg: 24px; --r-pill: 999px;`
  - `--sp-1: 4px` … `--sp-8: 64px`

- **Deprecation aliases** (kept until §4.7 codemod):
  - `--color-teal: var(--color-gold)` with `/* DEPRECATED — use --color-gold; remove after Foundation lands */`

- **Type scale (mobile-first):**
  ```css
  :root {
    --font-size-h1: 30px;
    --font-size-h2: 24px;
    --font-size-h3: 20px;
    --font-size-body: 14px;
    --font-size-small: 12px;
    --font-size-eyebrow: 11px;
  }
  @media (min-width: 768px) {
    :root {
      --font-size-h1: 48px;
      --font-size-h2: 32px;
      --font-size-h3: 24px;
      --font-size-body: 16px;
    }
  }
  ```

- **Self-hosted Glacial Indifference declarations:**
  ```css
  @font-face {
    font-family: "Glacial Indifference";
    src: url("/fonts/glacial-indifference/GlacialIndifference-Regular.otf") format("opentype");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: "Glacial Indifference";
    src: url("/fonts/glacial-indifference/GlacialIndifference-Bold.otf") format("opentype");
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }
  ```

- **Surface helpers:** `[data-surface="cream" | "wine" | "gold" | "red" | "black"]` setting bg / text / link defaults. Extend the existing wine helper, add the rest.

- **Gold-on-cream label rule:** add a class `.label-eyebrow` that inherits `font-weight: 700` only when its ancestor is `[data-surface="cream"]`. On wine, gold labels stay at default 500.

### `src/app/layout.tsx`

- **Remove imports:** `Cinzel`, `Cormorant_Garamond` from `next/font/google`. Keep `Inter` and `JetBrains_Mono`.
- **Add imports:** `Montserrat` (weights 200, 500, 700) from `next/font/google`. Glacial Indifference is loaded via the `@font-face` in globals.css (not via `next/font`), so it doesn't appear in this file's imports.
- **Update `--font-display`, `--font-editorial`, `--font-body`, `--font-ui` CSS variable wiring.** Replace Cinzel→Glacial Indifference for `--font-display`, Cormorant→Glacial Indifference for `--font-editorial` (Glacial Indifference is the answer for both display and editorial in v2). Inter stays as a fallback for the body for the duration of this PR.
- **Update Schema.org `description`** to v2 voice: "Synthesized in Tampa. Vialed in Orlando. HPLC-verified per lot. CoA on every vial."
- **Add `<link rel="icon">` and Apple touch icon links** referencing the new `public/brand/favicon-*.png`. Next.js's automatic icon convention via `app/icon.tsx` is preferred — see next file.

### `src/app/icon.tsx` and `src/app/apple-icon.tsx` (likely existing)

If the project already has these, replace their generated content with imports of `public/brand/favicon-512.png` and `public/brand/favicon-180.png` respectively. If they don't exist, add them.

### `src/components/brand/Logo.tsx`

Full rewrite. Replace the legacy laurel-logo component. New API:

```tsx
import Image from "next/image";

export type LogoVariant = "gold" | "wine" | "red" | "cream" | "black";
export type LogoSize = "nav" | "footer" | "hero" | number;
export type LogoSurface = "wine" | "cream" | "black" | "red" | "gold";

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  surface?: LogoSurface;
  priority?: boolean;
  className?: string;
}

const SIZE_MAP: Record<Exclude<LogoSize, number>, number> = {
  nav: 180,
  footer: 280,
  hero: 320,
};

const SURFACE_TO_VARIANT: Record<LogoSurface, LogoVariant> = {
  wine: "gold",
  cream: "wine",
  black: "gold",
  red: "gold",
  gold: "wine",
};

const ASSET_RATIO = 1709 / 441; // natural lockup ratio

export function Logo({ variant, size = "nav", surface, priority, className }: LogoProps) {
  const resolvedVariant = variant ?? (surface ? SURFACE_TO_VARIANT[surface] : "gold");
  const widthPx = typeof size === "number" ? size : SIZE_MAP[size];
  const heightPx = Math.round(widthPx / ASSET_RATIO);

  return (
    <Image
      src={`/brand/logo-${resolvedVariant}.png`}
      alt="Bench Grade Peptides"
      width={widthPx}
      height={heightPx}
      priority={priority}
      className={className}
    />
  );
}
```

The legacy callers using `size="md" | "lg" | "xl"` get a temporary back-compat shim that maps old sizes → new sizes (`md → nav`, `lg → footer`, `xl → hero`). Shim removed in §4.7 codemod sweep.

### `src/components/layout/Header.tsx`

- Replace `<Logo variant="mark" surface="wine" size="md" />` with `<Logo size="nav" surface="wine" priority />`.
- **Mobile drawer focus management:** add a focus-trap (use `react-aria-components` if available; otherwise hand-rolled `useEffect` that traps tab cycling between drawer first/last interactive elements; restore focus on close).
- **Body scroll lock when drawer open:** `document.body.style.overflow = open ? "hidden" : ""` in a `useEffect`.
- **Tap target audit:** every nav button + cart button + hamburger ≥ 44 × 44 px. Audit existing CSS.
- **Type face swap:** any `font-display` class references in the nav stay (alias points to Glacial Indifference now). No code change here, just confirm the new font is what renders.
- **Mobile nav size:** if 180 px lockup overflows on 320 px viewport, constrain to `min(180px, 38vw)`.

### `src/components/layout/Footer.tsx`

- Add new top section: BG monogram crest above the lockup.
- Lockup: `<Logo size="footer" surface="wine" />` (280 px).
- Crest: `<Image src="/brand/bg-monogram.png" width={56} height={...} />` on mobile, `width={80}` on desktop. Use a CSS class `.footer-crest` with `width: clamp(56px, 8vw, 80px)`.
- Footer columns: `grid-template-columns: repeat(2, 1fr)` mobile → `repeat(4, 1fr)` ≥1024 px.
- Update tagline: replace existing italic Cormorant tagline with the v2 voice line "Synthesized in Tampa. Vialed in Orlando. HPLC-verified per lot." — set in Glacial Indifference italic if available, otherwise Glacial Indifference regular.

### `src/components/layout/RUOBanner.tsx`

- Swap `font-display` (Cinzel) for `font-ui` (Montserrat) class.
- Type size: 10 px mobile, 11 px desktop. Padding tightened on mobile.
- Keep the `data-surface="wine"` and the static (non-marquee) treatment.

### `src/components/ui/Button.tsx`

Full rewrite per PRD §4.5. Variant/size matrix:

|  | sm (32 h) | md (44 h) | lg (52 h) |
|---|---|---|---|
| primary (gold pill) | desktop dense only | default | hero CTAs |
| secondary (wine pill) | rare | default | hero CTAs |
| tertiary (transparent + wine border + wine text) | desktop nav-secondary | default | rare |
| destructive (red pill) | rare | default | rare |

- All variants `border-radius: var(--r-pill)`.
- Mobile: when `variant === "primary"` and viewport < 768 px, button is full-width by default. Override via prop `fullWidthMobile={false}`.
- Min-height `md` = 44 px (locked tap target). `sm` only used in desktop dense surfaces (e.g., admin tables).
- Soft drop shadow on primary/secondary: `box-shadow: 0 6px 14px rgba(184, 146, 84, 0.32)` for gold; `rgba(74, 14, 26, 0.20)` for wine. No shadow on tertiary/destructive.

### `src/components/ui/Callout.tsx`

- `border-radius: var(--r-md)` (16 px).
- Variants: `info` (cream bg, wine border-left), `ruo` (cream bg, wine border-left + bigger weight), `warning` (red border-left, ink text).
- Padding: 16/20 mobile / desktop.

### `src/components/ui/Breadcrumb.tsx`

- Type face: Montserrat 500 tracked.
- Separator: `›` (Unicode `›`) replaces existing `/` if present.
- Hover: gold underline 200 ms transition.
- Mobile: truncate middle items to `…` if breadcrumb path > 2 items at <768 px.

### `src/components/ui/DataRow.tsx`

- Label: Montserrat 500 tracked, color `var(--color-ink-muted)`.
- Value: JetBrains Mono, color `var(--color-ink)`.
- Layout: stacked on mobile (label above value), two-column right-aligned on desktop ≥768 px.

### `src/components/cart/CartButton.tsx`

- Update radius to use `var(--r-pill)` if currently a pill.
- Hover color: `var(--color-gold)` (currently teal — codemod handles this).

### `src/lib/email/templates.ts`

Update inline-styled email templates that reference Cinzel/Cormorant (they likely embed font-family literally since email doesn't support custom fonts well). Replace with system-safe stacks:
- Display: `Georgia, "Times New Roman", serif` (closest-feeling without webfont)
- Body: `-apple-system, "Segoe UI", Helvetica, Arial, sans-serif`

If the templates use class names that map to css vars, no edit needed (vars are aliased).

### `src/components/account/SubscriptionCard.tsx`, `src/components/affiliate/TierBadge.tsx`

These were in the audit. Confirm whether they reference Cinzel/Cormorant by class name or hard-coded font. If class name → no edit (alias handles it). If hard-coded → swap to a class.

### `src/app/__tests__/tokens.test.ts`

Update token snapshot to match new values:
- `--color-paper: #FDFAF1` (already passes)
- `--color-wine: #4A0E1A`
- `--color-gold: #B89254`
- `--color-red: #711911` (new)
- `--color-grey: #DFDFDF` (new)
- Verify `--r-sm/md/lg/pill` present.

### `src/app/page.tsx`

The home page does not get a layout rewrite in this PR (that's sub-project F). But:
- Replace the current logo render with the new `<Logo>` component (preserves visual continuity with the rest of the site).
- The two `<ProductCarousel>` / `<PopularStacksHeroGrid>` calls stay — sub-project F removes them.

---

## Codemod work (§4.7) — derived file targets

After tokens land:

```bash
# 1. Teal → gold (96+ hits across many files)
git grep -lE "text-teal|bg-teal|border-teal" src \
  | xargs sed -i '' -E 's/(text|bg|border)-teal/\1-gold/g'

# 2. font-cinzel → font-display, font-cormorant → font-editorial
git grep -lE "font-cinzel|font-cormorant" src \
  | xargs sed -i '' -E 's/font-cinzel/font-display/g; s/font-cormorant/font-editorial/g'

# 3. Hard-coded #5C1A1A → token
git grep -lE "#5C1A1A" src | xargs sed -i '' 's/#5C1A1A/var(--color-wine)/g'
```

Affected files (estimated): ~100 across `src/app/**`, `src/components/**`, plus tests.

---

## Build sequence — commits per PRD §9

Re-listed for cross-reference; nothing new vs the PRD:

1. `chore(foundation): add brand asset extraction script`
2. `feat(foundation): add 5 logo variants + BG monogram + favicon to /public/brand`
3. `feat(foundation): self-host Glacial Indifference (Regular + Bold) + LICENSE`
4. `feat(foundation): replace design tokens (palette, radius, typography, spacing)`
5. `feat(foundation): swap font stack — Glacial Indifference + Montserrat + JetBrains Mono`
6. `feat(foundation): rebuild Logo component with variant + size API`
7. `feat(foundation): retheme Header with new lockup at 180 px + mobile drawer focus trap`
8. `feat(foundation): retheme Footer with monogram crest above 280 px lockup`
9. `feat(foundation): retheme RUOBanner in Montserrat`
10. `feat(foundation): rebuild Button primitive (gold pill / wine pill / tertiary / destructive)`
11. `feat(foundation): retheme Callout / Breadcrumb / DataRow primitives`
12. `feat(foundation): add GoldBand surface-anchor component`
13. `chore(foundation): codemod teal → gold + cinzel → display + cormorant → editorial`
14. `test(foundation): Vitest specs for Logo / Button / Header / Footer / GoldBand + tokens`
15. `chore(foundation): mobile audit fixes (header height @ 320 px, drawer trap, etc.)`

---

## Risks for the next codex pass to challenge

- Mobile drawer focus trap implementation correctness (custom vs library)
- Glacial Indifference rendering metrics differ from Cinzel (width, x-height) — could cause line-height jump in headers/footers
- 96-file teal codemod could hit false positives in code that legitimately mentions "teal" (search regex tightness)
- `next/image` priority + new asset path — if the legacy laurel logo PNG was being preloaded, removing it could regress LCP unless the new gold logo gets the same priority hint
- Inline-styled email templates may have hex literals that the codemod misses
- `data-surface="cream"` cascade can break if wrapped components also set surfaces
- Pill-shape inputs at the new radius scale could clip text on narrow mobile widths
- Mobile-first audit in §4.8 is manual — if not run carefully, regressions slip through
