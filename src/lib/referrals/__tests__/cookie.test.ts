import { describe, it, expect } from "vitest";
import {
  parseReferralCookie,
  buildReferralCookie,
  REFERRAL_COOKIE_NAME,
} from "../cookie";

const SIXTY_DAYS_MS = 60 * 60 * 24 * 60 * 1000;

describe("parseReferralCookie (U-REF-3)", () => {
  it("returns null for null header", () => {
    expect(parseReferralCookie(null)).toBeNull();
  });

  it("returns null for empty header", () => {
    expect(parseReferralCookie("")).toBeNull();
  });

  it("parses a valid, fresh cookie", () => {
    const now = Date.now();
    const header = `bgp_ref=ABC123XY|${now}`;
    const out = parseReferralCookie(header);
    expect(out).toEqual({ code: "ABC123XY", attributedAt: now });
  });

  it("finds the cookie among other cookies", () => {
    const now = Date.now();
    const header = `session=abc; bgp_ref=ABC123XY|${now}; tracker=1`;
    const out = parseReferralCookie(header);
    expect(out?.code).toBe("ABC123XY");
  });

  it("returns null for an expired cookie (> 60d old)", () => {
    const old = Date.now() - SIXTY_DAYS_MS - 1000;
    const header = `bgp_ref=ABC123XY|${old}`;
    expect(parseReferralCookie(header)).toBeNull();
  });

  it("accepts a cookie just under 60 days old", () => {
    const old = Date.now() - SIXTY_DAYS_MS + 60_000;
    const header = `bgp_ref=ABC123XY|${old}`;
    expect(parseReferralCookie(header)).not.toBeNull();
  });

  it("returns null for malformed value (no pipe)", () => {
    expect(parseReferralCookie("bgp_ref=ABC123XY")).toBeNull();
  });

  it("returns null for invalid code format", () => {
    const now = Date.now();
    expect(parseReferralCookie(`bgp_ref=abc|${now}`)).toBeNull(); // lowercase
    expect(parseReferralCookie(`bgp_ref=AB!|${now}`)).toBeNull(); // special
    expect(parseReferralCookie(`bgp_ref=AB|${now}`)).toBeNull(); // too short
  });

  it("returns null for non-numeric timestamp", () => {
    expect(parseReferralCookie(`bgp_ref=ABC123XY|notanumber`)).toBeNull();
  });

  it("returns null for negative timestamp", () => {
    expect(parseReferralCookie(`bgp_ref=ABC123XY|-100`)).toBeNull();
  });

  it("returns null when the cookie is absent", () => {
    expect(parseReferralCookie("session=abc; tracker=1")).toBeNull();
  });
});

describe("buildReferralCookie (U-REF-4)", () => {
  const NOW = 1_700_000_000_000;

  it("uses the cookie name constant", () => {
    const c = buildReferralCookie("ABC123XY", { now: NOW });
    expect(c.startsWith(`${REFERRAL_COOKIE_NAME}=`)).toBe(true);
  });

  it("encodes value as code|attributedAt", () => {
    const c = buildReferralCookie("ABC123XY", { now: NOW });
    expect(c).toContain(`bgp_ref=ABC123XY|${NOW}`);
  });

  it("sets Max-Age to 60 days (5184000s)", () => {
    const c = buildReferralCookie("ABC123XY", { now: NOW });
    expect(c).toContain("Max-Age=5184000");
  });

  it("sets HttpOnly + SameSite=Lax + Path=/", () => {
    const c = buildReferralCookie("ABC123XY", { now: NOW });
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Path=/");
  });

  it("does NOT set Secure when secure: false (default)", () => {
    const c = buildReferralCookie("ABC123XY", { now: NOW });
    expect(c).not.toContain("Secure");
  });

  it("sets Secure when secure: true", () => {
    const c = buildReferralCookie("ABC123XY", { now: NOW, secure: true });
    expect(c).toContain("Secure");
  });

  it("round-trips through parseReferralCookie", () => {
    const setCookie = buildReferralCookie("ABC123XY", { now: Date.now() });
    // Convert Set-Cookie to a Cookie header (just the name=value pair).
    const cookieHeader = setCookie.split(";")[0];
    const parsed = parseReferralCookie(cookieHeader);
    expect(parsed?.code).toBe("ABC123XY");
  });
});
