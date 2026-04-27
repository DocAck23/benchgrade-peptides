import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import {
  orderConfirmationEmail,
  paymentConfirmedEmail,
  orderShippedEmail,
  agerecodeFulfillmentEmail,
} from "@/lib/email/templates";
import { prelaunchWelcomeEmail } from "@/lib/email/templates/prelaunch";
import { subscriptionLifecycleEmail } from "@/lib/email/templates/subscription-lifecycle";
import type { CartItem } from "@/lib/cart/types";
import type { CustomerInfo } from "@/app/actions/orders";

export const dynamic = "force-dynamic";

const SAMPLE_CUSTOMER: CustomerInfo = {
  name: "Dr. Maya Chen",
  email: "maya.chen@example-research.org",
  institution: "Stanford Bio Lab",
  phone: "(415) 555-0142",
  ship_address_1: "353 Jane Stanford Way",
  ship_address_2: "Bldg 240, Rm 218",
  ship_city: "Stanford",
  ship_state: "CA",
  ship_zip: "94305",
  notes: "Please leave at the loading dock; lab manager will sign.",
};

const SAMPLE_ITEMS: CartItem[] = [
  {
    sku: "BPC-157-5MG-PACK1",
    product_slug: "bpc-157",
    category_slug: "healing-peptides",
    name: "BPC-157",
    size_mg: 5,
    pack_size: 1,
    unit_price: 60,
    quantity: 2,
    vial_image: "",
  },
  {
    sku: "TB500-10MG-PACK5",
    product_slug: "tb-500",
    category_slug: "healing-peptides",
    name: "TB-500",
    size_mg: 10,
    pack_size: 5,
    unit_price: 240,
    quantity: 1,
    vial_image: "",
  },
];

function ctxFor(method: "wire" | "ach" | "zelle" | "crypto") {
  return {
    order_id: "1a2b3c4d-1234-5678-9abc-def012345678",
    customer: SAMPLE_CUSTOMER,
    items: SAMPLE_ITEMS,
    subtotal_cents: 36000,
    payment_method: method,
  };
}

export async function GET(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const url = new URL(req.url);
  const t = url.searchParams.get("t") ?? "payment-confirmed";
  let html: string;
  switch (t) {
    case "order-confirmation-wire":
      html = orderConfirmationEmail(ctxFor("wire")).html;
      break;
    case "order-confirmation-ach":
      html = orderConfirmationEmail(ctxFor("ach")).html;
      break;
    case "order-confirmation-zelle":
      html = orderConfirmationEmail(ctxFor("zelle")).html;
      break;
    case "order-confirmation-crypto":
      html = orderConfirmationEmail(ctxFor("crypto")).html;
      break;
    case "order-shipped":
      html = orderShippedEmail({
        ...ctxFor("wire"),
        tracking_number: "9400111899223197428937",
        tracking_carrier: "USPS",
        tracking_url:
          "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223197428937",
        coa_lot_urls: [
          { sku: "BPC-157-5MG-PACK1", lot: "BGP-2026-04-A17", url: "#" },
          { sku: "TB500-10MG-PACK5", lot: "BGP-2026-04-B22", url: "#" },
        ],
      }).html;
      break;
    case "agerecode-fulfillment":
      html = agerecodeFulfillmentEmail(ctxFor("wire")).html;
      break;
    case "prelaunch-welcome":
      html = prelaunchWelcomeEmail().html;
      break;
    case "subscription-paused":
      html = subscriptionLifecycleEmail({
        kind: "paused",
        display_id: "BGP-SUB-1a2b3c4d",
      }).html;
      break;
    case "subscription-resumed":
      html = subscriptionLifecycleEmail({
        kind: "resumed",
        display_id: "BGP-SUB-1a2b3c4d",
        next_ship_date: new Date(Date.now() + 30 * 86400_000).toISOString(),
      }).html;
      break;
    case "subscription-cancelled":
      html = subscriptionLifecycleEmail({
        kind: "cancelled",
        display_id: "BGP-SUB-1a2b3c4d",
      }).html;
      break;
    case "subscription-skipped":
      html = subscriptionLifecycleEmail({
        kind: "skipped",
        display_id: "BGP-SUB-1a2b3c4d",
        next_ship_date: new Date(Date.now() + 60 * 86400_000).toISOString(),
      }).html;
      break;
    case "payment-confirmed":
    default:
      html = paymentConfirmedEmail(ctxFor("wire")).html;
  }
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
