# Bench Grade Peptides

Research-grade synthetic peptide storefront. Custom Next.js + Supabase + Resend.

## Stack

- **Next.js 16** App Router, TypeScript, Tailwind v4
- **Supabase** Postgres (products, orders, RUO acknowledgments)
- **Resend** transactional email (order confirmation, shipping)
- **Payment** ACH / wire / check (no card processing at launch)
- **Hosting** TBD (likely Vercel)

## Compliance framework

This project operates under the RUO (research-use-only) compliance framework documented at
`~/.claude/projects/-Users-ahmed-Research-Only-Peptides/memory/ruo_compliance_framework.md`.

Key protections baked into code:

- **Banned-terms linter** (`src/lib/compliance/banned-terms.ts`) — regex-scans every product page and blog post for therapeutic verbs, disease names, outcome claims, and other language FDA treats as drug-claim evidence. Hard-blocks publish on match.
- **Required-element validator** (`src/lib/compliance/required-elements.ts`) — asserts every product page renders the RUO statement, molecular data, COA link, and Terms of Sale link.
- **RUO acknowledgment audit trail** (`ruo_acknowledgments` table) — every checkout stores a timestamped, IP-logged, SHA-hashed customer certification. Retention is permanent.
- **CI lint script** (`scripts/lint-content.ts`) — run `npm run lint:content` to scan all source files before commit.

Every customer-facing surface must pass the framework before shipping. When adding product pages,
blog posts, email templates, or ad creative, run the content through `complianceLint()` first.

## Local setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Fill in Supabase URL / anon key / service role, Resend API key

# Run dev server
npm run dev
```

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — run production build locally
- `npm run lint` — ESLint
- `npm run lint:content` — RUO banned-terms scan over `src/` and `content/`

## Project structure

```
src/
├── app/              # Next.js App Router routes
│   ├── layout.tsx    # Root layout — RUO banner, header, footer
│   ├── page.tsx      # Homepage
│   ├── catalog/      # Catalog + category + product pages (TBD)
│   ├── compliance/   # Compliance / RUO explainer
│   └── terms/        # Terms of Sale
├── components/
│   └── layout/       # RUOBanner, Header, Footer
├── lib/
│   ├── compliance/   # Banned-terms linter, required-element validator, RUO statements
│   ├── supabase/     # Client factories + DB types
│   └── utils.ts      # cn, formatPrice, etc.
└── globals.css       # Tailwind v4 + design tokens

supabase/
└── schema.sql        # Full DB schema — categories, products, variants, orders, acknowledgments

scripts/
└── lint-content.ts   # CI compliance linter
```

## Design direction

Editorial "Bench Journal" aesthetic — warm paper base, near-black ink, deep teal for
data/links, oxblood reserved for the RUO banner and critical-state emphasis. Display type:
Instrument Serif. Body: Inter. Data/molecular: JetBrains Mono.

Color tokens in `src/app/globals.css`:

- `--color-paper`: `#F7F4EE` — primary background
- `--color-ink`: `#1A1A1A` — primary text
- `--color-teal`: `#0A5C7D` — data, links, trust
- `--color-oxblood`: `#7A1E1E` — RUO banner, critical-state only

---

**Bench Grade Peptides LLC** — All products for laboratory research use only. Not for human or veterinary use. Not a drug, supplement, or medical device.
