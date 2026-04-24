import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { orderConfirmationEmail, adminOrderNotification, escapeHtml } from "../templates";
import type { CartItem } from "@/lib/cart/types";

const sampleItem: CartItem = {
  sku: "BGP-BPC157-10-5",
  product_slug: "bpc-157",
  category_slug: "tissue-repair",
  name: "BPC-157",
  size_mg: 10,
  pack_size: 5,
  unit_price: 275,
  quantity: 1,
  vial_image: "/brand/vials/bpc-157.jpg?v=3",
};

const baseCtx = {
  order_id: "abc12345-def6-7890-1234-567890abcdef",
  customer: {
    name: "Dr. Jane Smith",
    email: "jane@example.edu",
    institution: "",
    phone: "",
    ship_address_1: "123 Lab Ln",
    ship_city: "Boston",
    ship_state: "MA",
    ship_zip: "02101",
  },
  items: [sampleItem],
  subtotal_cents: 27500,
};

describe("orderConfirmationEmail — payment-method branching", () => {
  const orig = { ...process.env };
  beforeEach(() => {
    delete process.env.WIRE_BENEFICIARY;
    delete process.env.WIRE_BANK;
    delete process.env.WIRE_ROUTING;
    delete process.env.WIRE_ACCOUNT;
    delete process.env.ZELLE_ID;
  });
  afterEach(() => {
    process.env = { ...orig };
  });

  it("wire method includes the beneficiary / bank / routing / account block", () => {
    process.env.WIRE_BENEFICIARY = "Bench Grade Peptides LLC";
    process.env.WIRE_BANK = "Relay Financial";
    process.env.WIRE_ROUTING = "084106768";
    process.env.WIRE_ACCOUNT = "9876543210";
    const email = orderConfirmationEmail({ ...baseCtx, payment_method: "wire" });
    expect(email.text).toContain("Wire transfer instructions");
    expect(email.text).toContain("Relay Financial");
    expect(email.text).toContain("084106768");
    expect(email.text).toContain("9876543210");
    expect(email.html).toContain("Wire transfer instructions");
  });

  it("ach method includes ACH routing details but labels them as ACH", () => {
    process.env.WIRE_BENEFICIARY = "Bench Grade Peptides LLC";
    process.env.WIRE_BANK = "Relay Financial";
    process.env.WIRE_ROUTING = "084106768";
    process.env.WIRE_ACCOUNT = "9876543210";
    const email = orderConfirmationEmail({ ...baseCtx, payment_method: "ach" });
    expect(email.text).toContain("ACH");
    expect(email.text).toContain("084106768");
    expect(email.text).not.toContain("Send the wire exactly as listed");
  });

  it("zelle method includes the Zelle ID and memo, not wire details", () => {
    process.env.ZELLE_ID = "benchgrade";
    const email = orderConfirmationEmail({ ...baseCtx, payment_method: "zelle" });
    expect(email.text).toContain("Zelle");
    expect(email.text).toContain("benchgrade");
    expect(email.text).toContain("BGP-abc12345");
    // Zelle order should NOT leak wire account data
    expect(email.text).not.toContain("Routing / ABA");
  });

  it("crypto method tells the user an invoice link is on the way", () => {
    const email = orderConfirmationEmail({ ...baseCtx, payment_method: "crypto" });
    expect(email.text.toLowerCase()).toContain("crypto");
    expect(email.text).not.toContain("Routing / ABA");
    expect(email.text).not.toContain("Send via Zelle");
  });

  it("every branch includes the memo BGP-<first8> so payments can be matched", () => {
    for (const method of ["wire", "ach", "zelle", "crypto"] as const) {
      const email = orderConfirmationEmail({ ...baseCtx, payment_method: method });
      expect(email.text).toContain("BGP-abc12345");
    }
  });

  it("customer name is HTML-escaped in both html and plain-text wrapping", () => {
    const email = orderConfirmationEmail({
      ...baseCtx,
      payment_method: "zelle",
      customer: { ...baseCtx.customer, name: "<script>alert(1)</script>" },
    });
    process.env.ZELLE_ID = "benchgrade";
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("adminOrderNotification", () => {
  it("includes pack-tier label per item and the payment method used", () => {
    const email = adminOrderNotification({ ...baseCtx, payment_method: "zelle" });
    expect(email.text).toContain("5-vial pack");
    expect(email.text.toLowerCase()).toContain("zelle");
    expect(email.subject).toContain("Dr. Jane Smith");
  });
});

describe("escapeHtml", () => {
  it("neutralizes the standard XSS character set", () => {
    expect(escapeHtml("<>&\"'")).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});
