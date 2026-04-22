#!/usr/bin/env tsx
/**
 * Run the compliance banned-terms linter against all .tsx, .mdx, and content files.
 * Use in CI to hard-block pushes that violate the RUO compliance framework.
 *
 * Run with: `npx tsx scripts/lint-content.ts`
 */

import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

import { complianceLint } from "../src/lib/compliance/banned-terms";

const ROOT = join(process.cwd(), "src");
const EXTRA_ROOTS = ["content"].map((r) => join(process.cwd(), r));
const EXTENSIONS = new Set([".tsx", ".ts", ".mdx", ".md"]);
const EXCLUDE_DIR = new Set(["node_modules", ".next", "dist", "build"]);

async function walk(dir: string): Promise<string[]> {
  const results: string[] = [];
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIR.has(entry.name)) continue;
      results.push(...(await walk(full)));
    } else if (EXTENSIONS.has(extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  const files = [
    ...(await walk(ROOT)),
    ...(await Promise.all(EXTRA_ROOTS.map(walk))).flat(),
  ];

  // Exclude compliance source files themselves — they contain the banned terms by definition.
  const excludeFile = (p: string) =>
    p.includes("src/lib/compliance/") ||
    p.includes("scripts/lint-content.ts");

  const scanTargets = files.filter((p) => !excludeFile(p));

  let violations = 0;
  for (const file of scanTargets) {
    const content = readFileSync(file, "utf8");
    const hits = complianceLint(content);
    if (hits.length > 0) {
      violations += hits.length;
      const rel = relative(process.cwd(), file);
      console.error(`\n✗ ${rel}`);
      for (const hit of hits) {
        console.error(`  [${hit.category}] "${hit.term}" at offset ${hit.position}`);
        console.error(`    ${hit.rationale}`);
        console.error(`    context: "…${hit.context}…"`);
      }
    }
  }

  if (violations > 0) {
    console.error(`\n${violations} compliance violation(s) across ${scanTargets.length} files.`);
    console.error("See memory/ruo_compliance_framework.md §3 for the full rules.");
    process.exit(1);
  }

  console.log(`✓ ${scanTargets.length} files scanned, 0 compliance violations.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
