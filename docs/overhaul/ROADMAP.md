# Bench Grade v2 — Overhaul Roadmap

Master checklist for the full visual + functional overhaul triggered 2026-04-29. This is the source of truth for sub-project status; PRDs live under `docs/overhaul/PRD-<sub>.md`.

**Branch:** `feat/v2-overhaul` (Foundation lives here). After Foundation lands on `main`, sub-project feature branches fork off `main`, NOT off `feat/v2-overhaul`. See **Foundation-gate rule** below.

**Worktree:** `/Users/ahmed/benchgrade-v2`. Production stays untouched on `main`.

## Foundation-gate rule (added after Codex Review #1)

**No sub-project (B–K) cuts a feature branch until Foundation lands on `main`.** Codex flagged the long-lived integration branch as a rebase trap: downstream branches forking off mid-codemod inherit unstable token aliases and silently break later. The order:

1. Foundation builds on `feat/v2-overhaul`, merges to `main`
2. After merge, sub-projects fork off the new `main`
3. Each sub-project consumes the [Foundation contract](FOUNDATION-CONTRACT.md)

If parallelism becomes important before Foundation lands, compress Foundation — don't start B early.

**Mobile-first is non-negotiable** for every sub-project. Every component, page, and PRD section must be designed at 375 px first; desktop is the derivative. See `feedback_mobile_first.md` in memory.

---

## Locked decisions (Foundation brainstorm — 2026-04-29)

| | Locked |
|---|---|
| Pinyon Script | logo asset only — never live web type |
| Palette | red `#711911` · wine `#4A0E1A` · gold `#B89254` · cream `#FDFAF1` · black `#000` · grey `#DFDFDF` |
| Typography | Glacial Indifference (display + body), Montserrat (sub-display + UI), JetBrains Mono (data). Pinyon NOT loaded as a webfont. |
| Border-radius | Medium scale (12 / 16 / 24), pill CTAs at 999px. Pillow flagged as fallback. |
| Lockup | original asset intact, scaled to 180 / 280 / 320 px (nav / footer / hero) |
| Logo variants | gold (primary) · wine · red · cream · black — all on transparent. PNG-derived from chroma-keyed source; true vector deferred. |
| BG monogram | favicon + footer crest only |
| Favicon colorway | gold mark on wine field |
| Surface language | cream throughout + one gold band per page (anchor moment) |
| Gold-on-cream text | weight 700 (bumped from default 500 for legibility) |
| Default page surface | cream `#FDFAF1` |
| Primary CTA | gold pill, full-width on mobile |
| Headlines on cream | wine `#4A0E1A`; body ink `#1A1A1A`; muted warm grey |

---

## Sub-projects

Status legend: ⬜ pending · 🟡 in progress · ✅ shipped

