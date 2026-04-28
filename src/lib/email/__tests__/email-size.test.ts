import { describe, it, expect } from "vitest";
import { orderConfirmationEmail } from "../templates";
import type { CartItem } from "@/lib/cart/types";

describe("rendered email size — Gmail clip threshold", () => {
  it("order confirmation stays under Gmail's 102KB clip", () => {
    const items: CartItem[] = [
      {
        sku: "BGP-SNAP8-10",
        product_slug: "snap-8",
        category_slug: "tissue-repair",
        name: "SNAP-8",
        size_mg: 10,
        pack_size: 1,
        unit_price: 70,
        quantity: 1,
        vial_image: "/brand/vials/snap-8-10mg.jpg",
      },
    ];
    const out = orderConfirmationEmail({
      order_id: "52aa5ba2-aaaa-bbbb-cccc-dddddddddddd",
      customer: {
        name: "Test Researcher",
        email: "test@example.com",
        phone: "555-1234",
        institution: "Test Lab",
        ship_address_1: "123 Lab St",
        ship_address_2: undefined,
        ship_city: "Boston",
        ship_state: "MA",
        ship_zip: "02101",
        notes: undefined,
      },
      items,
      subtotal_cents: 7000,
      total_cents: 7000,
      payment_method: "zelle",
    });
    expect(out.html.length).toBeLessThan(102400);
  });
});
