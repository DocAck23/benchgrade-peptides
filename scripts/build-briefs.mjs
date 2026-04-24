#!/usr/bin/env node
/**
 * Build standalone, pretty HTML for each research/*.md brief.
 * Opens cleanly from Finder via `open research/morning-brief.html`.
 *
 * Typography: Inter for body, Geist-ish display at larger sizes,
 * JetBrains Mono for code. All loaded from Google Fonts so the file
 * looks the same no matter what's installed locally.
 *
 * Run:   node scripts/build-briefs.mjs
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "research");

const TITLES = {
  "morning-brief": "Morning brief",
  "market-landscape": "Market landscape",
  "codebase-audit": "Codebase audit",
};

const SUBTITLES = {
  "morning-brief": "What shipped overnight · six decisions waiting for you",
  "market-landscape": "Deep research on the US RUO peptide market",
  "codebase-audit": "28-finding code + security + accessibility audit",
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64);
}

// Wrap every H2 with an anchor link for the sidebar TOC.
function extractToc(html) {
  const toc = [];
  const augmented = html.replace(
    /<h2>([\s\S]*?)<\/h2>/g,
    (_m, inner) => {
      const plain = inner.replace(/<[^>]+>/g, "").trim();
      const id = slugifyHeading(plain);
      toc.push({ id, label: plain });
      return `<h2 id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${inner}</h2>`;
    }
  );
  return { html: augmented, toc };
}

function shell({ slug, body, toc, others }) {
  const title = TITLES[slug] ?? slug;
  const subtitle = SUBTITLES[slug] ?? "";
  const tocHtml =
    toc.length === 0
      ? ""
      : `<nav class="toc" aria-label="Table of contents">
          <div class="toc-label">Contents</div>
          <ol>${toc
            .map((t) => `<li><a href="#${t.id}">${escapeHtml(t.label)}</a></li>`)
            .join("")}</ol>
        </nav>`;
  const docNav = others
    .map(
      (o) =>
        `<a href="${o.href}"${o.current ? ' class="is-current" aria-current="page"' : ""}>${escapeHtml(o.label)}</a>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)} · Bench Grade Peptides</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --paper:      #F7F4EE;
    --paper-soft: #EFEAE1;
    --paper-deep: #E7E0D0;
    --rule:       #D7D1C4;
    --rule-strong:#B8B0A1;
    --ink:        #1A1A1A;
    --ink-soft:   #3A3A3A;
    --ink-muted:  #6B6B6B;
    --teal:       #0A5C7D;
    --teal-hover: #084A65;
    --teal-soft:  #E7F0F4;
    --oxblood:    #7A1E1E;

    --sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

    --content-width: 38rem;   /* ~640px at 16px */
    --gutter: 2rem;
  }

  * { box-sizing: border-box; }
  html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 17px;
    line-height: 1.7;
    font-feature-settings: "ss01", "cv11";
  }

  /* ---------- top bar ---------- */
  .ruo-bar {
    background: var(--oxblood);
    color: var(--paper);
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    text-align: center;
    padding: 8px 16px;
  }

  /* ---------- document nav ---------- */
  .doc-nav {
    max-width: 72rem;
    margin: 0 auto;
    padding: 18px var(--gutter);
    display: flex;
    align-items: baseline;
    gap: 8px 28px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--rule);
  }
  .doc-nav .brand {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink);
    text-decoration: none;
    margin-right: auto;
  }
  .doc-nav a {
    font-size: 14px;
    color: var(--ink-muted);
    text-decoration: none;
    padding: 4px 0;
    border-bottom: 2px solid transparent;
    transition: color 120ms, border-color 120ms;
  }
  .doc-nav a:hover { color: var(--ink); }
  .doc-nav a.is-current {
    color: var(--ink);
    border-bottom-color: var(--teal);
  }

  /* ---------- layout: TOC + article ---------- */
  .page {
    max-width: 72rem;
    margin: 0 auto;
    padding: 56px var(--gutter) 96px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 48px;
  }
  @media (min-width: 1024px) {
    .page {
      grid-template-columns: 15rem minmax(0, 1fr);
      gap: 72px;
    }
  }

  .toc {
    font-size: 13px;
    line-height: 1.6;
    color: var(--ink-muted);
    position: relative;
  }
  @media (min-width: 1024px) {
    .toc {
      position: sticky;
      top: 32px;
      align-self: start;
    }
  }
  .toc-label {
    font-family: var(--mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--ink-muted);
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--rule);
  }
  .toc ol {
    list-style: none;
    margin: 0;
    padding: 0;
    counter-reset: toc;
  }
  .toc li {
    counter-increment: toc;
    padding: 4px 0;
  }
  .toc li::before {
    content: counter(toc, decimal-leading-zero);
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint, #9a9a9a);
    margin-right: 8px;
  }
  .toc a {
    color: var(--ink-soft);
    text-decoration: none;
  }
  .toc a:hover { color: var(--teal); }

  /* ---------- article ---------- */
  article { max-width: var(--content-width); }

  article header {
    margin-bottom: 48px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--rule);
  }
  article header .eyebrow {
    font-family: var(--mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--teal);
  }
  article header h1 {
    font-family: var(--sans);
    font-size: clamp(2rem, 4vw, 2.8rem);
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin: 10px 0 6px 0;
  }
  article header p {
    font-size: 17px;
    color: var(--ink-soft);
    margin: 0;
  }

  article h1, article h2, article h3, article h4 {
    font-family: var(--sans);
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--ink);
  }
  /* The markdown body shouldn't render its own H1 because we already
     printed the document header above. */
  article .body > h1:first-child { display: none; }

  article h2 {
    position: relative;
    font-size: 1.5rem;
    line-height: 1.25;
    margin: 64px 0 8px 0;
    padding-top: 24px;
    border-top: 1px solid var(--rule);
  }
  article h3 {
    font-size: 1.125rem;
    line-height: 1.35;
    margin: 40px 0 2px 0;
  }
  article h4 {
    font-size: 0.95rem;
    margin: 28px 0 0 0;
  }
  article .anchor {
    position: absolute;
    left: -1.25em;
    top: 24px;
    color: var(--rule-strong);
    text-decoration: none;
    font-weight: 400;
    font-family: var(--mono);
    font-size: 0.8em;
    opacity: 0;
    transition: opacity 120ms;
  }
  article h2:hover .anchor { opacity: 1; }

  article p {
    margin: 14px 0;
    color: var(--ink-soft);
  }
  article strong { color: var(--ink); font-weight: 600; }
  article em { font-style: italic; color: var(--ink); }

  article a {
    color: var(--teal);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
    transition: color 120ms;
  }
  article a:hover { color: var(--teal-hover); }

  article ul, article ol {
    margin: 16px 0;
    padding-left: 1.75rem;
    color: var(--ink-soft);
  }
  article ul { list-style: disc outside; }
  article ol { list-style: decimal outside; }
  article li { margin: 6px 0; }
  article li > p { margin: 6px 0; }
  article li::marker { color: var(--ink-muted); }

  article code {
    font-family: var(--mono);
    font-size: 0.88em;
    background: var(--paper-soft);
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--ink);
  }
  article pre {
    font-family: var(--mono);
    font-size: 13.5px;
    line-height: 1.6;
    background: #F1ECE1;
    border: 1px solid var(--rule);
    border-radius: 4px;
    padding: 16px 20px;
    overflow-x: auto;
    margin: 18px 0;
    color: var(--ink);
  }
  article pre code {
    background: transparent;
    padding: 0;
    font-size: inherit;
  }

  article blockquote {
    border-left: 3px solid var(--teal);
    background: var(--teal-soft);
    padding: 12px 20px;
    margin: 20px 0;
    color: var(--ink);
    font-style: normal;
  }
  article blockquote p { color: var(--ink); }

  article hr {
    border: 0;
    border-top: 1px solid var(--rule);
    margin: 48px 0;
  }

  article table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    margin: 20px 0;
    background: var(--paper);
  }
  article th, article td {
    border: 1px solid var(--rule);
    padding: 10px 14px;
    text-align: left;
    vertical-align: top;
  }
  article th {
    background: var(--paper-soft);
    font-weight: 600;
    color: var(--ink);
  }
  article td { color: var(--ink-soft); }

  /* subtle callout effect for intro "TL;DR" style paragraphs */
  article .body > h2:first-of-type + p,
  article .body > h1 + p:first-of-type {
    font-size: 1.0625rem;
    color: var(--ink);
  }

  /* emphasis for emoji-prefixed headings in morning brief */
  article h3 { overflow-wrap: break-word; }

  /* ---------- footer ---------- */
  footer {
    max-width: 72rem;
    margin: 0 auto;
    padding: 24px var(--gutter);
    border-top: 1px solid var(--rule);
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-muted);
    letter-spacing: 0.04em;
  }
  footer code {
    font-size: inherit;
    background: var(--paper-soft);
    padding: 1px 5px;
    border-radius: 2px;
  }

  @media (max-width: 640px) {
    body { font-size: 16px; }
    .page { padding: 32px 20px 64px; }
    article header h1 { font-size: 1.75rem; }
    article h2 { font-size: 1.25rem; }
    article pre { font-size: 12.5px; padding: 14px 16px; }
  }

  @media print {
    .doc-nav, .ruo-bar, footer, .toc { display: none; }
    .page { grid-template-columns: 1fr; padding: 0; }
    article { max-width: 100%; }
    article a { color: var(--ink); text-decoration: none; }
  }
