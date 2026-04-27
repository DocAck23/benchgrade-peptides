import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { makeSuccessToken, verifySuccessToken } from "../success-token";

const ORDER_ID = "11111111-2222-3333-4444-555555555555";
const OTHER_ORDER = "99999999-aaaa-bbbb-cccc-dddddddddddd";

describe("success-token HMAC", () => {
  const originalSecret = process.env.ORDER_SUCCESS_TOKEN_SECRET;

  beforeEach(() => {
    process.env.ORDER_SUCCESS_TOKEN_SECRET = "test-secret-for-success-token";
  });
  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.ORDER_SUCCESS_TOKEN_SECRET;
    } else {
      process.env.ORDER_SUCCESS_TOKEN_SECRET = originalSecret;
    }
  });

  it("verifies a fresh token", () => {
    const t = makeSuccessToken(ORDER_ID);
    expect(verifySuccessToken(ORDER_ID, t)).toBe(true);
  });

  it("rejects a token bound to a different order id", () => {
    const t = makeSuccessToken(ORDER_ID);
    expect(verifySuccessToken(OTHER_ORDER, t)).toBe(false);
  });

  it("rejects an expired token", () => {
    // Generate at T0, verify at T0 + 2h.
    const t0 = new Date("2026-04-27T12:00:00Z");
    const tPlusTwo = new Date(t0.getTime() + 2 * 60 * 60 * 1000);
    const tok = makeSuccessToken(ORDER_ID, t0);
    expect(verifySuccessToken(ORDER_ID, tok, tPlusTwo)).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(verifySuccessToken(ORDER_ID, "")).toBe(false);
    expect(verifySuccessToken(ORDER_ID, "noseparator")).toBe(false);
    expect(verifySuccessToken(ORDER_ID, ".sig-only")).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const t = makeSuccessToken(ORDER_ID);
    process.env.ORDER_SUCCESS_TOKEN_SECRET = "different-secret";
    expect(verifySuccessToken(ORDER_ID, t)).toBe(false);
  });

  it("rejects when no secret is configured", () => {
    delete process.env.ORDER_SUCCESS_TOKEN_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const t = makeSuccessToken(ORDER_ID);
    expect(t).toBe("");
    expect(verifySuccessToken(ORDER_ID, t)).toBe(false);
  });
});
