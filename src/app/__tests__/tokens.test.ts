import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Sprint 0 Task 1 — locked design tokens (spec §16.1).
 *
 * Asserts that every locked color token from the v1 customer experience
 * design spec is present in `src/app/globals.css` with the locked hex
 * value, and that the four font-family CSS variables (display / editorial /
 * sans / mono) are wired through the theme.
 */
describe("globals.css design tokens (Sprint 0 spec §16.1)", () => {
  const css = readFileSync(resolve(__dirname, "../globals.css"), "utf8");

  const colorTokens: Record<string, string> = {
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
  };

  for (const [token, hex] of Object.entries(colorTokens)) {
    it(`${token} is ${hex}`, () => {
      // Tolerant match: case-insensitive hex + flexible whitespace.
      const escaped = `${token}\\s*:\\s*${hex.replace(/[#-]/g, "\\$&")}`;
      const re = new RegExp(escaped, "i");
      expect(css).toMatch(re);
    });
  }

  it("--font-display references the Cinzel next/font CSS variable", () => {
    expect(css).toMatch(/--font-display\s*:\s*[^;]*--font-cinzel/);
  });

  it("--font-editorial references the Cormorant Garamond next/font CSS variable", () => {
    expect(css).toMatch(/--font-editorial\s*:\s*[^;]*--font-cormorant/);
  });

  it("--font-sans references the Inter next/font CSS variable", () => {
    expect(css).toMatch(/--font-sans\s*:\s*[^;]*--font-inter/);
  });

  it("--font-mono references the JetBrains Mono next/font CSS variable", () => {
    expect(css).toMatch(/--font-mono\s*:\s*[^;]*--font-jetbrains-mono/);
  });

  it("declares a wine-surface context selector", () => {
    expect(css).toMatch(/\[data-surface=["']wine["']\]/);
  });
});
