import { describe, it, expect } from "vitest";
import { resolveClientIp, type HeaderLike } from "../ip";

function h(entries: Record<string, string | undefined>): HeaderLike {
  return {
    get(name: string) {
      return entries[name.toLowerCase()] ?? null;
    },
  };
}

describe("resolveClientIp", () => {
  it("prefers x-vercel-forwarded-for", () => {
    const got = resolveClientIp(
      h({
        "x-vercel-forwarded-for": "5.6.7.8",
        "x-forwarded-for": "1.2.3.4",
        "x-real-ip": "9.9.9.9",
      }),
      { isProduction: true }
    );
    expect(got).toEqual({ ok: true, ip: "5.6.7.8" });
  });

  it("falls back to x-real-ip when x-vercel-forwarded-for is absent", () => {
    const got = resolveClientIp(
      h({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.2.3.4" }),
      { isProduction: true }
    );
    expect(got).toEqual({ ok: true, ip: "9.9.9.9" });
  });

  it("falls back to the LAST x-forwarded-for entry (closest trusted hop)", () => {
    // The first entry is client-set and forgeable. Well-behaved proxies
    // append their own IP; the last entry is the most-trusted hop.
    const got = resolveClientIp(
      h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }),
      { isProduction: true }
    );
    expect(got).toEqual({ ok: true, ip: "10.0.0.1" });
  });

  it("ignores attacker-prepended XFF entries", () => {
    // Attacker sends "X-Forwarded-For: 1.2.3.4" hoping to spoof their IP;
    // edge appends real IP, leaving "1.2.3.4, <real>". We must NOT pick
    // the first entry — the attacker controls it.
    const got = resolveClientIp(
      h({ "x-forwarded-for": "ATTACKER, 5.6.7.8" }),
      { isProduction: true }
    );
    expect(got).toEqual({ ok: true, ip: "5.6.7.8" });
  });

  it("handles a single XFF entry without a comma", () => {
    const got = resolveClientIp(
      h({ "x-forwarded-for": "1.2.3.4" }),
      { isProduction: true }
    );
    expect(got).toEqual({ ok: true, ip: "1.2.3.4" });
  });

  it("trims whitespace inside XFF entries", () => {
    const got = resolveClientIp(
      h({ "x-forwarded-for": "1.2.3.4 ,   10.0.0.1   " }),
      { isProduction: true }
    );
    expect(got).toEqual({ ok: true, ip: "10.0.0.1" });
  });

  it("returns an error in production when no IP header is present", () => {
    const got = resolveClientIp(h({}), { isProduction: true });
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.reason).toMatch(/identify/i);
  });

  it("returns 'unknown' in non-production when no IP header is present", () => {
    const got = resolveClientIp(h({}), { isProduction: false });
    expect(got).toEqual({ ok: true, ip: "unknown" });
  });
});
