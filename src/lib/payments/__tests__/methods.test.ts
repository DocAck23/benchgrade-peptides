import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PAYMENT_METHODS,
  isPaymentMethod,
  enabledPaymentMethods,
  paymentMethodLabel,
} from "../methods";

describe("payment methods — enum + feature flags", () => {
  it("PAYMENT_METHODS is the frozen enum of allowed values", () => {
    expect(PAYMENT_METHODS).toEqual(["wire", "ach", "zelle", "crypto"]);
  });

  it("isPaymentMethod narrows unknown input to the union", () => {
    expect(isPaymentMethod("wire")).toBe(true);
    expect(isPaymentMethod("ach")).toBe(true);
    expect(isPaymentMethod("zelle")).toBe(true);
    expect(isPaymentMethod("crypto")).toBe(true);
    expect(isPaymentMethod("card")).toBe(false);
    expect(isPaymentMethod("")).toBe(false);
    expect(isPaymentMethod(null)).toBe(false);
    expect(isPaymentMethod(123)).toBe(false);
  });

  describe("enabledPaymentMethods — env-driven visibility", () => {
    const orig = { ...process.env };
    beforeEach(() => {
      delete process.env.WIRE_BENEFICIARY;
      delete process.env.WIRE_BANK;
      delete process.env.WIRE_ROUTING;
      delete process.env.WIRE_ACCOUNT;
      delete process.env.ZELLE_ID;
      delete process.env.NOWPAYMENTS_API_KEY;
    });
    afterEach(() => {
      process.env = { ...orig };
    });

    it("hides every method when no env vars are set", () => {
      expect(enabledPaymentMethods()).toEqual([]);
    });

    it("enables wire + ach together when the WIRE_* quartet is set", () => {
      process.env.WIRE_BENEFICIARY = "Bench Grade Peptides LLC";
      process.env.WIRE_BANK = "Relay";
      process.env.WIRE_ROUTING = "123456789";
      process.env.WIRE_ACCOUNT = "9876543210";
      expect(enabledPaymentMethods()).toContain("wire");
      expect(enabledPaymentMethods()).toContain("ach");
    });

    it("enables zelle when ZELLE_ID is set", () => {
      process.env.ZELLE_ID = "benchgrade";
      expect(enabledPaymentMethods()).toContain("zelle");
    });

    it("enables crypto when NOWPAYMENTS_API_KEY is set", () => {
      process.env.NOWPAYMENTS_API_KEY = "test-key";
      expect(enabledPaymentMethods()).toContain("crypto");
    });

    it("hides wire + ach if any of the WIRE_* quartet is missing", () => {
      process.env.WIRE_BENEFICIARY = "x";
      process.env.WIRE_BANK = "y";
      process.env.WIRE_ROUTING = "z";
      // WIRE_ACCOUNT intentionally missing
      expect(enabledPaymentMethods()).not.toContain("wire");
      expect(enabledPaymentMethods()).not.toContain("ach");
    });

    it("returns methods in a stable display order", () => {
      process.env.WIRE_BENEFICIARY = "a";
      process.env.WIRE_BANK = "b";
      process.env.WIRE_ROUTING = "c";
      process.env.WIRE_ACCOUNT = "d";
      process.env.ZELLE_ID = "e";
      process.env.NOWPAYMENTS_API_KEY = "f";
      // Display order: zelle, crypto, ach, wire — fastest UX first.
      expect(enabledPaymentMethods()).toEqual(["zelle", "crypto", "ach", "wire"]);
    });
  });

  describe("paymentMethodLabel", () => {
    it("returns a human label per method", () => {
      expect(paymentMethodLabel("wire")).toMatch(/wire/i);
      expect(paymentMethodLabel("ach")).toMatch(/ach/i);
      expect(paymentMethodLabel("zelle")).toMatch(/zelle/i);
      expect(paymentMethodLabel("crypto")).toMatch(/crypto|bitcoin|digital/i);
    });
  });
});
