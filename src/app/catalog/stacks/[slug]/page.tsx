import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { POPULAR_STACKS, resolveStack } from "@/lib/catalog/stacks";
import { StackPickerForm, type StackPickerLine } from "@/components/catalog/StackPickerForm";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return POPULAR_STACKS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const stack = POPULAR_STACKS.find((s) => s.slug === slug);
  if (!stack) {
    return { title: "Stack not found", robots: { index: false } };
  }
  return {
    title: `${stack.name} · Customize and add to cart`,
    description: stack.tagline,
    alternates: { canonical: `/catalog/stacks/${stack.slug}` },
    openGraph: {
      title: `${stack.name} · Bench Grade Peptides`,
      description: stack.tagline,
      url: `/catalog/stacks/${stack.slug}`,
      type: "website",
    },
  };
}

export default async function StackPickerPage({ params }: RouteParams) {
  const { slug } = await params;
  const stack = POPULAR_STACKS.find((s) => s.slug === slug);
  if (!stack) notFound();

  const resolved = resolveStack(stack);
  // If every line was orphaned (catalog churn), 404 — better UX than an empty page.
  if (resolved.lines.length === 0) notFound();

  const pickerLines: StackPickerLine[] = resolved.lines.map(({ product, variant, line }) => ({
    product,
    defaultVariantSku: variant.sku,
    defaultQuantity: line.quantity,
  }));

  return (
    <div className="bg-paper min-h-[60vh]">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 py-8 sm:py-12 lg:py-16">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Catalog", href: "/catalog" },
            { label: "Stacks", href: "/catalog#popular-stacks" },
            { label: stack.name },
          ]}
        />

        <header className="mt-4 sm:mt-6 mb-8 sm:mb-12 border-b rule pb-6 sm:pb-10">
          <div className="label-eyebrow text-gold-dark mb-2 text-[10px] sm:text-xs">
            Customize your stack
          </div>
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl text-ink leading-[1.08] sm:leading-[1.05] mb-3 sm:mb-5">
            {stack.name}
          </h1>
          <p
            className="text-base sm:text-lg lg:text-xl italic text-ink-soft max-w-3xl leading-relaxed"
            style={{ fontFamily: "var(--font-editorial)" }}
          >
            {stack.tagline}
          </p>
          <p className="text-sm sm:text-[15px] text-ink-soft max-w-3xl mt-4 leading-relaxed">
            {stack.why}
          </p>
        </header>

        <StackPickerForm stackName={stack.name} lines={pickerLines} />

        <div className="mt-12 sm:mt-16 pt-6 border-t rule flex items-center justify-between gap-4">
          <Link
            href="/catalog#popular-stacks"
            className="text-sm text-ink-soft hover:text-wine transition-colors"
          >
            ← All popular stacks
          </Link>
          <Link
            href="/catalog"
            className="text-sm text-ink-soft hover:text-wine transition-colors"
          >
            Browse the full catalog →
          </Link>
        </div>
      </div>
    </div>
  );
}
