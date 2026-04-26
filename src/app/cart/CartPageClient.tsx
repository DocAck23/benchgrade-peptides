"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { useCart } from "@/lib/cart/CartContext";
import { formatPrice } from "@/lib/utils";

export function CartPageClient() {
  const { items, subtotal, itemCount, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
        <div className="label-eyebrow text-ink-muted mb-6">Cart</div>
        <h1 className="font-display text-5xl lg:text-6xl leading-tight text-ink mb-10">
          Your cart.
        </h1>
        <div className="border rule bg-paper-soft p-12 text-center">
          <p className="text-ink-soft mb-6">
            Your cart is empty. Browse the catalogue to add research compounds.
          </p>
          <Link
            href="/catalogue"
            className="inline-flex items-center h-12 px-8 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-teal transition-colors"
          >
            Browse the catalogue
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="max-w-5xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
      <div className="label-eyebrow text-ink-muted mb-4">Cart</div>
      <h1 className="font-display text-4xl lg:text-5xl leading-tight text-ink mb-10">
        Your cart.
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-10">
        <ul className="divide-y rule border rule bg-paper">
          {items.map((item) => (
            <li key={item.sku} className="p-3 sm:p-5 flex gap-3 sm:gap-5">
              <div className="relative w-20 h-20 sm:w-28 sm:h-28 bg-paper-soft border rule shrink-0 overflow-hidden">
                <Image
                  src={item.vial_image}
                  alt={item.name}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/catalogue/${item.category_slug}/${item.product_slug}`}
                    className="font-display text-lg text-ink hover:text-teal truncate"
                  >
                    {item.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeItem(item.sku)}
                    className="text-xs text-ink-muted hover:text-oxblood shrink-0"
                  >
                    Remove
                  </button>
                </div>
                <div className="font-mono-data text-[11px] sm:text-xs text-ink-muted mb-2 sm:mb-3 break-words">
                  {item.pack_size}-vial pack · {item.size_mg}mg ea. · {item.sku} · {formatPrice((item.unit_price / item.pack_size) * 100)}/vial
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 flex-wrap">
                  <div className="inline-flex items-center border rule shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                      className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-ink-soft hover:bg-paper-soft"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                    <span className="w-10 sm:w-12 text-center font-mono-data text-sm text-ink">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                      className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-ink-soft hover:bg-paper-soft"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>
                  <span className="font-mono-data text-sm sm:text-base text-ink shrink-0">
                    {formatPrice(item.unit_price * item.quantity * 100)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="lg:sticky lg:top-8 h-fit border rule bg-paper-soft p-6 space-y-5">
          <div>
            <div className="label-eyebrow text-ink-muted mb-2">Summary</div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-soft">
                {itemCount} {itemCount === 1 ? "vial" : "vials"}
              </span>
              <span className="font-mono-data text-lg text-ink">
                {formatPrice(subtotal * 100)}
              </span>
            </div>
          </div>
          <div className="border-t rule pt-4 text-xs text-ink-muted leading-relaxed space-y-2">
            <p>Shipping calculated at checkout.</p>
            <p>
              Payment by bank transfer only. Wire instructions are sent by email after order
              confirmation.{" "}
              <Link
                href="/why-no-cards"
                className="text-gold-dark hover:text-gold underline underline-offset-2"
              >
                Why no cards? →
              </Link>
            </p>
          </div>
          <Link
            href="/checkout"
            className="flex items-center justify-center w-full h-12 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-teal transition-colors"
          >
            Proceed to checkout
          </Link>
        </aside>
      </div>
    </article>
  );
}
