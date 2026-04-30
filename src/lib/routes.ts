/**
 * Centralized route constants — handoff contract for sub-projects B–K.
 *
 * Codex Review #1 (sub-project A · Foundation) flagged that `/catalogue` is
 * hardcoded in nav, footer, JSON-LD `SearchAction`, sitemap, metadata, and
 * tests. Sub-project B will rename `catalogue → catalog`. Without this
 * module, that rename requires hunting through ~30 files.
 *
 * Foundation owns the strings here. Sub-project B changes the value of
 * `ROUTES.CATALOG` only, and propagation is automatic.
 *
 * Rule: every internal route reference in the codebase reads from `ROUTES`.
 * Hardcoded paths in components are CI-blocked.
 */
// Catalog base lives separately from the const object because builders
// below close over it. Sub-project B renames the value here in one place;
// CATEGORY / PRODUCT / STACKS / STACK derive their URLs from it (Codex
// adversarial review #2 fix P2 — builders no longer hard-code /catalogue
// and stay synchronized with CATALOG).
const CATALOG = "/catalogue";

export const ROUTES = {
  HOME: "/",
  CATALOG,
  CATEGORY: (slug: string) => `${CATALOG}/${slug}`,
  PRODUCT: (cat: string, slug: string) => `${CATALOG}/${cat}/${slug}`,
  STACKS: `${CATALOG}/stacks`,
  STACK: (slug: string) => `${CATALOG}/stacks/${slug}`,

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
  CHECKOUT_SUCCESS: "/checkout/success",

  LOGIN: "/login",
  ACCOUNT: "/account",
  ACCOUNT_ORDERS: "/account/orders",
  ACCOUNT_ORDER: (id: string) => `/account/orders/${id}`,
  ACCOUNT_SUBSCRIPTION: "/account/subscription",
  ACCOUNT_REFERRALS: "/account/referrals",
  ACCOUNT_AFFILIATE: "/account/affiliate",
  ACCOUNT_REWARDS: "/account/rewards",
  ACCOUNT_PROFILE: "/account/profile",
  ACCOUNT_SECURITY: "/account/security",
  ACCOUNT_MESSAGES: "/account/messages",
} as const;

export type Routes = typeof ROUTES;
