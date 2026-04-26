import { describe, it, expect, vi } from "vitest";

// Stub createServerSupabase so importing the route module doesn't
// pull in next/headers. Only the pure helper is under test.
vi.mock("@/lib/supabase/client", () => ({
  createServerSupabase: async () => ({}),
}));

import { safeNextRedirect } from "../route";

describe("safeNextRedirect — open-redirect guard", () => {
  it("null → /account", () => {
    expect(safeNextRedirect(null)).toBe("/account");
  });

  it("undefined → /account", () => {
    expect(safeNextRedirect(undefined)).toBe("/account");
  });

  it("empty string → /account", () => {
    expect(safeNextRedirect("")).toBe("/account");
  });

  it("same-origin path /foo/bar → /foo/bar", () => {
    expect(safeNextRedirect("/foo/bar")).toBe("/foo/bar");
  });

  it("same-origin path /account/orders → /account/orders", () => {
    expect(safeNextRedirect("/account/orders")).toBe("/account/orders");
  });

  it("protocol-relative //evil.com → /account", () => {
    expect(safeNextRedirect("//evil.com")).toBe("/account");
  });

  it("protocol-relative //evil.com/path → /account", () => {
    expect(safeNextRedirect("//evil.com/path")).toBe("/account");
  });

  it("absolute https://evil.com → /account", () => {
    expect(safeNextRedirect("https://evil.com")).toBe("/account");
  });

  it("absolute http://evil.com → /account", () => {
    expect(safeNextRedirect("http://evil.com")).toBe("/account");
  });

  it("path without leading slash 'foo' → /account", () => {
    expect(safeNextRedirect("foo")).toBe("/account");
  });
});
