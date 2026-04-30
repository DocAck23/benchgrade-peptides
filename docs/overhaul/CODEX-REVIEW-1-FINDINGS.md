# Codex Adversarial Review #1 — Findings + Fix Plan

Codex output captured 2026-04-29 against the four Foundation planning docs (`ROADMAP.md`, `PRD-A-foundation.md`, `PLAN-CODE-A-foundation.md`, `PLAN-TESTS-A-foundation.md`). Tokens used: ~732k.

The full session ID: `019ddc44-fea4-7fc0-a8f8-5e021d5a7286`.

This document mirrors codex's prioritized findings and the **concrete fix** I'm rolling into the plan revisions in the next commits. Every CRITICAL and HIGH gets resolved here; MEDIUM and LOW are listed and addressed.

---

## CRITICAL

### C1 · Test plan is not executable

Codex: `vitest.config.ts` runs `environment: "node"`. No Testing Library, no jsdom, no happy-dom. The plan-tests doc claims `getComputedStyle`, `Tab` cycling, `aria-expanded` toggling, and viewport-based layout assertions in Vitest — currently fiction.

**Fix:**
- Re-classify every test in PLAN-TESTS into one of three buckets:
  1. **Pure unit (vitest, node):** prop forwarding, render output structure, src/alt attribute checks (`<Logo>` variant resolution, `<Button>` className composition, etc.).
  2. **Component DOM (vitest + jsdom + @testing-library/react):** focus management, aria attributes, keyboard interaction, click handlers.
  3. **Browser smoke (Playwright):** computed style, viewport layout, focus traps under real iOS Safari, scroll-lock, FOUC absence.
- Add `vitest.dom.config.ts` with `environment: "jsdom"` and `@testing-library/react`. Keep the existing `vitest.config.ts` for fast unit tests.
- Add Playwright as a dev dep. One smoke spec covers home + login + add-to-cart + account + checkout-paywall page across 375 / 768 / 1280 viewports — the revenue-critical flows codex flagged.
- PLAN-TESTS gets rewritten section by section against the new classification.

### C2 · Token-rename-vs-update-in-place is a silent-rebase trap

Codex: `--color-teal` carries real semantics across 47 files (links, focus rings, admin "ready/confirmed", info surfaces). Just remapping its value to gold compiles cleanly while changing behavior invisibly. Downstream branches rebasing onto the new value will silently inherit the visual change without realising the semantic mapping has shifted.

**Fix:**
- Introduce **semantic v2 aliases** as an additive layer first:
  - `--link: var(--color-gold)` (was `--color-teal` for links)
  - `--link-hover: var(--color-gold-dark)`
  - `--focus: var(--color-gold)` (focus rings)
  - `--status-info: var(--color-wine)` (info badges, "ready" badges)
  - `--status-success: var(--color-green)` (if exists; otherwise a new green token for success states)
  - `--cta: var(--color-gold)` (primary buttons)
- Codemod consumers from `text-teal`/`bg-teal`/`border-teal`/`ring-teal` etc. to **the semantic aliases**, not directly to `text-gold`/`bg-gold`. So `text-teal` (a link) becomes `text-link`, but `text-teal` on a "ready" badge becomes `text-status-info`.
- This requires **classifying each teal hit by semantic role first**, not blind sed.
- Legacy `--color-teal` stays as a deprecated alias mapped to `var(--link)` until every file is migrated.

### C3 · Codemod is incomplete; the zero-hit gate is false

Codex confirmed via `rg`: repo has `ring-teal`, `hover:bg-teal-dark`, `var(--color-teal)`, test expectations, and comments that my three-pattern grep misses.

**Fix:**
- Replace the three regex patterns with an **exhaustive classification step**:
  ```bash
  rg -n "teal" src > /tmp/teal-audit.txt
  ```
  Walk every hit, label as: `link | focus | hover | status-info | status-success | cta | comment | test-fixture | other`, then codemod by class label.
- CI gate: after migration, **any** `rg "teal" src` hit must be on a whitelist (e.g., a code comment that legitimately names the legacy token in a deprecation notice). New non-whitelisted hits fail CI.

### C4 · Build sequence has broken intermediate commits

