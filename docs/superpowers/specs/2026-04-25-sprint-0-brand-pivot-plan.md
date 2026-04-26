# Sprint 0 — Brand Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Pivot the entire visual system to the locked wine + gold + cream apothecary brand. Replace tokens, type stack, logo component, and shared layout components. Sprint 0 ships **before** any Sprint 1 UI work so we don't retrofit components against a stale token system.

**Architecture:** Token-level swap (Tailwind v4 `@theme` + CSS vars). New `<Logo>` component drives all brand surfaces. Cinzel + Cormorant Garamond replace Geist + Instrument Serif. Existing layout structure preserved — only styling and typography change.

**Tech Stack:** Tailwind v4 (`@theme` block), `next/font/google`, React server + client components, lucide-react icons.

**Spec source:** [2026-04-25-v1-customer-experience-design.md §16](2026-04-25-v1-customer-experience-design.md). Read §16.1 fully before starting.

**Hard prerequisite:** Logo asset files at `public/brand/*` per spec §16.1 ("Logo asset locations") MUST be on disk before Tasks 2+. Task 1 (token swap) can run in parallel without them.

---

## §A · Test plan (write before any production code)

### A.1 — Snapshot / smoke (Vitest + happy-dom for components, Claude Preview for full pages)

| ID | Subject | Behaviour |
|---|---|---|
| S-TOKEN-1 | `globals.css` | Compiled output exposes every locked token from spec §16.1 with the locked hex values |
| S-TOKEN-2 | `tailwind` | `bg-wine`, `text-gold`, `bg-paper`, `text-ink` Tailwind utilities resolve to the locked colors |
| S-FONT-1 | `layout.tsx` | Loads Cinzel, Cormorant Garamond, Inter, JetBrains Mono via `next/font/google`; CSS variables `--font-display`, `--font-editorial`, `--font-sans`, `--font-mono` are wired to `:root` |
| S-LOGO-1 | `<Logo variant="full" surface="wine"/>` | Renders with full-color asset; img `alt="Bench Grade Peptides"` |
| S-LOGO-2 | `<Logo variant="mark" surface="cream"/>` | Renders the gold-on-cream variant for cream surfaces |
| S-LOGO-3 | `<Logo variant="wordmark"/>` | Renders the wordmark-only SVG, matched to surface |
| S-LOGO-4 | `<Logo>` | Defaults: `variant="mark"`, `surface="cream"`; missing asset returns text fallback ("BENCH GRADE PEPTIDES" in Cinzel) |
| S-HEADER-1 | `<Header/>` on cream | Logo gold-on-cream, nav in Inter, signature gold underline on hover |
| S-HEADER-2 | `<Header/>` on wine | When the page sets a `--surface: wine` context, Header inverts: cream-on-wine logo, gold accents |
| S-FOOTER-1 | `<Footer/>` | Wine background, gold rules, cream text, signature laurel mark |
| S-RUOBANNER-1 | `<RUOBanner/>` | Wine background, cream Cinzel-tracked statement |
| S-CHECKOUT-REGRESSION-1 | `<CheckoutPageClient/>` | Trust strip, free-ship progress bar, next-steps timeline still render correctly with new tokens (no broken refs to `--color-oxblood` or `--color-teal`) |
| S-CART-REGRESSION-1 | `<CartDrawer/>` | Renders with new tokens; previously-applied colors swap cleanly |
| S-A11Y-1 | `<Header>`, `<Footer>`, `<RUOBanner>` | Color contrast: text-on-wine and text-on-cream both ≥ AA (4.5:1) — verified via automated check |

### A.2 — Manual verification via Claude Preview

| ID | Surface | Action |
|---|---|---|
| M-0-1 | Homepage `/` | Hero on wine surface; logo gold-on-wine; H1 in Cinzel; body in Inter; cream call-to-action button with gold border |
| M-0-2 | Catalog `/catalog` + category pages | Cream surface; product cards in cream-on-paper-soft; gold rules |
| M-0-3 | Cart drawer | Cream surface; gold accent on tier-progress; wine total |
| M-0-4 | Checkout | Cream surface; trust strip rendered with new tokens; submit button on gold accent |
| M-0-5 | RUO banner | Renders top-of-page on every route in wine + Cinzel-tracked text |
| M-0-6 | Mobile (375px) | All above legible, generous spacing preserved, logo scales |
| M-0-7 | Dark mode | Skipped for v1 — site is single-mode (we control the aesthetic) |

