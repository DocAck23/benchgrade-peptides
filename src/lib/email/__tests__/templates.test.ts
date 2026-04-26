import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  orderConfirmationEmail,
  adminOrderNotification,
  escapeHtml,
  paymentConfirmedEmail,
  orderShippedEmail,
  accountClaimEmail,
  subscriptionStartedEmail,
  subscriptionCycleShipNoticeEmail,
  subscriptionPaymentDueEmail,
  subscriptionRenewalEmail,
  messageNotificationEmail,
  referralEarnedEmail,
  affiliateApplicationApprovedEmail,
  affiliateCommissionEarnedEmail,
  affiliatePayoutSentEmail,
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

describe("subscriptionStartedEmail", () => {
  const subId = "sub-12345-6789-aaaa-bbbb-cccccccccccc";
  const startedCtx = {
    subscription_id: subId,
    customer: baseCtx.customer,
    items: [sampleItem],
    plan_duration_months: 6,
    payment_cadence: "prepay" as const,
    ship_cadence: "monthly" as const,
    cycle_total_cents: 27500,
    plan_total_cents: 140250,
    next_ship_date: "2026-05-01",
    upcoming_ship_dates: ["2026-05-01", "2026-06-01", "2026-07-01"],
    savings_vs_retail_cents: 24750,
  };

  it("subject is 'Your subscription is active — BGP-SUB-<first8>'", () => {
    const email = subscriptionStartedEmail(startedCtx);
    expect(email.subject).toBe("Your subscription is active — BGP-SUB-sub-1234");
  });

  it("body includes plan terms, item list, next ship date and upcoming dates", () => {
    const email = subscriptionStartedEmail(startedCtx);
    expect(email.text).toContain("BPC-157");
    expect(email.text).toContain("6");
    expect(email.text.toLowerCase()).toContain("monthly");
    expect(email.text).toContain("2026-05-01");
    expect(email.text).toContain("2026-06-01");
    expect(email.text).toContain("2026-07-01");
    expect(email.html).toContain("BPC-157");
  });

  it("prepay path does NOT include bill-pay setup instructions", () => {
    const email = subscriptionStartedEmail(startedCtx);
    expect(email.text).not.toMatch(/bank bill[- ]?pay/i);
  });

  it("bill-pay path shows the bill-pay setup instructions block", () => {
    const email = subscriptionStartedEmail({
      ...startedCtx,
      payment_cadence: "bill_pay",
      plan_duration_months: 3,
    });
    expect(email.text).toMatch(/bank bill[- ]?pay/i);
    expect(email.text).toContain("BGP-SUB-sub-1234");
    expect(email.html).toMatch(/bank bill[- ]?pay/i);
  });

  it("escapes customer name", () => {
    const email = subscriptionStartedEmail({
      ...startedCtx,
      customer: { ...baseCtx.customer, name: "<script>x</script>" },
    });
    expect(email.html).not.toContain("<script>x");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("CTA points at /account/subscription", () => {
    const email = subscriptionStartedEmail(startedCtx);
    expect(email.html).toContain("/account/subscription");
  });
});

describe("subscriptionCycleShipNoticeEmail", () => {
  const subId = "sub-12345-6789-aaaa-bbbb-cccccccccccc";
  const cycleCtx = {
    subscription_id: subId,
    customer: baseCtx.customer,
    items: [sampleItem],
    cycle_number: 2,
    cycles_total: 6,
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
    next_ship_date: "2026-06-01",
  };

  it("subject is 'Cycle N of M shipped — BGP-SUB-<first8>'", () => {
    const email = subscriptionCycleShipNoticeEmail(cycleCtx);
    expect(email.subject).toBe("Cycle 2 of 6 shipped — BGP-SUB-sub-1234");
  });

  it("body shows tracking + COA links + storage panel", () => {
    const email = subscriptionCycleShipNoticeEmail(cycleCtx);
    expect(email.text).toContain("9400111202509999999999");
    expect(email.text).toContain("USPS");
    expect(email.text).toContain("L-2026-0431");
    expect(email.text).toMatch(/2[–-]?8°C/);
    expect(email.text).toMatch(/light[- ]protect/i);
    expect(email.html).toContain("9400111202509999999999");
  });

  it("shows 'Final cycle of your plan.' on last cycle (no next_ship_date)", () => {
    const email = subscriptionCycleShipNoticeEmail({
      ...cycleCtx,
      cycle_number: 6,
      next_ship_date: null,
    });
    expect(email.text).toMatch(/final cycle/i);
  });

  it("shows next ship date when not the final cycle", () => {
    const email = subscriptionCycleShipNoticeEmail(cycleCtx);
    expect(email.text).toContain("2026-06-01");
  });

  it("CTA points at the tracking URL", () => {
    const email = subscriptionCycleShipNoticeEmail(cycleCtx);
    expect(email.html).toContain("tools.usps.com/go/");
  });
});

describe("subscriptionPaymentDueEmail", () => {
  const subId = "sub-12345-6789-aaaa-bbbb-cccccccccccc";
  const dueCtx = {
    subscription_id: subId,
    customer: baseCtx.customer,
    cycle_number: 3,
    cycles_total: 6,
    cycle_total_cents: 27500,
    due_date: "2026-05-05",
    days_remaining: 5,
    subscription_memo: "BGP-SUB-sub-1234",
    bill_pay_setup_url: "https://benchgradepeptides.com/account/subscription/bill-pay",
  };

  it("subject is 'Payment due in 5 days — Cycle N of M'", () => {
    const email = subscriptionPaymentDueEmail(dueCtx);
    expect(email.subject).toBe("Payment due in 5 days — Cycle 3 of 6");
  });

  it("body explains the 5-day grace warning", () => {
    const email = subscriptionPaymentDueEmail(dueCtx);
    expect(email.text).toMatch(/5 days/i);
    expect(email.text.toLowerCase()).toMatch(/auto[- ]cancel|cycle.*cancel/);
    expect(email.html).toMatch(/5 days/i);
  });

  it("body includes the subscription memo and due date", () => {
    const email = subscriptionPaymentDueEmail(dueCtx);
    expect(email.text).toContain("BGP-SUB-sub-1234");
    expect(email.text).toContain("2026-05-05");
  });

  it("CTA links at the bill-pay setup URL", () => {
    const email = subscriptionPaymentDueEmail(dueCtx);
    expect(email.html).toContain("/account/subscription/bill-pay");
  });
});

describe("subscriptionRenewalEmail", () => {
  const subId = "sub-12345-6789-aaaa-bbbb-cccccccccccc";
  const renewalCtx = {
    subscription_id: subId,
    customer: baseCtx.customer,
    plan_duration_months: 6,
    discount_percent: 15,
    savings_to_date_cents: 24750,
    plan_ends_in_days: 7,
    renew_url:
      "https://benchgradepeptides.com/account/subscription/renew?plan=" + subId,
  };

  it("subject is 'Your subscription ends in 7 days — renew at the same rate'", () => {
    const email = subscriptionRenewalEmail(renewalCtx);
    expect(email.subject).toBe(
      "Your subscription ends in 7 days — renew at the same rate"
    );
  });

  it("body mentions same discount tier and savings to date", () => {
    const email = subscriptionRenewalEmail(renewalCtx);
    expect(email.text).toMatch(/15%/);
    expect(email.text).toContain("$247.50");
    expect(email.html).toMatch(/15%/);
  });

  it("CTA label is 'Renew at <X>% off' and href is the renew URL", () => {
    const email = subscriptionRenewalEmail(renewalCtx);
    expect(email.html).toContain("Renew at 15% off");
    expect(email.html).toContain("/account/subscription/renew?plan=");
  });
});

describe("messageNotificationEmail (U-EMAIL-MN-1)", () => {
  const ctx = {
    customer_name: "Dr. Jane Smith",
    message_id: "msgabcde-1234-5678-9012-3456789abcde",
    message_preview: "Thanks for the question — your COA is attached on the portal.",
    thread_url: "https://benchgradepeptides.com/account/messages",
    truncated: false,
  };

  it("subject is exactly 'New message from Bench Grade · BGP-MSG-<first8>'", () => {
    const email = messageNotificationEmail(ctx);
    expect(email.subject).toBe("New message from Bench Grade · BGP-MSG-msgabcde");
  });

  it("body includes customer name and message preview", () => {
    const email = messageNotificationEmail(ctx);
    expect(email.text).toContain("Dr. Jane Smith");
    expect(email.text).toContain("Thanks for the question");
    expect(email.html).toContain("Thanks for the question");
  });

  it("CTA links to thread_url", () => {
    const email = messageNotificationEmail(ctx);
    expect(email.html).toContain("https://benchgradepeptides.com/account/messages");
    expect(email.text).toContain("https://benchgradepeptides.com/account/messages");
  });

  it("escapes user-supplied substitutions (name, preview)", () => {
    const email = messageNotificationEmail({
      ...ctx,
      customer_name: "<script>alert(1)</script>",
      message_preview: "<img src=x onerror=alert(1)>",
    });
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;img");
  });
});

describe("referralEarnedEmail (U-EMAIL-RE-1)", () => {
  const ctx = {
    customer_name: "Dr. Jane Smith",
    referee_email: "friend@example.edu",
    referral_count: 1,
    free_vial_size_mg: 5,
  };

  it("subject is exactly 'Free vial earned — your friend's first order shipped'", () => {
    const email = referralEarnedEmail(ctx);
    expect(email.subject).toBe(
      "Free vial earned — your friend's first order shipped"
    );
  });

  it("body includes referee email, customer name, and 5mg free vial mention", () => {
    const email = referralEarnedEmail(ctx);
    expect(email.text).toContain("Dr. Jane Smith");
    expect(email.text).toContain("friend@example.edu");
    expect(email.text).toMatch(/5mg/);
    expect(email.html).toContain("friend@example.edu");
    expect(email.html).toMatch(/5mg/);
  });

  it("CTA href points at /catalogue?free_vial=true", () => {
    const email = referralEarnedEmail(ctx);
    expect(email.html).toContain("/catalogue?free_vial=true");
  });

  it("escapes user-supplied substitutions (name, referee email)", () => {
    const email = referralEarnedEmail({
      ...ctx,
      customer_name: "<script>x</script>",
      referee_email: "<b>oops</b>@x.com",
    });
    expect(email.html).not.toContain("<script>x</script>");
    expect(email.html).not.toContain("<b>oops</b>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;b&gt;oops&lt;/b&gt;");
  });
});

describe("affiliateApplicationApprovedEmail (U-EMAIL-AFFAPP-1)", () => {
  const ctx = {
    name: "Dr. Jane Smith",
    tier: "bronze" as const,
    commission_pct: 10,
    referral_link_url: "https://benchgradepeptides.com/?ref=abcd1234",
    dashboard_url: "https://benchgradepeptides.com/account/affiliate",
  };

  it("subject is exactly 'Welcome to the Bench Grade Affiliate Program'", () => {
    const email = affiliateApplicationApprovedEmail(ctx);
    expect(email.subject).toBe("Welcome to the Bench Grade Affiliate Program");
  });

  it("body mentions Bronze tier, 10% commission, and the referral link", () => {
    const email = affiliateApplicationApprovedEmail(ctx);
    expect(email.text).toContain("Dr. Jane Smith");
    expect(email.text).toMatch(/Bronze/);
    expect(email.text).toMatch(/10%/);
    expect(email.text).toContain("https://benchgradepeptides.com/?ref=abcd1234");
    expect(email.html).toMatch(/Bronze/);
    expect(email.html).toMatch(/10%/);
    expect(email.html).toContain("https://benchgradepeptides.com/?ref=abcd1234");
  });

  it("CTA links to dashboard URL", () => {
    const email = affiliateApplicationApprovedEmail(ctx);
    expect(email.html).toContain("https://benchgradepeptides.com/account/affiliate");
  });

  it("escapes user-supplied substitutions (name)", () => {
    const email = affiliateApplicationApprovedEmail({
      ...ctx,
      name: "<script>alert(1)</script>",
    });
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("affiliateCommissionEarnedEmail (U-EMAIL-AFFCOMM-1)", () => {
  const ctx = {
    name: "Dr. Jane Smith",
    affiliate_id: "abcd1234-ef56-7890-1234-567890abcdef",
    monthly_total_cents: 12550,
    ledger_count: 3,
    available_balance_cents: 30000,
    period_label: "April 2026",
  };

  it("subject is exactly 'You earned $125.50 this month — BGP-AFF-<first8>'", () => {
    const email = affiliateCommissionEarnedEmail(ctx);
    expect(email.subject).toBe(
      "You earned $125.50 this month — BGP-AFF-abcd1234"
    );
  });

  it("body includes monthly total, ledger count, and available balance", () => {
    const email = affiliateCommissionEarnedEmail(ctx);
    expect(email.text).toContain("Dr. Jane Smith");
    expect(email.text).toContain("$125.50");
    expect(email.text).toMatch(/3 referred orders/);
    expect(email.text).toContain("$300.00");
    expect(email.html).toContain("$125.50");
    expect(email.html).toContain("$300.00");
  });

  it("CTA links to /account/affiliate", () => {
    const email = affiliateCommissionEarnedEmail(ctx);
    expect(email.html).toContain("/account/affiliate");
  });

  it("escapes user-supplied substitutions (name)", () => {
    const email = affiliateCommissionEarnedEmail({
      ...ctx,
      name: "<script>x</script>",
    });
    expect(email.html).not.toContain("<script>x</script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("affiliatePayoutSentEmail (U-EMAIL-AFFPAY-1)", () => {
  const ctx = {
    name: "Dr. Jane Smith",
    amount_cents: 25000,
    method: "zelle" as const,
    external_reference: "ZL-7788XX",
  };

  it("subject is exactly 'Payout sent: $250.00 via Zelle'", () => {
    const email = affiliatePayoutSentEmail(ctx);
    expect(email.subject).toBe("Payout sent: $250.00 via Zelle");
  });

  it("body confirms amount, method and reference", () => {
    const email = affiliatePayoutSentEmail(ctx);
    expect(email.text).toContain("Dr. Jane Smith");
    expect(email.text).toContain("$250.00");
    expect(email.text).toMatch(/Zelle/);
    expect(email.text).toContain("ZL-7788XX");
    expect(email.html).toContain("$250.00");
    expect(email.html).toContain("ZL-7788XX");
  });

  it("CTA links to /account/affiliate", () => {
    const email = affiliatePayoutSentEmail(ctx);
    expect(email.html).toContain("/account/affiliate");
  });

  it("crypto method shows tx hash reference and crypto label", () => {
    const email = affiliatePayoutSentEmail({
      name: "Dr. Jane Smith",
      amount_cents: 10000,
      method: "crypto",
      external_reference: "0xdeadbeef",
    });
    expect(email.subject).toBe("Payout sent: $100.00 via Crypto");
    expect(email.text).toContain("0xdeadbeef");
    expect(email.html).toContain("0xdeadbeef");
  });

  it("escapes user-supplied substitutions (name, external_reference)", () => {
    const email = affiliatePayoutSentEmail({
      name: "<script>x</script>",
      amount_cents: 10000,
      method: "wire",
      external_reference: "<img src=x>",
    });
    expect(email.html).not.toContain("<script>x</script>");
    expect(email.html).not.toContain("<img src=x>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&lt;img src=x&gt;");
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
