import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES, PRODUCTS } from "@/lib/catalogue/data";
import { createServerSupabase } from "@/lib/supabase/client";
import { listMyStacks } from "@/app/actions/saved-stacks";
import { StackBuilder } from "@/components/catalogue/StackBuilder";

export const metadata: Metadata = {
  title: "Build your stack · Bench Grade Peptides",
  description:
    "Compose a custom multi-vial research stack and save it for one-click reorder. Stack & Save tier discount applied automatically at 3+ vials.",
  alternates: { canonical: "/catalogue/stacks/build" },
};

/**
 * Custom stack builder. Server shell handles auth detection +
 * initial saved-stack fetch; the building UX itself is a client
 * component (state + sessionStorage + interactive selectors).
 *
 * Anonymous customers can build and add to cart. Save is gated on
 * sign-in — the StackBuilder routes them through /login?next=… so
 * they land back here after auth, sessionStorage preserves the
 * in-progress composition.
 */
export default async function StackBuilderPage() {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  const isAuthed = Boolean(user);

  // Best-effort initial load. listMyStacks is RLS-scoped, so an
  // anon viewer always gets [] back.
  const savedStacksResult = isAuthed ? await listMyStacks() : null;
  const initialSavedStacks = savedStacksResult?.ok
    ? savedStacksResult.stacks
    : [];

  // Filter the catalog to the products that can land in a stack.
  // Skip supplies (syringes / draw needles) — those go in via the
  // bundle CTA after the stack is in cart.
  const products = [...PRODUCTS];

  return (
    <main className="max-w-7xl mx-auto px-6 lg:px-10 py-10 lg:py-14">
      <header className="mb-8 lg:mb-12">
        <nav
          aria-label="Breadcrumb"
          className="font-mono-data text-[11px] text-ink-muted mb-4"
        >
          <Link
            href="/catalogue"
            className="hover:text-ink underline-offset-2 hover:underline"
          >
            Catalogue
          </Link>
          <span className="mx-2">›</span>
          <Link
            href="/catalogue#popular-stacks"
            className="hover:text-ink underline-offset-2 hover:underline"
          >
            Stacks
          </Link>
          <span className="mx-2">›</span>
          <span className="text-ink">Build your own</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="label-eyebrow text-gold-dark mb-2 text-[11px]">
              Custom stack builder
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-ink leading-tight">
              Compose your own stack.
            </h1>
            <p
              className="mt-3 text-[15px] sm:text-base italic text-ink-soft leading-relaxed max-w-xl"
              style={{ fontFamily: "var(--font-editorial)" }}
            >
              Pick any combination of compounds at any size and quantity. Name
              it, save it, reorder it next month with one click.
            </p>
          </div>
          <div className="text-right text-[11px] text-ink-muted leading-relaxed max-w-[18rem]">
            <p className="font-display uppercase tracking-[0.1em] text-gold-dark mb-1">
              How it stacks
            </p>
            <p>
              3+ vials → Stack &amp; Save tier discount applies automatically.
              <br />
              $150+ → free domestic shipping.
            </p>
          </div>
        </div>
      </header>

      <StackBuilder
        products={products}
        categories={[...CATEGORIES]}
        isAuthed={isAuthed}
        initialSavedStacks={initialSavedStacks}
      />
    </main>
  );
}
