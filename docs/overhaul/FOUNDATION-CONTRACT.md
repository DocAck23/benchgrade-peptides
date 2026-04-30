# Foundation Contract

The contract every downstream sub-project (B–K) honors when consuming Foundation outputs. This is the seam between sub-project A and the rest of the v2 overhaul.

If you're working on a sub-project and any of these rules feels wrong, fix the FOUNDATION first. Do not work around it in your sub-project.

---

## Rule 1 · Tokens, not hexes

| Allowed | Forbidden |
|---|---|
| `var(--color-wine)` | `#4A0E1A` |
| `var(--color-gold)` | `#B89254` |
| `var(--link)` | `var(--color-teal)` |
| `var(--cta)` | hard-coded button colors |
| `var(--r-md)`, `var(--r-input)`, `var(--r-pill)` | hard-coded `border-radius` |

Hard-coded hexes are CI-blocked via `rg "#[0-9a-fA-F]{3,6}" src --type css --type tsx`.

## Rule 2 · Asset paths come from `BRAND` and `ROUTES` modules

| Need | Read from |
|---|---|
| Brand name / legalName / shortName | `BRAND.name`, `BRAND.legalName`, `BRAND.shortName` |
| Brand description (SEO, OG, Twitter, JSON-LD) | `BRAND.description` |
| Logo / monogram / og-image paths | `BRAND.logoMetallic`, `BRAND.logoFlat`, `BRAND.monogram`, `BRAND.ogImage` |
| Address / email | `BRAND.address`, `BRAND.email` |
| Route URLs | `ROUTES.CATALOG`, `ROUTES.PRODUCT(cat, slug)`, etc. |

Never hardcode `/brand/logo-gold.png` or `/catalogue` in a sub-project — both will break when Foundation or sub-project B changes them.

## Rule 3 · Use `<Logo>`, never `<img src="/brand/logo*">`

The `<Logo>` component owns variant resolution, surface auto-pick, sizing, and aspect-ratio guarantees. Sub-projects use:

```tsx
<Logo size="hero" surface="cream" />
<Logo size="footer" surface="wine" />
<Logo size="nav" variant="gold" />
```

Sub-projects never reach for asset paths directly.

## Rule 4 · Use `useOverlay`, never roll your own focus-trap

Any new modal, drawer, popover, or full-screen sheet uses:

```tsx
import { useOverlay } from "@/components/ui/Overlay";

function MyDrawer({ open, onClose }) {
  const { containerRef } = useOverlay(open, {
    closeOnEscape: true,
    restoreFocus: true,
    lockScroll: true,
    trapFocus: true,
  });
  // ... render to containerRef
}
```

Custom focus-trap implementations are forbidden. Custom scroll-lock implementations are forbidden. Both are CI-blocked via grep audit on `document.body.style.overflow` outside the Overlay primitive.

## Rule 5 · Mobile-first or it doesn't ship

Every component built in any sub-project must:

- Render correctly at **375 px** viewport before desktop styles get added
- Respect tap-target floor: every interactive element ≥ **44 × 44 px**
- Default to full-width primary CTAs below 768 px
- Type scale: body ≥ 14 px mobile, headlines ≥ 28 px on hero pages
- Survive 320 px without horizontal overflow

Foundation provides the design tokens (`--sp-*`, `--font-size-*`, type scale media queries) — sub-projects consume them.

## Rule 6 · Light surface only

The site is light-only by design. No dark-mode media-query handling, no `prefers-color-scheme: dark` blocks. `globals.css` keeps `color-scheme: light`. Anyone who attempts dark-mode rules in a sub-project should be redirected here.

## Rule 7 · Pinyon Script is asset-only

Pinyon Script the font is reserved for the logo image asset. It is **never** loaded as a webfont. No `<text>` in Pinyon. No CSS `font-family: "Pinyon Script"`. The lockup is a placed image; everything else is Glacial Indifference + Montserrat + JetBrains Mono.

## Rule 8 · Compliance lint is the floor

`npm run lint:content` must return 0 violations on every commit. The lint is the legal floor; brand voice (`docs/BRAND_VOICE.md`) is the tone ceiling. New copy in any sub-project passes both.

## Rule 9 · `<GoldBand>` is the surface anchor primitive

The "one gold band per page" rhythm from the surface-language brainstorm (Q6 option C) ships as the `<GoldBand>` component in Foundation. Sub-projects place it on their pages — Foundation does NOT place it anywhere. The rule:

- One `<GoldBand>` per page maximum (more = visual chaos)
- Used as the page's loudest single statement (purity strip on home, "every lot has a CoA" on PDP, etc.)
- Pages can opt out and stay all-cream (some pages don't need an anchor)

## Rule 10 · Deprecated tokens still present until Foundation sweeps them

During the Foundation PR's lifetime, these aliases remain valid:

- `--color-teal: var(--link); /* DEPRECATED */`
- `--font-cinzel: var(--font-display); /* DEPRECATED */`
- `--font-cormorant: var(--font-editorial); /* DEPRECATED */`

After the codemod commits (16–19) land on `main`, these aliases are removed in commit 19. Sub-projects forking AFTER Foundation lands must use the new names directly. Sub-projects forking BEFORE Foundation lands are **forbidden** (Foundation-gate rule).

---

## Foundation-gate rule

**No sub-project (B–K) cuts a feature branch off `feat/v2-overhaul` until Foundation lands on `main`.** Codex flagged the long-lived integration branch as a rebase trap: downstream branches forking off mid-codemod will inherit unstable token aliases and silently break later.

The order:

1. Foundation builds on `feat/v2-overhaul`, merges to `main`
2. After merge, sub-projects fork off the new `main`
3. Each sub-project consumes the contract above

If parallelism becomes important before Foundation lands, the right move is to compress Foundation, not start B.

---

## What's NOT in this contract

- Page layouts (each sub-project owns its own)
- Copy / brand voice rewrites (separate concern; lives in `docs/BRAND_VOICE.md`)
- Catalog data shape (sub-project B's contract)
- Product card UX (sub-project C's contract)
- Checkout flow (sub-project H's contract)

The Foundation contract is about the **shared substrate** — tokens, primitives, the asset interface. Everything else is a sub-project decision.
