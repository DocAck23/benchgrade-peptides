# PRD — Custom Stack Builder + Saved Stacks

**Status:** Approved 2026-04-29.
**Owner:** Founder
**Source:** Founder request 2026-04-29 — "make this a dedicated stack builder feature. make it feel premium and fun. also, put a save named stacks for the personalization too."

---

## 1. Problem

Today /catalogue/stacks shows curated 2/3/4-vial combinations the founder pre-configured (Wolverine, GH-Axis, etc.). Customers who want a non-curated combination can drop items into the cart manually but have no way to:
- Build, see, and tune a multi-vial stack as a single unit
- **Save** their combination under a memorable name and reorder it next month
- Convert the combination into a monthly subscription with one click

The cart already supports multi-line orders + the existing 3/6/12 prepay subscription engine wraps any cart. What's missing is the surface that frames "many vials = a named stack" and persists it across sessions.

This is a high-leverage product moment because:
- Bulk buyers (the highest-LTV cohort) currently rebuild their mental list every month
- Once a stack is saved, reorder is one click — radically lower friction than re-finding 6 SKUs each time
- A named-stack culture creates social currency ("share your stack" / future v2 leaderboard)

## 2. Goals

- Customer can compose any combination of vials with size + quantity per line on a dedicated page
- Live running subtotal with Stack & Save tier preview
- Save the composition under a customer-chosen name; load any saved stack into the builder with one click
- One-click "Add full stack to cart" + optional "Make this monthly" upsell
- Anonymous customers can use the builder; saving is gated on sign-in

## 3. Non-goals (deferred to v2)

- Sharing a stack publicly (link or social)
- Per-stack analytics / "stacks ordered most this month"
- Stack templates pre-seeded by the founder (the curated stacks at /catalogue/stacks already cover this)
- Drag-and-drop reordering — vials don't have a meaningful order
- Subscription edits (subscribe-monthly happens via the existing checkout subscription_mode; managing a recurring saved stack is a v2 feature)

## 4. Spec

### 4.1 Route

- `/catalogue/stacks/build` — server component shell
- Cross-linked from:
  - `/catalogue` Popular Stacks header ("or build your own →")
  - `/account` (signed-in customers see their saved stacks + a "build a new one" CTA)

### 4.2 Layout

Two-column on lg+, stacked on mobile.

**Left column (browse panel)**
- Search input (free-text across name/SKU/molecular formula)
- Category checkbox filters (mirrors CatalogueBrowser)
- Compact product list — each row: thumbnail, name, formula, size dropdown, qty stepper, "Add to stack" button
- Tap a row to add the chosen size+qty to the building stack
- If a SKU is already in the stack, "Add to stack" turns into "+1" and stacks the quantity (no duplicate lines)

**Right column (your stack panel, sticky on lg+)**
- Hero: "Your stack" eyebrow + a customer-editable name field (default: "My custom stack")
- Selected-vials list, one row per SKU: thumbnail, name+size, qty stepper, line total, remove (×)
- Subtotal + Stack & Save tier preview ("3+ vials = 15% off applied at checkout")
- Free-shipping line ("Free domestic shipping unlocks at $150 — you're $X away")
- Two CTAs:
  - **Add to cart** — primary; drops every line into the cart
  - **Save this stack** — secondary; opens an inline name-edit + saves to `saved_stacks`. For anonymous viewers this becomes "Sign in to save" linking to /login?next=/catalogue/stacks/build with a shouldRestoreStack=1 query so the in-progress stack survives the auth round-trip (state lives in sessionStorage)
- "Make this monthly" toggle below the CTAs — hands off to checkout with `subscription_mode` pre-set

**Saved stacks rail (signed-in only)**
- Below the hero on lg+, above the browser on mobile
- Cards for each saved stack: name, vial count, total, "Load" + "Delete" buttons

### 4.3 State model

Client-side only — no server roundtrip during composition. State shape:
```ts
type BuildingStack = {
  name: string;
  lines: Array<{ sku: string; quantity: number }>;
};
```

Persisted in `sessionStorage` under `bgp.stack-builder.draft.v1` so a navigation away (sign-in flow, hit the cart, etc.) doesn't lose the composition. Cleared on successful save or successful cart-add.

### 4.4 Save flow

- Click "Save this stack"
- Inline name field becomes editable (existing name auto-populated); validation: 1-100 chars, no scripts
- Submit calls `saveStack({ name, lines })` server action
- On success: a small "Saved as 'Recovery Stack'" toast + the saved-stacks rail refreshes
- Errors surface inline (reasonable: "Name required", "Empty stack", "Up to 50 saved stacks per account")

