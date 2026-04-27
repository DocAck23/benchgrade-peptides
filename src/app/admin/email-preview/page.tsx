import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import {
  orderConfirmationEmail,
  paymentConfirmedEmail,
  orderShippedEmail,
  agerecodeFulfillmentEmail,
} from "@/lib/email/templates";
import type { CartItem } from "@/lib/cart/types";
import type { CustomerInfo } from "@/app/actions/orders";

export const dynamic = "force-dynamic";

const TEMPLATES = [
  { id: "order-confirmation-wire", label: "Order confirmation · Wire" },
  { id: "order-confirmation-ach", label: "Order confirmation · ACH" },
  { id: "order-confirmation-zelle", label: "Order confirmation · Zelle" },
  { id: "order-confirmation-crypto", label: "Order confirmation · Crypto" },
  { id: "payment-confirmed", label: "Payment confirmed" },
  { id: "order-shipped", label: "Order shipped" },
  { id: "agerecode-fulfillment", label: "AgeRecode fulfillment handoff" },
] as const;
type TemplateId = (typeof TEMPLATES)[number]["id"];

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

function render(id: TemplateId): { subject: string; html: string } {
  switch (id) {
    case "order-confirmation-wire":
      return orderConfirmationEmail(ctxFor("wire"));
    case "order-confirmation-ach":
      return orderConfirmationEmail(ctxFor("ach"));
    case "order-confirmation-zelle":
      return orderConfirmationEmail(ctxFor("zelle"));
    case "order-confirmation-crypto":
      return orderConfirmationEmail(ctxFor("crypto"));
    case "payment-confirmed":
      return paymentConfirmedEmail(ctxFor("wire"));
    case "order-shipped":
      return orderShippedEmail({
        ...ctxFor("wire"),
        tracking_number: "9400111899223197428937",
        tracking_carrier: "USPS",
        tracking_url:
          "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223197428937",
        coa_lot_urls: [
          { sku: "BPC-157-5MG-PACK1", lot: "BGP-2026-04-A17", url: "#" },
          { sku: "TB500-10MG-PACK5", lot: "BGP-2026-04-B22", url: "#" },
        ],
      });
    case "agerecode-fulfillment":
      return agerecodeFulfillmentEmail(ctxFor("wire"));
  }
}

export default async function EmailPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; mode?: string }>;
}) {
  if (process.env.NODE_ENV === "production" && !(await isAdmin())) {
    redirect("/admin/login");
  }
  const params = await searchParams;
  const mode = params.mode === "single" && params.t ? "single" : "grid";

  if (mode === "single") {
    const selected = (TEMPLATES.map((t) => t.id) as readonly string[]).includes(
      params.t ?? ""
    )
      ? (params.t as TemplateId)
      : TEMPLATES[0].id;
    const { subject, html } = render(selected);
    return (
      <article className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-baseline justify-between mb-6">
          <h1 className="font-display text-3xl text-ink">Email preview</h1>
          <a
            href="/admin/email-preview"
            className="text-xs px-3 py-1.5 border rule font-mono-data bg-paper hover:bg-paper-soft"
          >
            ← All templates
          </a>
        </div>
        <div className="mb-3 text-sm">
          <span className="label-eyebrow text-ink-muted mr-2">Subject</span>
          <span className="font-mono-data text-ink">{subject}</span>
        </div>
        <iframe
          title={`email preview — ${selected}`}
          srcDoc={html}
          className="w-full border rule"
          style={{ height: "1500px", background: "#EFEAE1" }}
        />
      </article>
    );
  }

  // Grid mode: render all templates side-by-side.
  const rendered = TEMPLATES.map((t) => ({ ...t, ...render(t.id) }));
  return (
    <article className="max-w-[1600px] mx-auto px-6 py-10">
      <h1 className="font-display text-3xl text-ink mb-2">
        Email preview · all templates
      </h1>
      <p className="text-sm text-ink-muted mb-6">
        Live render of every transactional email. Edit{" "}
        <code className="font-mono-data text-xs">src/lib/email/templates.ts</code> and
        refresh. Click any header to open that template in single-view.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {rendered.map((t) => (
          <section key={t.id} className="border rule bg-paper">
            <header className="border-b rule px-4 py-3 bg-paper-soft">
              <a
                href={`/admin/email-preview?mode=single&t=${t.id}`}
                className="block text-sm font-display text-ink hover:text-wine"
              >
                {t.label}
              </a>
              <div className="font-mono-data text-[11px] text-ink-muted mt-1 truncate">
                {t.subject}
              </div>
            </header>
            <iframe
              title={t.label}
              srcDoc={t.html}
              className="w-full block"
              style={{ height: "1100px", background: "#EFEAE1", border: 0 }}
            />
          </section>
        ))}
      </div>
    </article>
  );
}
