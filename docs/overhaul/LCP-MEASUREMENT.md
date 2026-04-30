# LCP Measurement — to do before commit 9

Codex Review #1 caught that `priority` / preload should target the actual LCP element, not the logo by default.

**Action required before Foundation commit 9 (Logo component):**

1. Run `npm run dev` against current `main` (or against `feat/v2-overhaul` after commits 1–8 land but before 9 modifies the Logo).
2. Chrome DevTools → Performance panel → record a hard reload of `/` at 375 px viewport with throttling: Slow 4G, 4× CPU.
3. Inspect the trace. Find the `Largest Contentful Paint` entry. Note the element node.
4. Repeat at 1280 px viewport (different LCP element is possible on desktop).
5. Document below.

## Hypothesis (educated guess pending measurement)

Likely candidates by viewport:

- **375 px mobile:** the hero `<h1>` text node — large, rendered server-side, above the fold. NOT the logo (only ~180 px wide, eclipsed by hero copy).
- **1280 px desktop:** either the hero `<h1>` or the `PopularStacksHeroGrid` first product image — depends on render order and image size.

If the hypothesis holds, Foundation:

- Logo gets standard image loading, NO `priority` attribute
- Hero `<h1>` requires no special handling (it's text)
- If the LCP turns out to be a product image in the popular-stacks grid, the FIRST product image gets `priority` (handled by sub-project F when the carousel is replaced)

## Measured (TBD)

> 375 px LCP: _<element>_ at _<time>ms_
>
> 1280 px LCP: _<element>_ at _<time>ms_
>
> Conclusion: _<does logo get priority?>_

Update this section once measured. Then update Foundation commit 9 (`Logo` component) accordingly.