### 4.5 Load flow

- Click "Load" on a saved stack card
- Confirmation dialog if the current builder has unsaved lines: "Replace your current stack?"
- On confirm: builder state replaced with the saved stack's lines (deep clone)

### 4.6 Limits

- Up to **20 distinct SKUs** per stack (matches existing CartLineSchema cap)
- Up to **20** quantity per SKU
- Up to **50 saved stacks** per customer (storage guardrail; not a feature limit anyone will hit early)
- Stack name: 1-100 characters

### 4.7 Premium / fun touches

- The eyebrow uses the same gold-on-cream label-eyebrow style as other premium surfaces
- Stack-name field uses the editorial italic font for a "name your creation" moment
- Adding a vial fires a subtle scale-up animation on the right panel (Tailwind `transition + scale-105` on render delay)
- Subtotal amount uses the larger mono-data face that the cart drawer uses (consistent with the brand's "exact figures, no gimmicks" positioning)
- "Stack & Save unlocked" pill appears with a soft fade when crossing 3 vials
- "Free shipping unlocked" pill at $150
- Empty-state copy is research-coded: "Your bench is empty. Pick the compounds you want stacked together."

## 5. Data model

**New table `saved_stacks`:**
- `id` uuid PK
- `user_id` uuid FK auth.users on delete cascade
- `name` text CHECK length 1-100
- `lines` jsonb — array of `{ sku: text, quantity: int }`. Validated by the server action's Zod schema; DB just stores blobs.
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()
- Unique index `(user_id, name)` so a customer can't accidentally save two stacks under the same name

RLS:
- `customers_read_own_saved_stacks` — select where user_id = auth.uid()
- `customers_insert_own_saved_stacks` — insert with check user_id = auth.uid()
- `customers_update_own_saved_stacks` — update where + with check user_id = auth.uid()
- `customers_delete_own_saved_stacks` — delete where user_id = auth.uid()

## 6. Server actions

`saveStack(input: { name, lines, id? })` — id optional for updating an existing saved stack vs creating new. Service-role write, double-RLS-checked. Validates SKUs against the catalog before persistence (rejects unknown SKUs with a clear error).

`listMyStacks(): SavedStackRow[]` — cookie-scoped read; empty array for anonymous.

`deleteSavedStack(id)` — service-role delete with `where user_id = auth.uid()` filter as belt-and-suspenders even though RLS already gates.

## 7. Test plan

- Save flow: valid name + lines → row in `saved_stacks`, returned id matches
- Save with empty lines → rejection
- Save with unknown SKU → rejection
- Save with 21+ distinct SKUs → rejection
- Save same name twice → unique violation surfaced as "You already have a stack named X"
- List: returns only the caller's rows
- Delete: only removes the caller's row; calling with someone else's id returns "not found"
- RLS: anonymous client cannot read/write `saved_stacks`
- Builder client: add same SKU twice → quantity increments on existing line, no duplicate row
- Builder client: sessionStorage round-trip survives a sign-in detour

## 8. Risks

- **Name-collision UX** — if a customer saves three stacks all called "Recovery", the unique index throws on the second. We surface a friendly "You already have a stack named 'Recovery' — pick a different name or rename the existing one." Validated in tests.
- **Stale catalog** — a saved stack pinned to a SKU we later retire. Mitigation: on `loadSavedStack`, filter out any SKU not in the current catalog and surface "X items in this stack are no longer available — they were skipped." Don't fail the whole load.
- **Quantity drift** — saved stack has qty 30 of a SKU, the cart-line cap is 20. Mitigation: clamp on load, surface "Quantity reduced to 20 (per-line max)."

## 9. Build sprints

Single sprint, codex-reviewed:
- B1 — migration 0030
- B2 — server actions
- B3 — StackBuilder client component
- B4 — page route
- B5 — cross-links from /catalogue
- B6 — tests
- B7 — codex review
- B8 — apply migration + push

## 10. Definition of Done

- [ ] /catalogue/stacks/build renders for both anon and signed-in users
- [ ] Anon user can build, add to cart, but cannot save (sign-in CTA shown)
- [ ] Signed-in user can save, load, delete saved stacks
- [ ] sessionStorage round-trip survives sign-in
- [ ] Codex review passed
- [ ] Migration 0030 applied to live Supabase
- [ ] All existing tests + new builder tests green
- [ ] Mobile: builder is fully usable on a 375px viewport