Codex: splitting "swap assets/fonts" from "cleanup consumers" guarantees a broken intermediate commit. Old asset names + old font vars are consumed in `src/app/layout.tsx`, `src/app/apple-icon.tsx`, `src/app/opengraph-image.tsx`, `src/lib/email/templates.ts`.

**Fix — compatibility-first ordering:**
1. Add new assets, fonts, **and aliases** (legacy tokens stay valid)
2. Update all consumers to read aliases / new asset paths
3. Codemod to semantic v2 names
4. Remove legacy aliases as the **last** commit

Each commit independently builds and passes existing tests.

### C5 · Brand metadata is duplicated in 7+ places

Codex: brand description + logo URL appear in root metadata, page metadata, OG tags, Twitter cards, JSON-LD, OG-image, apple-icon, and email templates. Changing one leaves the others stale.

**Fix:**
- New module: `src/lib/brand.ts`
  ```ts
  export const BRAND = {
    name: "Bench Grade Peptides",
    legalName: "Bench Grade Peptides LLC",
    description: "Synthesized in Tampa. Vialed in Orlando. HPLC-verified per lot. CoA on every vial. For laboratory research use only.",
    logoUrl: "/brand/logo-gold.png",
    monogramUrl: "/brand/bg-monogram.png",
    address: { ... },
  } as const;
  ```
- Migrate `layout.tsx`, page-level metadata, JSON-LD, OG-image generator, apple-icon, email templates, contact page to read from this module.
- Add `src/lib/__tests__/brand.test.ts` snapshot to lock the contract.

---

## HIGH

### H1 · Mobile drawer needs a shared overlay primitive, not a third bespoke trap

Codex: `CartDrawer` and `Modal` already have custom focus-trap + scroll-lock. Adding a third in Header guarantees inconsistent Escape, focus restore, and stacked-overlay bugs.

**Fix:**
- Extract `useOverlay(open: boolean, options: { closeOnEscape?, restoreFocus?, lockScroll? })` hook. Both existing components migrate to it; new mobile drawer consumes it.
- Hook implements **ref-counted scroll lock** (multiple overlays can stack — cart open over nav drawer, etc.) instead of `document.body.style.overflow = "hidden"`.
- Hook implements **focus trap with focus-restore** (records active element on open, restores on close).
- Document the contract in `src/components/ui/Overlay.tsx` adjacent to the hook.

### H2 · Mobile drawer pattern is unspecified

Codex: full-screen vs side drawer vs top sheet — PRD doesn't say. Drawer semantics also missing (dialog role, labelled-by, scrim, safe-area, close behavior).

**Fix — lock the pattern in the PRD:**
- **Side drawer from left**, full height, 80% viewport width capped at 320px.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the nav heading.
- Scrim: cream `rgba(0,0,0,0.42)`, click-to-close.
- Safe-area: `padding-top: env(safe-area-inset-top)`.
- Close affordance: × button top-right ≥ 44 × 44 px, plus Escape key.
- Animation: 240 ms ease-out slide; respects `prefers-reduced-motion`.

### H3 · Scope drift — GoldBand placements, footer-copy changes, JSON-LD description rewrites

Codex: PRD says "layout/IA stays as-is" then plans GoldBand drops on home/PDP, footer-tagline rewrite, schema description change.

**Fix:**
- Foundation **ships** the GoldBand primitive, but does **not place** it on any page. F/D inject placements.
- Footer tagline change: keep within Foundation only because the existing tagline references Cormorant which gets removed; rewrite is therefore necessary.
- JSON-LD / schema description change: pulled from `src/lib/brand.ts` (centralized, see C5). The description value itself is updated as part of the brand voice work — Foundation owns the description rewrite because it lives in the brand module.

### H4 · Handoff contract to B–K is missing

Codex: `/catalogue` is hardcoded in nav, footer, SearchAction (in `layout.tsx` JSON-LD), tests, and metadata. B plans `catalogue` → `catalog`. Without route constants, that's churn.

**Fix:**
- New: `src/lib/routes.ts` with `ROUTES.CATALOG`, `ROUTES.RESEARCH`, etc. Foundation values stay at `/catalogue` (B handles the rename); Foundation just centralizes the strings.
- Header, Footer, JSON-LD, sitemap, all meta — codemod to read from `ROUTES`.
- Foundation contract documented at `docs/overhaul/FOUNDATION-CONTRACT.md`: allowed tokens, allowed primitives, deprecated aliases, forbidden raw asset paths.

