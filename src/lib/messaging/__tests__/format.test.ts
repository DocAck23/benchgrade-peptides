import { describe, it, expect } from "vitest";
import { composeMessageHtml, formatThreadTimestamp } from "../format";

describe("composeMessageHtml (U-MSG-1)", () => {
  it("returns escaped basic body", () => {
    expect(composeMessageHtml("hello world")).toBe("hello world");
  });

  it("escapes <script> tag to prevent XSS", () => {
    const out = composeMessageHtml("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("&lt;/script&gt;");
  });

  it("preserves multi-line breaks via <br>", () => {
    const out = composeMessageHtml("line1\n\nline2");
    expect(out).toBe("line1<br><br>line2");
  });

  it("escapes single newline to <br>", () => {
    expect(composeMessageHtml("a\nb")).toBe("a<br>b");
  });

  it("escapes ampersand and quote entities", () => {
    expect(composeMessageHtml(`Tom & "Jerry"`)).toBe(
      `Tom &amp; &quot;Jerry&quot;`,
    );
  });

  it("escapes apostrophe", () => {
    expect(composeMessageHtml("it's fine")).toBe("it&#39;s fine");
  });

  it("normalizes \\r\\n to <br>", () => {
    expect(composeMessageHtml("a\r\nb")).toBe("a<br>b");
  });

  it("returns empty string for empty input", () => {
    expect(composeMessageHtml("")).toBe("");
  });
});

describe("formatThreadTimestamp (U-MSG-2)", () => {
  it("formats an ISO timestamp into 'Mon DD · h:mm am/pm' shape", () => {
    // 2026-04-25T16:18:00Z → in UTC is "Apr 25 · 4:18 pm"
    const out = formatThreadTimestamp("2026-04-25T16:18:00Z");
    expect(out).toMatch(/^[A-Z][a-z]{2} \d{1,2} · \d{1,2}:\d{2} (am|pm)$/);
  });

  it("uses lowercase am/pm", () => {
    const out = formatThreadTimestamp("2026-04-25T16:18:00Z");
    expect(out).toMatch(/(am|pm)$/);
    expect(out).not.toMatch(/(AM|PM)/);
  });

  it("uses · separator between date and time", () => {
    const out = formatThreadTimestamp("2026-04-25T16:18:00Z");
    expect(out).toContain(" · ");
  });

  it("returns empty string for invalid ISO", () => {
    expect(formatThreadTimestamp("not-a-date")).toBe("");
  });
});