---

## §B · File structure

### Files to create

```
public/brand/
  logo.png                                     # full color (provided by user)
  logo-mark.svg                                # vector laurel+scientist+wordmark
  logo-mark-gold-on-cream.svg                  # alt for cream surfaces
  logo-mark-cream-on-wine.svg                  # alt for dark-mode emails
  wordmark-only.svg                            # wordmark only
  seal-mark.svg                                # seal without wordmark
  virtue-seal-honorable.svg                    # April 2026 virtue mark

src/components/brand/
  Logo.tsx                                     # MODIFIED — variant + surface props
  __tests__/Logo.test.tsx                      # S-LOGO-*

src/components/marks/
  LaurelSeal.tsx                               # NEW — inline SVG component for the laurel mark (when we want CSS-controllable)
  WaxSeal.tsx                                  # NEW — virtue/affiliate eminent seal component
```

### Files to modify

```
src/app/layout.tsx                             # font loaders + body class set
src/app/globals.css                            # @theme block + utility extensions
src/components/layout/Header.tsx               # surface-aware Logo + Cinzel nav
src/components/layout/Footer.tsx               # wine surface + gold rules
src/components/layout/RUOBanner.tsx            # wine surface + Cinzel statement
src/components/brand/Logo.tsx                  # variant/surface API
src/components/ui/Button.tsx                   # gold-accent default; wine-surface variant
src/components/ui/Card.tsx                     # paper-soft + gold rule
src/components/ui/Badge.tsx                    # gold/wine/cream variants
src/components/ui/Callout.tsx                  # token swap
src/components/catalog/ProductCard.tsx         # token swap, ensure no hardcoded oxblood/teal
src/components/cart/CartDrawer.tsx             # token swap, gold accents replace oxblood
src/app/checkout/CheckoutPageClient.tsx        # token swap (Trust strip, Next-steps, Free-ship bar already exist)
src/lib/email/templates.ts                     # Editorial wrapper helper updated to wine/gold/cream
.env.example                                   # no changes needed
```

### Files to leave untouched

- `src/lib/cart/*` (logic only)
- `src/lib/payments/*` (logic only)
- `src/lib/compliance/*` (logic only)
- `src/lib/catalog/data.ts` (catalog content)
- All `src/lib/email/__tests__/*` (templates tests will continue to pass — content unchanged, only HTML wrapper colors change; we intentionally avoid asserting on hex values in template tests)

---

## §C · Codex review checkpoint #1 (plan-level)

- [ ] **Step C.1: Invoke `codex:rescue` on this plan + spec §16**

  ```
  Read: docs/superpowers/specs/2026-04-25-v1-customer-experience-design.md (§16 in particular)
  Read: docs/superpowers/specs/2026-04-25-sprint-0-brand-pivot-plan.md
  Question: "Adversarial review of the Sprint 0 plan against the spec.
  Critical concerns:
    - Any UI component that reads hardcoded color values (e.g. text-oxblood, bg-teal) and would break when tokens swap?
    - Tailwind v4 @theme + CSS var compatibility (any v3 patterns left?)
    - Font loading: any FOUT/FOIT issues with 4 Google Fonts?
    - Logo component: file-not-found graceful degradation?
    - A11y: contrast on wine surfaces with gold rules?
  Categorize High / Medium / Low."
  ```

- [ ] **Step C.2: Resolve High and Medium findings**

- [ ] **Step C.3: Commit the resolved plan**

---

## §D · Tasks

### Task 0 — Brand asset intake (USER ACTION REQUIRED)

**Files:** `public/brand/*`

This step is the user's responsibility — Claude cannot create the artwork.

- [ ] **Step 0.1:** User saves `logo.png` (the finalized cover image they pasted) to `public/brand/logo.png`. Reference dimensions ~2400×1260.
- [ ] **Step 0.2:** User exports SVG variants from their design tool:
  - `logo-mark.svg` — full mark (gold seal + wordmark on wine — as shown in chat)
  - `logo-mark-gold-on-cream.svg` — same mark, gold detail on cream paper
  - `logo-mark-cream-on-wine.svg` — same mark, cream detail on wine (for dark email headers)
  - `wordmark-only.svg` — just the "BENCH GRADE PEPTIDES" text in the chosen serif
  - `seal-mark.svg` — laurel + scientist roundel without wordmark
  - `virtue-seal-honorable.svg` — small circular wax-seal-style mark with "HONORABLE" inside