### H5 · Branch strategy maximizes rebase damage on a long-lived integration branch

Codex: a global codemod landing late on a long-lived branch means every downstream branch forks from unstable aliases and explodes later.

**Fix:**
- Foundation merges to `main` directly (or to a v2 integration branch that is **rebased frequently against main**).
- Sub-projects B–K **don't fork until Foundation is on main**. ROADMAP gets a "Foundation gate" — no parallel branches before Foundation lands.

### H6 · `next/font/local` with `.woff2`, not raw `@font-face` with `.otf`

Codex: local docs in this repo's `node_modules/next/dist/docs` recommend `next/font/local` for self-hosted fonts. The plan uses `@font-face` declarations in `globals.css` with `.otf` files.

**Fix:**
- Convert `.otf` → `.woff2` using `fonttools` or an online converter. Smaller, better HTTP/2 handling.
- Use `next/font/local`:
  ```ts
  import localFont from "next/font/local";
  const glacialIndifference = localFont({
    src: [
      { path: "../public/fonts/glacial-indifference/GlacialIndifference-Regular.woff2", weight: "400" },
      { path: "../public/fonts/glacial-indifference/GlacialIndifference-Bold.woff2", weight: "700" },
    ],
    variable: "--font-glacial",
    display: "swap",
    adjustFallback: "Arial",
  });
  ```
- Remove the manual `@font-face` block from `globals.css`.

### H7 · `font-display: swap` allows the FOUC the plan promises to prevent

Codex: `swap` shows fallback then swaps to final. That's a guaranteed visible font-shift, not "no FOUC."

**Fix:**
- Acknowledge `swap` semantics in the plan.
- Use `next/font/local`'s `adjustFallback` to size-match the fallback (Arial) to Glacial Indifference, minimizing CLS on the swap.
- Drop the "no FOUC" acceptance criterion; replace with "no CLS > 0.05 on the font swap."

### H8 · Font preload scope conflicts with global usage

Codex: "preload only on home page" + "global body face" can't coexist. If it's loaded in root layout, it's sitewide.

**Fix:** drop the home-only preload claim. Glacial loads via `next/font/local` in root layout — preloaded automatically by next/font as appropriate.

### H9 · LCP measurement before priority hint

Codex: a preloaded nav logo is not automatically the LCP. Hero text or hero image is more likely.

**Fix:**
- Add a **pre-Foundation step**: measure current LCP on the live site (Chrome DevTools / WebPageTest) and document the LCP element.
- Apply `priority` to the **measured LCP element**, not the logo by default. The logo gets `priority` only if it actually is the LCP (unlikely on most pages).

### H10 · 5 PNG logo variants are a maintenance tax

Codex: repo already has SVG brand assets. Multiplying raster colourways is the wrong default.

**Fix:**
- Investigate whether the source `Bench Grade-2/1.svg` (raster-embedded) can be repackaged as a true vector. Likely not — it's a raster wrapped in SVG.
- For wordmark on web: ship the **gold metallic PNG** as the primary (it preserves the metallic gradient that a flat SVG would lose). Ship a **single solid-color SVG** with `fill="currentColor"` for non-metallic variants. The `<Logo>` component picks: gold-metallic-png OR single-svg-with-current-color, based on variant prop.
- This eliminates 4 of the 5 PNG variants.

### H11 · No browser smoke coverage for revenue-critical flows

Codex: login, cart, checkout, account-menu, admin all depend on the primitives being changed.

**Fix:** Playwright smoke spec (added in C1) covers:
- Home loads at 375 / 768 / 1280
- Login renders, magic-link form submittable
- Add-to-cart → cart drawer opens → checkout entry navigable
- Account dashboard renders with logged-in state
- Admin login renders (no need to test admin internals)

Run on every commit in the build sequence.

---

## MEDIUM

### M1 · `sed -i ''` is BSD-only

Codex: macOS contributor + Linux CI = different behavior or hard failures.

**Fix:** replace shell sed with a Node script (`scripts/codemod-teal-to-semantic.mjs`) that uses `fs.readFileSync` + regex replace + `fs.writeFileSync`. Portable, reviewable, dry-run flag.

