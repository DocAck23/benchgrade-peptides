import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Sub-project A · Foundation — locked design tokens (v2 brand).
 *
 * Asserts every locked palette + radius + semantic-alias token in
 * `src/app/globals.css`. v1 tests asserted Cinzel / Cormorant; v2 asserts
 * Glacial Indifference (display + editorial) + Montserrat (UI) + JetBrains
 * Mono (data). Pinyon Script is brand-rule reserved to the logo image
 * asset and is intentionally NOT a webfont.
 */
describe("globals.css design tokens (sub-project A · Foundation)", () => {
  const css = readFileSync(resolve(__dirname, "../globals.css"), "utf8");

  const colorTokens: Record<string, string> = {
    // v1 palette — kept, values aligned to v2
    "--color-wine": "#4A0E1A",
    "--color-wine-deep": "#2E0810",
    "--color-gold": "#B89254",
    "--color-gold-light": "#D4B47A",
    "--color-gold-dark": "#8B6E3F",
    "--color-paper": "#FDFAF1",
    "--color-paper-soft": "#F4EBD7",
    "--color-ink": "#1A0506",
    "--color-ink-soft": "#4A2528",
    "--color-ink-muted": "#6B5350",
    "--color-rule": "#D4C8A8",
    "--color-rule-wine": "#6E2531",
    "--color-success": "#3F6B47",
    "--color-danger": "#7A2128",
    // v2 NEW
    "--color-brick": "#711911",
    "--color-grey": "#DFDFDF",
  };

  for (const [token, hex] of Object.entries(colorTokens)) {
    it(`${token} is ${hex}`, () => {
      const escaped = `${token}\\s*:\\s*${hex.replace(/[#-]/g, "\\$&")}`;
      const re = new RegExp(escaped, "i");
      expect(css).toMatch(re);
    });
  }

  // ---- Semantic v2 aliases (Codex Review #1 fix C2) ----
  it("--color-link maps to --color-gold", () => {
    expect(css).toMatch(/--color-link\s*:\s*var\(--color-gold\)/);
  });
  it("--color-focus maps to --color-gold", () => {
    expect(css).toMatch(/--color-focus\s*:\s*var\(--color-gold\)/);
  });
  it("--color-cta maps to --color-gold", () => {
    expect(css).toMatch(/--color-cta\s*:\s*var\(--color-gold\)/);
  });
  it("--color-status-info maps to --color-wine", () => {
    expect(css).toMatch(/--color-status-info\s*:\s*var\(--color-wine\)/);
  });

  // ---- Deprecation aliases (kept until codemod commits 16–19) ----
  it("--color-teal is preserved as a deprecation alias to --color-link", () => {
    expect(css).toMatch(/--color-teal\s*:\s*var\(--color-link\)/);
  });

  // ---- Typography (v2: Glacial Indifference replaces Cinzel + Cormorant) ----
  it("--font-display references the Glacial Indifference next/font CSS variable", () => {
    expect(css).toMatch(/--font-display\s*:\s*[^;]*--font-glacial/);
  });
  it("--font-editorial references the Glacial Indifference next/font CSS variable", () => {
    expect(css).toMatch(/--font-editorial\s*:\s*[^;]*--font-glacial/);
  });
  it("--font-ui references the Montserrat next/font CSS variable", () => {
    expect(css).toMatch(/--font-ui\s*:\s*[^;]*--font-montserrat/);
  });
  it("--font-mono references the JetBrains Mono next/font CSS variable", () => {
    expect(css).toMatch(/--font-mono\s*:\s*[^;]*--font-jetbrains-mono/);
  });

  // ---- Deprecation font aliases (kept until codemod commit 18) ----
  it("--font-cinzel is preserved as a deprecation alias to --font-glacial", () => {
    expect(css).toMatch(/--font-cinzel\s*:\s*var\(--font-glacial\)/);
  });
  it("--font-cormorant is preserved as a deprecation alias to --font-glacial", () => {
    expect(css).toMatch(/--font-cormorant\s*:\s*var\(--font-glacial\)/);
  });

  // ---- Radius (v2 Medium scale: 12 / 16 / 24) ----
  it("--radius-input is 10px (form controls)", () => {
    expect(css).toMatch(/--radius-input\s*:\s*10px/);
  });
  it("--radius-sm is 12px (v2 bumped from v1 2px)", () => {
    expect(css).toMatch(/--radius-sm\s*:\s*12px/);
  });
  it("--radius-md is 16px (v2 bumped from v1 4px)", () => {
    expect(css).toMatch(/--radius-md\s*:\s*16px/);
  });
  it("--radius-lg is 24px (v2 bumped from v1 8px)", () => {
    expect(css).toMatch(/--radius-lg\s*:\s*24px/);
  });
  it("--radius-pill is 999px (CTAs constant)", () => {
    expect(css).toMatch(/--radius-pill\s*:\s*999px/);
  });

  // ---- Tap target floor (Codex Review #1 fix M4) ----
  it("--tap-target-min is 44px", () => {
    expect(css).toMatch(/--tap-target-min\s*:\s*44px/);
  });

  it("declares a wine-surface context selector", () => {
    expect(css).toMatch(/\[data-surface=["']wine["']\]/);
  });
});