</style>
</head>
<body>
<div class="ruo-bar">BENCH GRADE PEPTIDES · INTERNAL BRIEF · NOT FOR DISTRIBUTION</div>

<nav class="doc-nav" aria-label="Briefs">
  <a class="brand" href="./morning-brief.html">Bench Grade · Briefs</a>
  ${docNav}
</nav>

<div class="page">
  ${tocHtml}
  <article>
    <header>
      <div class="eyebrow">Bench Grade Peptides</div>
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
    </header>
    <div class="body">${body}</div>
  </article>
</div>

<footer>Generated ${new Date().toISOString().slice(0, 10)} · source <code>${escapeHtml(path.relative(ROOT, DIR))}/${escapeHtml(slug)}.md</code> · rebuild <code>node scripts/build-briefs.mjs</code></footer>
</body>
</html>`;
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
    const parsed = await marked.parse(src);
    const { html, toc } = extractToc(parsed);
    const others = slugs.map((s) => ({
      href: `./${s}.html`,
      label: TITLES[s] ?? s,
      current: s === slug,
    }));
    const out = shell({ slug, body: html, toc, others });
    const outPath = path.join(DIR, `${slug}.html`);
    await writeFile(outPath, out, "utf8");
    console.log(`wrote ${path.relative(ROOT, outPath)} (${toc.length} sections)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
