import { describe, it, expect } from "vitest";
import { buildCycleOrderRow } from "../cycle-row";
import type { SubscriptionRow, OrderRow } from "@/lib/supabase/types";

const SAMPLE_SUB: SubscriptionRow = {
  id: "11111111-1111-1111-1111-111111111111",
  customer_user_id: "22222222-2222-2222-2222-222222222222",
  plan_duration_months: 3,
  payment_cadence: "prepay",
  ship_cadence: "monthly",
  items: [
    {
      sku: "BGP-BPC-5",
      product_slug: "bpc-157",
      category_slug: "tissue-repair",
      name: "BPC-157",
      size_mg: 5,
      pack_size: 1,
      unit_price: 90,
      quantity: 2,
      vial_image: "/brand/vials/bpc-157.jpg",
    },
  ] as unknown as OrderRow["items"],
  cycle_subtotal_cents: 18_000,
  cycle_total_cents: 14_400,
  discount_percent: 20,
  status: "active",
  next_ship_date: "2026-05-01T00:00:00.000Z",
  next_charge_date: null,
  cycles_completed: 0,
  cycles_total: 3,
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
  paused_at: null,
  cancelled_at: null,
};

const PARENT_CUSTOMER: OrderRow["customer"] = {
  name: "Dr. Maya Chen",
  email: "maya@stanford.edu",
  ship_address_1: "353 Jane Stanford Way",
  ship_address_2: "Bldg 240",
  ship_city: "Stanford",
  ship_state: "CA",
  ship_zip: "94305",
  phone: "+14155551234",
  institution: "Stanford School of Medicine",
};

describe("buildCycleOrderRow", () => {
  const now = new Date("2026-05-01T12:00:00.000Z");
  const order_id = "33333333-3333-3333-3333-333333333333";

  it("sets payment_method to null (DB CHECK only allows wire/ach/zelle/crypto or null)", () => {
    const row = buildCycleOrderRow({
      order_id,
      subscription: SAMPLE_SUB,
      parent_customer: PARENT_CUSTOMER,
      cycle_subtotal_cents: 18_000,
      cycle_total_cents: 14_400,
      now,
    });
    expect(row.payment_method).toBeNull();
  });

  it("copies the parent order's customer JSON verbatim — no synthetic blanks", () => {
    const row = buildCycleOrderRow({
      order_id,
      subscription: SAMPLE_SUB,
      parent_customer: PARENT_CUSTOMER,
      cycle_subtotal_cents: 18_000,
      cycle_total_cents: 14_400,
      now,
    });
    expect(row.customer).toEqual(PARENT_CUSTOMER);
    expect(row.customer.name).not.toBe("");
    expect(row.customer.email).not.toBe("");
    expect(row.customer.ship_address_1).not.toBe("");
  });

  it("prepay cycles land as `funded`", () => {
    const row = buildCycleOrderRow({
      order_id,
      subscription: { ...SAMPLE_SUB, payment_cadence: "prepay" },
      parent_customer: PARENT_CUSTOMER,
      cycle_subtotal_cents: 18_000,
      cycle_total_cents: 14_400,
      now,
    });
    expect(row.status).toBe("funded");
  });

  it("bill_pay cycles land as `awaiting_payment`", () => {
    const row = buildCycleOrderRow({
      order_id,
      subscription: { ...SAMPLE_SUB, payment_cadence: "bill_pay" },
      parent_customer: PARENT_CUSTOMER,
      cycle_subtotal_cents: 18_000,
      cycle_total_cents: 14_400,
      now,
    });
    expect(row.status).toBe("awaiting_payment");
  });

  it("discount_cents = cycle subtotal − cycle total", () => {
    const row = buildCycleOrderRow({
      order_id,
      subscription: SAMPLE_SUB,
      parent_customer: PARENT_CUSTOMER,
      cycle_subtotal_cents: 18_000,
      cycle_total_cents: 14_400,
      now,
    });
    expect(row.discount_cents).toBe(3600);
    expect(row.total_cents).toBe(14_400);
  });

  it("links to the parent subscription via subscription_id and customer_user_id", () => {
    const row = buildCycleOrderRow({
      order_id,
      subscription: SAMPLE_SUB,
      parent_customer: PARENT_CUSTOMER,
      cycle_subtotal_cents: 18_000,
      cycle_total_cents: 14_400,
      now,
    });
    expect(row.subscription_id).toBe(SAMPLE_SUB.id);
    expect(row.customer_user_id).toBe(SAMPLE_SUB.customer_user_id);
  });
});
