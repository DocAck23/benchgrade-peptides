import { describe, expect, it } from "vitest";
import { ROUTES } from "../routes";

describe("ROUTES", () => {
  it("Foundation values keep `/catalogue` (sub-project B will rename)", () => {
    expect(ROUTES.CATALOG).toBe("/catalogue");
    expect(ROUTES.STACKS).toBe("/catalogue/stacks");
  });

  it("static routes are strings", () => {
    expect(typeof ROUTES.HOME).toBe("string");
    expect(typeof ROUTES.RESEARCH).toBe("string");
    expect(typeof ROUTES.CART).toBe("string");
    expect(typeof ROUTES.CHECKOUT).toBe("string");
    expect(typeof ROUTES.LOGIN).toBe("string");
  });

  it("route builders produce the right URLs", () => {
    expect(ROUTES.CATEGORY("growth-hormone-secretagogues")).toBe(
      "/catalogue/growth-hormone-secretagogues"
    );
    expect(ROUTES.PRODUCT("tissue-repair", "bpc-157")).toBe(
      "/catalogue/tissue-repair/bpc-157"
    );
    expect(ROUTES.STACK("wolverine")).toBe("/catalogue/stacks/wolverine");
    expect(ROUTES.ARTICLE("hplc-101")).toBe("/research/hplc-101");
  });

  it("account routes nest correctly", () => {
    expect(ROUTES.ACCOUNT_ORDERS).toBe("/account/orders");
    expect(ROUTES.ACCOUNT_ORDER("BGP-12345")).toBe(
      "/account/orders/BGP-12345"
    );
    expect(ROUTES.ACCOUNT_SUBSCRIPTION).toBe("/account/subscription");
  });
});