| # | Sub-project | Status | PRD |
|---|---|---|---|
| **A** | Foundation — design tokens, fonts, logo assets, global primitives swap, mobile-first audit | ✅ shipped (pending codex #2 + user review) | `PRD-A-foundation.md` |
| **B** | Catalog data refactor — drop BAC water + syringes + Liquid category, redistribute liquid SKUs, rename "(Liquid)" out of names, "catalogue"→"catalog", finalize 9–10 categories | ⬜ | `PRD-B-catalog-data.md` |
| **C** | Catalog UI — Zara-style minimalist list, category color theming, product card refresh, hover animation | ⬜ | `PRD-C-catalog-ui.md` |
| **D** | Product detail page — Praetorian-style stepper, layout reorder, persistent add-to-cart | ⬜ | `PRD-D-product-detail.md` |
| **E** | Stack pages + Build-Your-Stack — mini product cards, fix builder landing, kill typed-quantity | ⬜ | `PRD-E-stacks.md` |
| **F** | Homepage — kill carousel, top-6 grid, hero rework | ⬜ | `PRD-F-homepage.md` |
| **G** | Cart + add-to-cart UX — pill button, confirmation animation, cart drawer polish | ⬜ | `PRD-G-cart.md` |
| **H** | Checkout — Praetorian/MyTide reference, full UI revamp | ⬜ | `PRD-H-checkout.md` |
| **I** | Founder letters — anonymous-corporate signoff using lockup | ⬜ | `PRD-I-founder-letters.md` |
| **J** | Image regeneration — re-render ~70 SKU vial photos with white powder, parametric per category colorway | ⬜ | `PRD-J-vial-images.md` |
| **K** | Vial label SVG production — parametric SVGs for the private labeler, QR-code-aware | ⬜ | `PRD-K-vial-labels.md` |

Dependency graph:
- B blocks C, D, E, J, K (catalog data must finalize first)
- A blocks all (foundation tokens are upstream)
- C, D, E, F, G can run parallel after A + B
- H must follow G
- I follows H

---

## Process per sub-project

Locked workflow (from `feedback_build_workflow.md`):

1. Brainstorm clarifying questions → answers locked to memory
2. Write PRD into `docs/overhaul/PRD-<sub>.md`
3. Self-review PRD; user approves
4. Plan code (file inventory, mobile-first viewport mocks)
5. Plan tests
6. Code
7. Test
8. Debug
9. Codex review
10. Fix
11. Land into `feat/v2-overhaul` integration branch

No shortcuts. No "just ship it." Every sub-project closes the loop.

---

## Live deferred questions / revisit flags

- **Border-radius scale** — Medium chosen, but Pillow is the fallback if Medium feels too sharp once components ship.
- **True-vector logo** — current assets are raster-derived. SVG conversion deferred until a designer can deliver a true-vector wordmark.
- **QR placement on vial labels** — three options on the table; decide during sub-project K.
- **Semantic-token migration debt** — Foundation commit 16 took the pragmatic teal → gold codemod path. Future code should prefer `text-link / bg-cta / ring-focus / text-status-info` where the role is more specific than "the gold accent." Sub-projects B–K should consume the semantic aliases directly.
- **Glacial Indifference italic** — only Regular + Bold downloaded; if a future surface needs italic, source the italic woff2 first.
- **Browser-DOM test harness** — Playwright + vitest-jsdom deferred from Foundation to a tooling sub-project. The plan-tests doc has the test inventory ready; consume when the harness lands.

## Foundation completion summary

Foundation landed 22 commits across one PR; all builds green; 662 vitest tests passing. The full atomic commit list:

1. `chore: docs + brand.ts + routes.ts + Glacial Indifference fonts`
2. `chore: extract-logo-variants.py`
3. `feat: brand assets to public/brand/`
4. `feat: convert Glacial Indifference to woff2`
5. `feat: wire next/font/local + Schema.org BRAND integration`
6. `feat: v2 design tokens — palette + semantic aliases + radius + spacing`
7. `feat: useOverlay shared hook + Overlay primitive`
8. `refactor: migrate Modal + CartDrawer onto useOverlay`
9. `feat: rebuild <Logo> with v2 variant API`
10. `feat: rebuild <Button> — gold pill primary, mobile full-width, 44px tap`
11. `feat: retheme Header — v2 lockup, side-from-left mobile drawer, 44px tap`
12. `feat: retheme Footer — BG monogram crest, v2 lockup, ROUTES + BRAND`
13. `feat: retheme RUOBanner in Montserrat`
14. `feat: retheme Callout / Breadcrumb / Input + r-input rollout`
15. `feat: <GoldBand> surface-anchor primitive`
16. `chore: codemod teal → gold across all source files`
17. `chore: remove deprecated aliases (--color-teal*, --font-cinzel/cormorant)`
18. `test: GoldBand specs + brand-asset existence assertions`
19. *(this commit)* `docs: ROADMAP shipped status`
20-22. Reserved — fold tests/audit/lint/codex-#2 fixes if needed
