"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, Plus, Check } from "lucide-react";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalogue/data";
import { useCart } from "@/lib/cart/CartContext";
import { Button } from "@/components/ui/Button";
import { formatPrice, cn } from "@/lib/utils";

/**
 * Editable stack picker. Customer arrives at /catalogue/stacks/[slug] from
 * the hero or from /catalogue#popular-stacks; this component then lets them:
 *   - Pick a vial size per line (variant select)
 *   - Adjust per-line quantity
 *   - Remove a line entirely
 *   - Multiply the entire stack by a stack-quantity (1-10)
 *   - Add everything to cart in a single click
 *
 * Server provides the resolved (product, defaultVariant, lineQuantity)
 * tuples; the client manages the editable state. The "swap a vial for
 * another vial" feature is deferred — for now removing + the catalogue's
 * own product page covers the use case.
 */

export interface StackPickerLine {
  product: CatalogProduct;
  defaultVariantSku: string;
  defaultQuantity: number;
}

interface StackPickerFormProps {
  stackName: string;
  lines: StackPickerLine[];
}

interface EditableLine {
  /** stable id for keying — derived from product slug + index for unique drag/edit ops */
  id: string;
  product: CatalogProduct;
  variant: CatalogVariant;
  quantity: number;
}

export function StackPickerForm({ stackName, lines: initialLines }: StackPickerFormProps) {
  const { addItem, openDrawer } = useCart();
  const [stackQty, setStackQty] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [lines, setLines] = useState<EditableLine[]>(() =>
    initialLines.map((l, idx) => {
      const variant =
        l.product.variants.find((v) => v.sku === l.defaultVariantSku) ?? l.product.variants[0];
      return {
        id: `${l.product.slug}-${idx}`,
        product: l.product,
        variant,
        quantity: l.defaultQuantity,
      };
    })
  );

  const subtotalCents = useMemo(
    () =>
      lines.reduce(
        (sum, l) => sum + Math.round(l.variant.retail_price * 100) * l.quantity,
        0
      ) * stackQty,
    [lines, stackQty]
  );

  const totalVials = useMemo(
    () => lines.reduce((n, l) => n + l.quantity * stackQty, 0),
    [lines, stackQty]
  );

  function setLineVariant(lineId: string, sku: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const v = l.product.variants.find((vv) => vv.sku === sku);
        return v ? { ...l, variant: v } : l;
      })
    );
  }

  function setLineQuantity(lineId: string, raw: string) {
    const n = Math.max(1, Math.min(100, Math.floor(Number(raw) || 1)));
    setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, quantity: n } : l)));
  }

  function removeLine(lineId: string) {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  }

  function setStackQuantity(raw: string) {
    const n = Math.max(1, Math.min(10, Math.floor(Number(raw) || 1)));
    setStackQty(n);
  }

  function onAddToCart() {
    if (lines.length === 0) return;
    startTransition(() => {
      for (let i = 0; i < stackQty; i++) {
        for (const l of lines) {
          addItem(l.product, l.variant, l.quantity);
        }
      }
      setConfirmed(true);
      openDrawer();
      setTimeout(() => setConfirmed(false), 2200);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-12">
      {/* ── Editable lines ─────────────────────────────────────────────── */}
      <section aria-label="Stack contents" className="space-y-4">
        {lines.length === 0 ? (
          <div className="border border-rule bg-paper-soft p-8 text-center">
            <p className="text-ink-soft mb-4">All items removed from this stack.</p>
            <Link href="/catalogue" className="text-wine underline hover:text-gold-dark">
              Browse the catalogue →
            </Link>
          </div>
        ) : (
          <ul className="space-y-3 sm:space-y-4">
            {lines.map((l) => (
              <li
                key={l.id}
                className="border border-rule bg-paper-soft rounded-md p-3 sm:p-4 grid grid-cols-[64px_1fr] sm:grid-cols-[80px_1fr_auto_auto_auto] gap-3 sm:gap-4 items-center"
              >
                {/* Vial thumbnail — gives every line a visual anchor instead
                    of the spreadsheet rows the user called out. */}
                <Link
                  href={`/catalogue/${l.product.category_slug}/${l.product.slug}`}
                  className="row-span-2 sm:row-span-1 block w-16 sm:w-20 aspect-square bg-paper rounded-md overflow-hidden border border-rule"
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={l.product.vial_image}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-contain"
                  />
                </Link>
                <div className="min-w-0">
                  <Link
                    href={`/catalogue/${l.product.category_slug}/${l.product.slug}`}
                    className="block font-display text-lg sm:text-xl text-ink hover:text-wine transition-colors truncate"
                  >
                    {l.product.name}
                  </Link>
                  <p className="text-xs text-ink-muted truncate font-mono-data">
                    {l.variant.sku} · {formatPrice(l.variant.retail_price * 100)} / vial
                  </p>
                </div>

                {/* Variant select */}
                <label className="text-[11px] uppercase tracking-[0.08em] text-ink-muted font-display">
                  <span className="block mb-1">Vial size</span>
                  <select
                    value={l.variant.sku}
                    onChange={(e) => setLineVariant(l.id, e.target.value)}
                    className="block w-full sm:w-auto bg-paper border border-rule text-ink px-3 py-2 font-mono-data text-sm hover:border-gold-dark focus:outline-none focus:ring-2 focus:ring-gold-light"
                    aria-label={`Vial size for ${l.product.name}`}
                  >
                    {l.product.variants.map((v) => (
                      <option key={v.sku} value={v.sku}>
                        {v.size_mg}mg · {formatPrice(v.retail_price * 100)}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Quantity stepper — user direct ask: "get rid of typing
                    option in quantity". Stepper buttons only; no number
                    input. Step bounds 1..100 to match prior cap. */}
                <div className="text-[11px] uppercase tracking-[0.08em] text-ink-muted font-ui font-bold">
                  <span className="block mb-1">Qty</span>
                  <div className="inline-flex items-stretch border border-rule rounded-input bg-paper">
                    <button
                      type="button"
                      onClick={() => setLineQuantity(l.id, String(Math.max(1, l.quantity - 1)))}
                      disabled={l.quantity <= 1}
                      className="px-3 py-2 text-ink-muted hover:text-ink hover:bg-paper-soft disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                      aria-label={`Decrease quantity of ${l.product.name}`}
                    >
                      −
                    </button>
                    <span
                      className="inline-flex items-center justify-center min-w-[2.25rem] font-mono-data text-sm text-ink select-none"
                      aria-live="polite"
                      aria-label={`Quantity of ${l.product.name}`}
                    >
                      {l.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLineQuantity(l.id, String(Math.min(100, l.quantity + 1)))}
                      disabled={l.quantity >= 100}
                      className="px-3 py-2 text-ink-muted hover:text-ink hover:bg-paper-soft disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                      aria-label={`Increase quantity of ${l.product.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeLine(l.id)}
                  className="self-end sm:self-auto text-ink-muted hover:text-danger transition-colors p-2"
                  aria-label={`Remove ${l.product.name} from stack`}
                  title="Remove from stack"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}

      </section>

      {/* ── Sticky summary ─────────────────────────────────────────────── */}
      <aside
        className="border border-rule bg-paper-soft p-5 sm:p-6 lg:sticky lg:top-24 self-start space-y-5"
        aria-label={`${stackName} order summary`}
      >
        <div>
          <div className="label-eyebrow text-gold-dark mb-1.5">Your stack</div>
          <h2 className="font-display text-2xl text-ink leading-tight">{stackName}</h2>
        </div>

        <ul className="space-y-1.5 text-[13px] text-ink-soft border-t border-rule pt-3">
          {lines.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-3">
              <span className="truncate">
                {l.product.name} · {l.variant.size_mg}mg{l.quantity > 1 ? ` × ${l.quantity}` : ""}
              </span>
              <span className="font-mono-data text-ink whitespace-nowrap">
                {formatPrice(l.variant.retail_price * l.quantity * 100)}
              </span>
            </li>
          ))}
        </ul>

        <div className="block">
          <span className="block label-eyebrow text-ink-muted mb-1.5">How many of this stack?</span>
          {/* Stepper, not a number input — same UX as the per-line qty above. */}
          <div className="inline-flex items-stretch border border-rule rounded-input bg-paper">
            <button
              type="button"
              onClick={() => setStackQuantity(String(Math.max(1, stackQty - 1)))}
              disabled={stackQty <= 1}
              className="px-4 py-2 text-ink-muted hover:text-ink hover:bg-paper-soft disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              aria-label="Decrease stack quantity"
            >
              −
            </button>
            <span
              className="inline-flex items-center justify-center min-w-[3rem] font-mono-data text-sm text-ink select-none"
              aria-live="polite"
              aria-label="Number of stacks to order"
            >
              {stackQty}
            </span>
            <button
              type="button"
              onClick={() => setStackQuantity(String(Math.min(10, stackQty + 1)))}
              disabled={stackQty >= 10}
              className="px-4 py-2 text-ink-muted hover:text-ink hover:bg-paper-soft disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              aria-label="Increase stack quantity"
            >
              +
            </button>
          </div>
          <p className="text-[11px] text-ink-muted mt-1">
            {totalVials} vial{totalVials === 1 ? "" : "s"} total · Stack &amp; Save tier discount
            applies in cart at 3+ vials
          </p>
        </div>

        <div className="border-t border-rule pt-4 flex items-baseline justify-between">
          <span className="text-sm text-ink-soft">Subtotal</span>
          <span className="font-mono-data text-xl text-ink font-semibold">
            {formatPrice(subtotalCents)}
          </span>
        </div>

        <Button
          variant="gold"
          size="lg"
          type="button"
          onClick={onAddToCart}
          disabled={isPending || lines.length === 0}
          className={cn("w-full justify-center gap-2 transition-colors duration-200")}
          aria-label={`Add ${stackName} to cart`}
        >
          {confirmed ? (
            <>
              <Check className="w-4 h-4" strokeWidth={2.5} aria-hidden />
              <span>Added to cart</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
              <span>Add to cart</span>
            </>
          )}
        </Button>

        <p className="text-[11px] text-ink-muted text-center">
          You can keep editing in the cart drawer after adding.
        </p>
      </aside>
    </div>
  );
}

export default StackPickerForm;
