import { describe, it, expect } from "vitest";
import { formatInvoiceNumber } from "../invoice";

describe("formatInvoiceNumber", () => {
  it("pads to 5 digits with INV- prefix", () => {
    expect(formatInvoiceNumber(196)).toBe("INV-00196");
    expect(formatInvoiceNumber(1)).toBe("INV-00001");
    expect(formatInvoiceNumber(99999)).toBe("INV-99999");
  });

  it("does not truncate values beyond 5 digits", () => {
    // Sequence wouldn't reasonably hit this for a long time, but the
    // formatter should never lie about the underlying number.
    expect(formatInvoiceNumber(123456)).toBe("INV-123456");
  });

  it("floors decimals to keep the formatted number integer-shaped", () => {
    expect(formatInvoiceNumber(196.7)).toBe("INV-00196");
  });

  it("returns a placeholder for invalid inputs", () => {
    expect(formatInvoiceNumber(Number.NaN)).toBe("INV-—");
    expect(formatInvoiceNumber(-1)).toBe("INV-—");
    expect(formatInvoiceNumber(Number.POSITIVE_INFINITY)).toBe("INV-—");
  });
});
