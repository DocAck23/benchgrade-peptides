#!/usr/bin/env node
/**
 * Build standalone styled HTML from every research/*.md brief so they
 * can be opened directly in a browser without the Next.js server.
 *
 *   node scripts/build-briefs.mjs
 *
 * Output: research/*.html next to each source .md.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "research");

const TITLES = {
  "morning-brief": "Morning brief — Bench Grade Peptides",
  "market-landscape": "Market landscape — Bench Grade Peptides",
  "codebase-audit": "Codebase audit — Bench Grade Peptides",
};

const DESCRIPTIONS = {
  "morning-brief": "TL;DR, what shipped overnight, six decisions for the founder.",
  "market-landscape": "Deep research on US RUO peptide market, competitors, suppliers, SEO, pricing.",
  "codebase-audit": "28-finding code + security + a11y audit. All blockers and highs fixed.",
};

function shell({ title, description, body, others }) {
  const nav = others
    .map(
      (o) =>
        `<a href="${o.href}"${o.current ? ' aria-current="page"' : ""}>${o.label}</a>`
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<style>
  :root {
    --paper: #f7f4ee;
    --paper-soft: #efeae1;
    --rule: #d7d1c4;
    --ink: #1a1a1a;
    --ink-soft: #4a4a4a;
    --ink-muted: #6b6b6b;
    --teal: #0a5c7d;
    --teal-hover: #084a65;
    --oxblood: #7a1e1e;
    --geist: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    --mono: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root { /* keep brand paper even in dark — this is an editorial doc */ }
  }
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font: 15px/1.65 var(--geist);
  }
  .bar {
    background: var(--oxblood);
    color: var(--paper);
    font: 11px/1.5 var(--mono);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-align: center;
    padding: 8px 16px;
  }
  .topnav {
    display: flex;
    align-items: baseline;
    gap: 20px;
    padding: 20px max(16px, calc((100vw - 720px) / 2));
    border-bottom: 1px solid var(--rule);
    flex-wrap: wrap;
  }
  .topnav .wordmark {
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink);
    text-decoration: none;
    margin-right: auto;
  }
  .topnav a {
    color: var(--teal);
    text-decoration: none;
    font-size: 13px;
    padding: 6px 10px;
    border-radius: 2px;
  }
  .topnav a:hover { background: var(--paper-soft); }
  .topnav a[aria-current="page"] {
    background: var(--ink);
    color: var(--paper);
  }
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px max(20px, calc((100vw - 720px) / 2)) 72px;
  }
  main h1 {
    font-size: 34px;
    line-height: 1.1;
    letter-spacing: -0.01em;
    margin: 0 0 20px 0;
  }
  main h2 {
    font-size: 22px;
    line-height: 1.25;
    margin: 48px 0 12px 0;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--rule);
  }
  main h3 {
    font-size: 17px;
    line-height: 1.3;
    margin: 36px 0 6px 0;
  }
  main h4 {
    font-size: 14px;
    font-weight: 600;
    margin: 28px 0 4px 0;
  }
  main p { margin: 14px 0; }
  main a {
    color: var(--teal);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  main a:hover { color: var(--teal-hover); }
  main strong { color: var(--ink); font-weight: 600; }
  main em { font-style: italic; }
  main code {
    font-family: var(--mono);
    font-size: 0.86em;
    background: var(--paper-soft);
    padding: 2px 5px;
    border-radius: 2px;
  }
  main pre {
    font-family: var(--mono);
    font-size: 12.5px;
    background: var(--paper-soft);
    border: 1px solid var(--rule);
    padding: 14px 16px;
    overflow-x: auto;
    line-height: 1.55;
    border-radius: 2px;
  }
  main pre code {
    background: transparent;
    padding: 0;
    font-size: inherit;
  }
  main ul, main ol {
    margin: 14px 0;
    padding-left: 24px;
  }
  main ul { list-style: disc outside; }
  main ol { list-style: decimal outside; }
  main li { margin: 6px 0; }
  main li > p { margin: 4px 0; }
  main blockquote {
    border-left: 3px solid var(--teal);
    padding: 4px 16px;
    color: var(--ink-soft);
    font-style: italic;
    background: var(--paper-soft);
    margin: 14px 0;
  }
  main hr {
    border: 0;
    border-top: 1px solid var(--rule);
    margin: 40px 0;
  }
  main table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
    margin: 16px 0;
  }
  main th, main td {
    border: 1px solid var(--rule);
    padding: 9px 12px;
    text-align: left;
    vertical-align: top;
  }
  main th { background: var(--paper-soft); font-weight: 600; }
  main img { max-width: 100%; height: auto; display: block; margin: 16px 0; }
  footer {
    max-width: 720px;
    margin: 0 auto;
    padding: 24px max(20px, calc((100vw - 720px) / 2));
    border-top: 1px solid var(--rule);
    color: var(--ink-muted);
    font-size: 12px;
  }
  @media (max-width: 560px) {
    main h1 { font-size: 28px; }
    main h2 { font-size: 19px; }
    .topnav { gap: 8px 14px; }
    .topnav .wordmark { flex: 1 1 100%; margin-right: 0; }
  }
</style>
</head>
<body>
<div class="bar">BENCH GRADE PEPTIDES · internal brief · not for distribution</div>
<nav class="topnav">
  <a class="wordmark" href="./morning-brief.html">Bench Grade · Briefs</a>
  ${nav}
</nav>
<main>${body}</main>
<footer>Generated ${new Date().toISOString().slice(0, 10)} from <code>${escapeHtml(path.relative(ROOT, DIR))}/*.md</code>. Rebuild: <code>node scripts/build-briefs.mjs</code>.</footer>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function main() {
  marked.setOptions({ gfm: true, breaks: false });
  const files = (await readdir(DIR))
    .filter((f) => f.endsWith(".md"))
    .sort();

  const slugs = files.map((f) => f.replace(/\.md$/, ""));

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const src = await readFile(path.join(DIR, file), "utf8");
    const body = await marked.parse(src);
    const others = slugs.map((s) => ({
      href: `./${s}.html`,
      label: TITLES[s]?.split("—")[0].trim() ?? s,
      current: s === slug,
    }));
    const html = shell({
      title: TITLES[slug] ?? slug,
      description: DESCRIPTIONS[slug] ?? "",
      body,
      others,
    });
    const outPath = path.join(DIR, `${slug}.html`);
    await writeFile(outPath, html, "utf8");
    console.log(`wrote ${path.relative(ROOT, outPath)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