- [ ] **Step 0.3:** Run `ls public/brand/*.svg public/brand/*.png` to confirm all assets are present before starting Task 2.

**Fallback if SVG variants are not yet produced:**

- We can ship Sprint 0 with `logo.png` only. The `<Logo>` component falls back to the PNG for `variant="full"` and renders text wordmark in Cinzel for `variant="wordmark"`. Other variants render the full PNG until SVG variants land. Add a follow-up TODO note in `src/components/brand/Logo.tsx`.

---

### Task 1 — Design tokens + font stack (Tailwind v4 + globals.css + layout.tsx)

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Test: `src/app/__tests__/tokens.test.ts` (new — pulls compiled CSS, asserts variables)

- [ ] **Step 1.1: Read existing `globals.css` to understand current `@theme` shape**

  ```bash
  cat src/app/globals.css | head -120
  ```

- [ ] **Step 1.2: Write the snapshot test for token presence (S-TOKEN-1, S-FONT-1)**

  ```ts
  // src/app/__tests__/tokens.test.ts
  import { describe, it, expect } from "vitest";
  import { readFileSync } from "node:fs";
  import { resolve } from "node:path";

  describe("globals.css design tokens", () => {
    const css = readFileSync(resolve(__dirname, "../globals.css"), "utf8");
    const tokens: Record<string, string> = {
      "--color-wine": "#4A0E1A",
      "--color-wine-deep": "#2E0810",
      "--color-gold": "#B89254",
      "--color-gold-light": "#D4B47A",
      "--color-gold-dark": "#8B6E3F",
      "--color-paper": "#FDFAF1",
      "--color-paper-soft": "#F4EBD7",
      "--color-ink": "#1A0506",
      "--color-ink-soft": "#4A2528",
      "--color-ink-muted": "#6B5350",
      "--color-rule": "#D4C8A8",
      "--color-rule-wine": "#6E2531",
    };
    for (const [token, hex] of Object.entries(tokens)) {
      it(`${token} is ${hex}`, () => {
        // Tolerant match: hex case + optional whitespace
        const re = new RegExp(`${token}\\s*:\\s*${hex.replace(/[#-]/g, "\\$&")}`, "i");
        expect(css).toMatch(re);
      });
    }
  });
  ```

- [ ] **Step 1.3: Run — should FAIL until tokens are added**

  ```bash
  npm test -- tokens.test.ts
  ```

- [ ] **Step 1.4: Update `src/app/globals.css`**

  Replace the existing `@theme` block (or extend it) with the locked tokens. Tailwind v4 reads `@theme` and exposes `bg-{name}`, `text-{name}`, `border-{name}` utilities automatically.

  ```css
  @import "tailwindcss";

  @theme {
    /* Brand colors (locked 2026-04-25) */
    --color-wine: #4A0E1A;
    --color-wine-deep: #2E0810;
    --color-gold: #B89254;
    --color-gold-light: #D4B47A;
    --color-gold-dark: #8B6E3F;
    --color-paper: #FDFAF1;
    --color-paper-soft: #F4EBD7;
    --color-ink: #1A0506;
    --color-ink-soft: #4A2528;
    --color-ink-muted: #6B5350;
    --color-rule: #D4C8A8;
    --color-rule-wine: #6E2531;
    --color-success: #3F6B47;
    --color-danger: #7A2128;

    /* Type stack — variables come from next/font/google in layout.tsx */
    --font-display: var(--font-cinzel), Georgia, serif;
    --font-editorial: var(--font-cormorant), Georgia, serif;
    --font-sans: var(--font-inter), -apple-system, sans-serif;
    --font-mono: var(--font-jetbrains-mono), ui-monospace, monospace;

    /* Radii — keep tight, premium feel */
    --radius-sm: 2px;
    --radius-md: 4px;
    --radius-lg: 8px;
  }

  /* Utility extensions */
  @layer utilities {
    .label-eyebrow {
      font-family: var(--font-sans);
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 600;
      color: var(--color-gold-dark);
    }
    .display-wordmark {
      font-family: var(--font-display);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-weight: 600;
    }
    .rule { border-color: var(--color-rule); }
    .rule-wine { border-color: var(--color-rule-wine); }
  }

  /* Wine-surface context — pages or sections that flip to wine */
  [data-surface="wine"] {
    background: var(--color-wine);
    color: var(--color-paper);
  }
  [data-surface="wine"] hr { border-color: var(--color-rule-wine); }
  [data-surface="wine"] a { color: var(--color-gold-light); }
  ```

  **Important:** remove any older oxblood/teal/oat tokens that the existing tree references — but do this AFTER Task 2 completes the component sweep, to avoid breaking the build mid-sprint. For now, leave legacy tokens in place but mark them deprecated with a `/* deprecated 2026-04-25 — sprint 0 swap */` comment.

- [ ] **Step 1.5: Update `src/app/layout.tsx` font loaders**

  Replace the Geist + Inter loaders with the new four:

  ```tsx
  import { Cinzel, Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";

  const cinzel = Cinzel({
    variable: "--font-cinzel",
    subsets: ["latin"],
    display: "swap",
    weight: ["400", "500", "600", "700"],
  });
  const cormorant = Cormorant_Garamond({
    variable: "--font-cormorant",
    subsets: ["latin"],
    display: "swap",
    weight: ["400", "500", "600", "700"],
    style: ["normal", "italic"],
  });
  const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
  const jet = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], display: "swap" });
  ```

  Update the `<html>` className to `${cinzel.variable} ${cormorant.variable} ${inter.variable} ${jet.variable}`.
  Update the `<body>` className to use the new tokens.

- [ ] **Step 1.6: Run typecheck + token tests**

  ```bash
  npx tsc --noEmit
  npm test -- tokens.test.ts
  ```

- [ ] **Step 1.7: Boot dev server and visually confirm in Claude Preview**

  Body should now render in Inter, h1/h2 in Cinzel via the existing `font-display` Tailwind class. Things will look broken in places — that's expected; Task 2 fixes them.

- [ ] **Step 1.8: Commit**

  ```bash
  git add src/app/globals.css src/app/layout.tsx src/app/__tests__/tokens.test.ts
  git commit -m "feat(brand): locked design tokens + Cinzel/Cormorant/Inter/Mono font stack"
  ```

---

### Task 2 — `<Logo>` component refresh

**Files:**
- Modify: `src/components/brand/Logo.tsx`
- Create: `src/components/brand/__tests__/Logo.test.tsx`

- [ ] **Step 2.1: Read the existing Logo component**

  ```bash
  cat src/components/brand/Logo.tsx
  ```

- [ ] **Step 2.2: Write tests (S-LOGO-1..4)**

  ```tsx
  // src/components/brand/__tests__/Logo.test.tsx
  import { describe, it, expect } from "vitest";
  import { render } from "@testing-library/react"; // or happy-dom equivalent
  import { Logo } from "../Logo";

  describe("<Logo>", () => {
    it("variant=full renders the full PNG with proper alt", () => {
      const { container } = render(<Logo variant="full" surface="wine" />);
      const img = container.querySelector("img");
      expect(img?.getAttribute("alt")).toBe("Bench Grade Peptides");
      expect(img?.getAttribute("src")).toMatch(/logo\.png/);
    });
    it("variant=mark surface=cream uses the gold-on-cream SVG", () => {
      const { container } = render(<Logo variant="mark" surface="cream" />);
      const img = container.querySelector("img");
      expect(img?.getAttribute("src")).toMatch(/logo-mark-gold-on-cream\.svg/);
    });
    it("variant=mark surface=wine uses the cream-on-wine SVG", () => {
      const { container } = render(<Logo variant="mark" surface="wine" />);
      const img = container.querySelector("img");
      expect(img?.getAttribute("src")).toMatch(/logo-mark-cream-on-wine\.svg/);
    });
    it("variant=wordmark renders an SVG", () => {
      const { container } = render(<Logo variant="wordmark" surface="cream" />);
      const img = container.querySelector("img");
      expect(img?.getAttribute("src")).toMatch(/wordmark-only\.svg/);
    });
    it("missing required props default to mark + cream", () => {
      const { container } = render(<Logo />);
      const img = container.querySelector("img");
      expect(img?.getAttribute("src")).toMatch(/logo-mark-gold-on-cream\.svg/);
    });
  });
  ```

  Add `@testing-library/react` to devDependencies if not present (or use a lighter `render`-equivalent). If we don't want React Testing Library, write the component as pure-render and assert on the JSX output via a simpler pattern.

- [ ] **Step 2.3: Implement the new `<Logo>` component**

  ```tsx
  // src/components/brand/Logo.tsx
  import Image from "next/image";

  type LogoVariant = "full" | "mark" | "wordmark" | "seal";
  type LogoSurface = "cream" | "wine";

  interface LogoProps {
    variant?: LogoVariant;
    surface?: LogoSurface;
    className?: string;
    width?: number;
    height?: number;
    priority?: boolean;
  }

  function srcFor(variant: LogoVariant, surface: LogoSurface): string {
    if (variant === "full") return "/brand/logo.png";
    if (variant === "wordmark") return "/brand/wordmark-only.svg";
    if (variant === "seal") return "/brand/seal-mark.svg";
    // variant === "mark"
    return surface === "wine"
      ? "/brand/logo-mark-cream-on-wine.svg"
      : "/brand/logo-mark-gold-on-cream.svg";
  }

  export function Logo({
    variant = "mark",
    surface = "cream",
    className,
    width = 160,
    height = 40,
    priority = false,
  }: LogoProps) {
    const src = srcFor(variant, surface);
    return (
      <Image
        src={src}
        alt="Bench Grade Peptides"
        width={width}
        height={height}
        priority={priority}
        className={className}
      />
    );
  }
  ```

- [ ] **Step 2.4: Update `next.config.ts` `images.localPatterns` to include `/brand/*.svg`**

  Current config has `/brand/vials/**`. Add `/brand/**` for `.svg` and `.png` if not already covered.

- [ ] **Step 2.5: Run typecheck + Logo tests**

- [ ] **Step 2.6: Commit**

  ```bash
  git add src/components/brand/Logo.tsx src/components/brand/__tests__/Logo.test.tsx next.config.ts
  git commit -m "feat(brand): variant + surface API for <Logo>"
  ```

---

### Task 3 — Header + Footer + RUOBanner refresh

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/Footer.tsx`
- Modify: `src/components/layout/RUOBanner.tsx`

- [ ] **Step 3.1: Update Header**
  - Replace existing logo render with `<Logo variant="mark" surface="cream" priority />`
  - Nav items in `font-display` (Cinzel) tracked at `letter-spacing: 0.12em`, font-size 13px
  - Hover state: gold-light underline 1px, 200ms ease
  - Cart button: gold accent on hover

- [ ] **Step 3.2: Update Footer to wine surface**
  - Set wrapper `bg-wine text-paper`
  - Use `<Logo variant="mark" surface="wine" />`
  - Section headings in Cinzel uppercase, size 12px, gold-light
  - Body text in Cormorant Garamond italic for the brand line
  - Hairlines in `--color-rule-wine`

- [ ] **Step 3.3: Update RUOBanner**
  - `bg-wine text-paper`
  - Statement text in Cinzel, tracked, size 11px
  - No animation (per microinteraction principle — no scrolling marquee)

- [ ] **Step 3.4: Smoke test in Claude Preview** — visit `/`, `/catalog`, `/checkout`. Confirm Header on cream, Footer on wine, RUOBanner on wine.

- [ ] **Step 3.5: Commit**

  ```bash
  git add src/components/layout/
  git commit -m "feat(brand): Header/Footer/RUOBanner pivot to wine + gold + Cinzel"
  ```

---

### Task 4 — UI primitives token sweep

**Files:**
- Modify: `src/components/ui/Button.tsx`, `Card.tsx`, `Badge.tsx`, `Callout.tsx`, `Input.tsx`, `Modal.tsx`, `Checkbox.tsx`, `Breadcrumb.tsx`, `DataRow.tsx`

For each file:
- [ ] Replace `oxblood`, `teal`, `oat`, `paper-soft` legacy tokens with the new locked tokens.
- [ ] Default Button → ink text on paper, gold-light border on hover, paper-soft pressed.
- [ ] Primary Button → wine bg, paper text, gold-light hover bg.
- [ ] Secondary Button → cream bg, ink text, gold border.
- [ ] Card → paper-soft bg, gold rule border.
- [ ] Badge → variants: `gold` (gold bg, ink text), `wine` (wine bg, paper text), `cream` (paper bg, ink text + gold rule).
- [ ] Callout `variant="ruo"` → wine surface, gold accent rule.
- [ ] Run grep `grep -rn 'oxblood\|teal\|oat' src/components/ui` to confirm no legacy refs remain.

- [ ] **Step 4.x: Commit**

  ```bash
  git add src/components/ui/
  git commit -m "feat(brand): UI primitives token sweep"
  ```

---

### Task 5 — Catalog + Cart + Checkout token sweep

**Files:**
- Modify: `src/components/catalog/ProductCard.tsx`, `ProductCarousel.tsx`, `VariantPicker.tsx`, `MolecularDataPanel.tsx`
- Modify: `src/components/cart/CartDrawer.tsx`, `CartButton.tsx`
- Modify: `src/app/checkout/CheckoutPageClient.tsx`

- [ ] Find any hardcoded color references and swap to new tokens.
- [ ] Confirm Trust strip + free-ship progress bar + next-steps timeline in CheckoutPageClient still render correctly.
- [ ] Confirm Stack & Save progress bar (when implemented in Sprint 1) plays nicely with new tokens — coordinate via shared `--color-gold` accent.

- [ ] **Step 5.x: Commit per file group**

---

### Task 6 — Email Editorial wrapper update

**Files:**
- Modify: `src/lib/email/templates.ts` (the `editorialEmailHtml` helper, used by all new emails)

- [ ] Update the wrapper HTML's inline styles to use locked palette:
  - Background: `#FDFAF1` (paper)
  - Header dark band: `#1A0506` (ink) for Apothecary direction, OR `#4A0E1A` (wine) for premium emails
  - Gold accents: `#B89254`
  - Body text: `#1A0506`
  - Rules: `#D4C8A8` (cream surface) or `#6E2531` (wine surface)

- [ ] Existing email tests pass without modification (we don't assert on hex values).

- [ ] **Step 6.x: Commit**

  ```bash
  git add src/lib/email/templates.ts
  git commit -m "feat(email): Editorial wrapper updated to locked wine + gold + cream palette"
  ```

---

### Task 7 — Homepage hero + key surfaces refresh

**Files:**
- Modify: `src/app/page.tsx`

- [ ] Hero: wine surface, big Cinzel headline ("Research peptides, made with honor."), gold rule, cream paragraph, gold-bordered CTA button.
- [ ] "Made in USA + QR-COA + Verified per lot" trust trio sits below hero, on cream surface, with gold mark icons.
- [ ] Featured products section unchanged structurally — tokens swap.
- [ ] Bottom CTA on wine surface.

- [ ] **Step 7.x: Commit**

---

## §E · UX-to-close commitments per surface

| Surface | Commitment |
|---|---|
| Header on every page | Logo loads instantly (priority); nav transitions are 200ms; gold hover underline draws attention without yelling |
| RUOBanner | Always visible top of page; wine + Cinzel feels intentional, not boilerplate disclaimer |
| Hero | Single H1, single primary CTA, no competing visual elements |
| Buttons | Gold accent on primary CTAs unmistakable; secondary buttons clearly secondary |
| Email headers | Wine + gold immediately reads "Bench Grade" — brand recognition in 1 glance |
| Footer | Wine surface signals end-of-page; restates RUO disclaimer with the same gravity as the banner |

---

## §F · Codex review checkpoint #2 (code-level)

After all tasks, full diff handed to Codex.

- [ ] Generate diff: `git diff origin/main...HEAD > /tmp/sprint-0-diff.patch`
- [ ] Invoke `codex:rescue` with diff + plan + spec §16
- [ ] Resolve High/Medium findings inline
- [ ] Re-run all checks
- [ ] Commit fixes

---

## §G · Verification before merge

- [ ] All token tests pass
- [ ] Logo tests pass
- [ ] No grep matches for `oxblood|teal|oat` in src/components or src/app
- [ ] `tsc --noEmit` clean
- [ ] `npm run lint` clean
- [ ] Manual: visit `/`, `/catalog`, `/catalog/incretin-receptor-agonists`, `/catalog/incretin-receptor-agonists/glp1s`, cart drawer, `/checkout` (with cart) — screenshots of each
- [ ] Mobile (375px) check on the same routes
- [ ] Email templates rendered (use existing test runner) and inspected as HTML files
- [ ] Codex review #2 — zero High/Medium unresolved
- [ ] PR description with screenshots before/after

---

## §H · Coordination notes for Sprint 1

Once Sprint 0 lands:
- Sprint 1 Tasks 6 (cart UI) and 11 (why-no-cards page) inherit the new tokens cleanly. No re-work needed.
- Sprint 1 Tasks 8 (login form), 9 (account claim email), 10 (portal pages) all built on the new design system.
- Sprint 1 email templates (Tasks 3, 4) ship in the new Editorial wrapper from Task 6 above.
