#!/usr/bin/env node
/**
 * Foundation codemod (sub-project A · commit 16 of 22).
 *
 * Replaces every Tailwind class containing `teal` with the corresponding
 * `gold` class across `src/**`. Codex Review #1 fix M1: portable Node
 * implementation (BSD `sed -i ''` only works on macOS; this works on
 * macOS + Linux + CI).
 *
 * Strategy:
 *   - The Foundation tokens layer made `--color-teal` a deprecation alias
 *     pointing at `--color-link` (which itself points at `--color-gold`).
 *     Existing consumers continued to render correctly through the
 *     compatibility shim. This codemod migrates the consumers to the
 *     direct `gold` token so the deprecation aliases can be deleted in
 *     commit 18.
 *
 * Patterns matched (the audit found these — see CODEX-REVIEW-1-FINDINGS):
 *   text-teal, bg-teal, border-teal, ring-teal,
 *   hover:bg-teal, hover:bg-teal-dark, hover:text-teal, hover:border-teal,
 *   focus-visible:ring-teal, focus:border-teal, focus:ring-teal,
 *   active:bg-teal, active:bg-teal-dark
 *
 * Suffix mapping:
 *   -teal      → -gold
 *   -teal-dark → -gold-dark
 *   -teal-soft → -gold-soft (preserved as-is via Tailwind v4 token system)
 *
 * Post-run, scripts/audit-codemod.sh greps for any remaining teal
 * references in src/ outside the deprecation comment whitelist.
 *
 * Usage:
 *   node scripts/codemod-teal-to-gold.mjs           # write changes
 *   node scripts/codemod-teal-to-gold.mjs --dry-run # preview only
 */

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const EXTENSIONS = new Set([".tsx", ".ts", ".css", ".mdx"]);
const EXCLUDE_DIRS = new Set(["node_modules", ".next", "dist", "build", "__tests__"]);
// Files where the deprecation aliases must remain visible until commit 18
// removes them. The codemod migrates consumers; the aliases themselves are
// removed in the next commit.
const EXCLUDE_FILES = new Set([
  "src/app/globals.css", // contains the --color-teal deprecation aliases
  "src/app/__tests__/tokens.test.ts", // asserts on those aliases
]);
const DRY_RUN = process.argv.includes("--dry-run");

// Walk a directory recursively, returning all matching file paths.
async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      out.push(...(await walk(full)));
    } else if (EXTENSIONS.has(extOf(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i) : "";
}

// Replace in-place; returns count of substitutions in the file.
function rewrite(content) {
  let count = 0;
  let out = content;
  // Order matters: match -teal-dark before -teal so the dash suffix wins.
  // Each replacer increments the counter and preserves the leading boundary
  // (\b or :) captured in $1.
  const passes = [
    [/(\b|:)teal-dark\b/g, "gold-dark"],
    [/(\b|:)teal-hover\b/g, "gold-dark"], // teal-hover semantics map to gold-dark
    [/(\b|:)teal-soft\b/g, "paper-soft"], // tinted bg → existing paper-soft
    [/(\b|:)teal\b/g, "gold"],
  ];
  for (const [pat, replacement] of passes) {
    out = out.replace(pat, (_match, boundary) => {
      count++;
      return `${boundary}${replacement}`;
    });
  }
  return { out, count };
}

async function main() {
  const files = await walk(SRC);
  let totalFiles = 0;
  let totalSubs = 0;

  for (const file of files) {
    const rel = file.replace(ROOT + "/", "");
    if (EXCLUDE_FILES.has(rel)) continue;
    const content = readFileSync(file, "utf8");
    if (!/teal/i.test(content)) continue;

    const { out, count } = rewrite(content);
    if (count === 0 || out === content) continue;

    totalFiles += 1;
    totalSubs += count;
    if (DRY_RUN) {
      console.log(`would update: ${file.replace(ROOT + "/", "")} (${count} subs)`);
    } else {
      writeFileSync(file, out);
      console.log(`updated: ${file.replace(ROOT + "/", "")} (${count} subs)`);
    }
  }

  console.log(
    `\n${DRY_RUN ? "[dry-run] " : ""}${totalSubs} substitutions across ${totalFiles} files.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
