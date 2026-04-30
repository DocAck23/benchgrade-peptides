import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Briefs",
  robots: { index: false, follow: false },
};

interface Brief {
  slug: string;
  title: string;
  description: string;
  priority?: boolean;
}

const BRIEFS: Brief[] = [
  {
    slug: "morning-brief",
    title: "Morning brief",
    description: "TL;DR for the founder — what shipped overnight, what needs approval, PRD shape.",
    priority: true,
  },
  {
    slug: "market-landscape",
    title: "Market landscape — deep research",
    description: "US RUO peptide competitors, supplier alternatives, SEO, branding, enforcement, pricing.",
  },
  {
    slug: "codebase-audit",
    title: "Codebase audit",
    description: "28-finding code + security + a11y audit. Blockers + highs fixed already.",
  },
];

export default async function BriefsIndexPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-10">
      <div className="mb-8">
        <Link href="/admin" className="text-xs text-gold hover:underline">
          ← Admin
        </Link>
        <div className="label-eyebrow text-ink-muted mt-4 mb-1">Briefs</div>
        <h1 className="font-display text-3xl text-ink">Overnight research + audit</h1>
        <p className="text-sm text-ink-soft mt-2">
          Rendered from <code className="font-mono-data text-xs">research/*.md</code>.
        </p>
      </div>
      <ul className="space-y-4">
        {BRIEFS.map((b) => (
          <li key={b.slug}>
            <Link
              href={`/admin/briefs/${b.slug}`}
              className={`block border rule p-5 hover:bg-paper-soft transition-colors ${
                b.priority ? "bg-paper-soft" : "bg-paper"
              }`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl text-ink">{b.title}</h2>
                  <p className="text-sm text-ink-soft mt-1">{b.description}</p>
                </div>
                {b.priority && (
                  <span className="label-eyebrow text-gold text-[10px]">Read first</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
