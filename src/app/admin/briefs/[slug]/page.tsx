import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { isAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Brief",
  robots: { index: false, follow: false },
};

const ALLOWED_SLUGS = ["morning-brief", "market-landscape", "codebase-audit"] as const;
type AllowedSlug = (typeof ALLOWED_SLUGS)[number];

function isAllowed(slug: string): slug is AllowedSlug {
  return (ALLOWED_SLUGS as readonly string[]).includes(slug);
}

export default async function BriefPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { slug } = await params;
  // Whitelist guards against directory traversal — only read the three
  // files we know about.
  if (!isAllowed(slug)) notFound();

  const filePath = path.join(process.cwd(), "research", `${slug}.md`);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    notFound();
  }

  marked.setOptions({ gfm: true, breaks: false });
  const html = await marked.parse(raw);

  return (
    <article className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-10 py-8 sm:py-10">
      <div className="mb-6">
        <Link href="/admin/briefs" className="text-xs text-teal hover:underline">
          ← All briefs
        </Link>
      </div>
      <div
        className="brief-prose"
        // `marked` returns sanitized HTML from its own markdown input —
        // the source files are author-controlled (committed in the repo),
        // not user input, so there is no untrusted-HTML vector here.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
