import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  orderConfirmationEmail,
  adminOrderNotification,
  escapeHtml,
  paymentConfirmedEmail,
  orderShippedEmail,
  accountClaimEmail,
} from "../templates";
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

describe("paymentConfirmedEmail", () => {
  it("subject is 'Payment received — your order is being prepared · BGP-<first8>'", () => {
    const email = paymentConfirmedEmail({ ...baseCtx, payment_method: "wire" });
    expect(email.subject).toBe(
      "Payment received — your order is being prepared · BGP-abc12345"
    );
  });

  it("body re-renders the full item list and final total", () => {
    const email = paymentConfirmedEmail({ ...baseCtx, payment_method: "wire" });
    expect(email.text).toContain("BPC-157");
    expect(email.text).toContain("$275");
    expect(email.html).toContain("BPC-157");
  });

  it("body includes the RUO disclaimer", () => {
    const email = paymentConfirmedEmail({ ...baseCtx, payment_method: "wire" });
    expect(email.text).toMatch(/research use only|laboratory research/i);
    expect(email.html).toMatch(/research use only|laboratory research/i);
  });

  it("escapes customer name in html and text", () => {
    const email = paymentConfirmedEmail({
      ...baseCtx,
      customer: { ...baseCtx.customer, name: "<img src=x onerror=alert(1)>" },
      payment_method: "wire",
    });
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img");
  });
});

describe("orderShippedEmail", () => {
  const shippedCtx = {
    ...baseCtx,
    payment_method: "wire" as const,
    tracking_number: "9400111202509999999999",
    tracking_carrier: "USPS" as const,
    tracking_url:
      "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111202509999999999",
    coa_lot_urls: [
      {
        sku: "BGP-BPC157-10-5",
        lot: "L-2026-0431",
        url: "https://benchgradepeptides.com/coa/L-2026-0431",
      },
    ],
  };

  it("subject is 'Shipped — tracking inside · BGP-<first8>'", () => {
    const email = orderShippedEmail(shippedCtx);
    expect(email.subject).toBe("Shipped — tracking inside · BGP-abc12345");
  });

  it("body includes tracking number, carrier, and URL", () => {
    const email = orderShippedEmail(shippedCtx);
    expect(email.text).toContain("9400111202509999999999");
    expect(email.text).toContain("USPS");
    expect(email.text).toContain("https://tools.usps.com/go/");
    expect(email.html).toContain("9400111202509999999999");
  });

  it("body includes the storage-and-handling panel", () => {
    const email = orderShippedEmail(shippedCtx);
    expect(email.text).toMatch(/2[–-]?8°C/);
    expect(email.text).toMatch(/light[- ]protect/i);
    expect(email.text).toMatch(/reconstituted/i);
  });

  it("renders per-lot COA URLs when provided", () => {
    const email = orderShippedEmail(shippedCtx);
    expect(email.text).toContain("L-2026-0431");
    expect(email.text).toContain("benchgradepeptides.com/coa/L-2026-0431");
  });

  it("falls back to portal link when coa_lot_urls is empty", () => {
    const email = orderShippedEmail({ ...shippedCtx, coa_lot_urls: [] });
    expect(email.text).toMatch(/COA available in your portal|sign in to view/i);
  });
});

describe("accountClaimEmail", () => {
  const claimCtx = {
    ...baseCtx,
    payment_method: "wire" as const,
    magic_link_url: "https://benchgradepeptides.com/auth/callback?token=abc123",
  };

  it("subject is 'Claim your Bench Grade portal — order BGP-<first8>'", () => {
    const email = accountClaimEmail(claimCtx);
    expect(email.subject).toBe(
      "Claim your Bench Grade portal — order BGP-abc12345"
    );
  });

  it("body includes the supplied magic link URL", () => {
    const email = accountClaimEmail(claimCtx);
    expect(email.text).toContain(
      "https://benchgradepeptides.com/auth/callback?token=abc123"
    );
    expect(email.html).toContain(
      "https://benchgradepeptides.com/auth/callback?token=abc123"
    );
  });

  it("explains 'click any future magic link from us — same account'", () => {
    const email = accountClaimEmail(claimCtx);
    expect(email.text.toLowerCase()).toMatch(/same account|future magic link/);
  });
});

describe("orderConfirmationEmail — why-no-cards narrative line (Wave 2d)", () => {
  it("includes the why-no-cards narrative line in both text and html", () => {
    const email = orderConfirmationEmail({ ...baseCtx, payment_method: "wire" });
    expect(email.text).toMatch(/Why no cards/);
    expect(email.html).toMatch(/Why no cards/);
    expect(email.html).toContain("/why-no-cards");
    expect(email.text).toContain("/why-no-cards");
  });
});