### M2 · `--color-teal: var(--color-gold)` does not preserve intent

Codex: teal currently means links / focus / info / "ready". Mapping all of those to gold collapses the semantics.

**Fix:** addressed in C2 — use semantic v2 aliases (`--link`, `--focus`, `--status-info`).

### M3 · Radius scale under-specified for controls

Codex: 16 px radius on 44 px inputs with 12 px small text is bloated and wastes horizontal space in dense forms.

**Fix:**
- Add `--r-input: 10px` (between sm and md).
- All form `<input>`, `<select>`, `<textarea>` use `--r-input`. Cards stay at `--r-md = 16px`.
- Validate on login, checkout, admin at 320 / 375 px.

### M4 · Tap-target audit already failing in live code

Codex: HeaderAccountSlot avatar is 32 px; hamburger is ~40 px; CartButton has no guaranteed 44 px minimum.

**Fix:**
- Foundation enforces `min-w-[44px] min-h-[44px]` on every header interactive (accountSlot, hamburger, CartButton).
- Add Playwright smoke check that asserts these dimensions.

### M5 · Dark-mode strategy

Codex: `globals.css` already has `color-scheme: light`. Document the decision explicitly.

**Fix:** add to PRD §0 / brand voice doc: **light-only by design**. No dark-mode media-query handling. Future dark-mode work is out of scope and explicitly deferred.

### M6 · Email templates already use system stacks

Codex: `src/lib/email/templates.ts` already uses inline system-safe stacks (no Cinzel/Cormorant references). The plan's "convert to system stack" task is misinformed.

**Fix:** drop the email-templates change from the file inventory. They don't need touching.

### M7 · Favicon should use Next file conventions

Codex: Next 16 handles `favicon`/`icon`/`apple-icon` via file conventions in `app/`. Manual `<link>` is desync-prone.

**Fix:** rely on `app/icon.tsx` and `app/apple-icon.tsx`. Remove planned manual `<link>` injection in `layout.tsx`.

### M8 · Docs stale: Glacial fonts already exist in worktree

Codex: PRD prerequisite says missing, worktree has them at `public/fonts/glacial-indifference/`.

**Fix:** update PRD §11 and the prerequisite section: path B (I downloaded them) is **done**. Files committed alongside §4.1. Italic still missing.

### M9 · File inventory ungrounded — `src/app/page.tsx` doesn't render `<Logo>`

Codex: Header renders `<Logo>`, not page.tsx.

**Fix:** drop `src/app/page.tsx` from the modified-files list. Header is already in the list.

---

## LOW

### L1 · Glacial italic specced but only Regular + Bold downloaded

Fix: drop italic from spec. Footer tagline uses Glacial Regular.

### L2 · `import { Image } from "next/image"` is wrong

Fix: corrected in PLAN-CODE — `import Image from "next/image";`.

### L3 · "Font CORS" is mostly noise

Fix: removed from PLAN-CODE risk list.

---

## Plan revision summary

The fixes above will be applied to:

- **PRD-A-foundation.md** — full revision: §0 light-mode declaration, §3 add semantic aliases, §4.2 strategy reset, §4.3 single-SVG variant, §4.4 mobile drawer pattern lock + 44 px tap-target enforcement + shared overlay hook, §4.7 portable codemod script + classification step, §9 compatibility-first build sequence, §11 prerequisites updated, new §12 Foundation contract reference
- **PLAN-CODE-A-foundation.md** — full revision: brand.ts module, routes.ts module, useOverlay hook, single-SVG logo strategy, classified codemod targets, drop email/page changes
- **PLAN-TESTS-A-foundation.md** — full revision: three test buckets (vitest-node, vitest-jsdom, Playwright), browser smoke checklist for revenue flows, drop fictional computed-style assertions from unit tests
- **ROADMAP.md** — add Foundation-gate rule (no parallel branches until Foundation lands on main)
- **New: docs/overhaul/FOUNDATION-CONTRACT.md** — allowed tokens, primitives, asset paths, deprecated aliases

Total time to revise: ~30 minutes. Then we run the revised plans past codex once more (lighter pass — just verify the fixes, not full re-review), and proceed to code.
