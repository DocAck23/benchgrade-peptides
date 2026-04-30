"use client";

import Image from "next/image";
import Link from "next/link";
import { X, Minus, Plus, Package, LogIn, Tag } from "lucide-react";
import { useCart } from "@/lib/cart/CartContext";
import { lineSubtotalCents } from "@/lib/cart/discounts";
import { formatPrice, cn } from "@/lib/utils";
import { StackSaveProgress } from "./StackSaveProgress";
import { CartItemVariantSelect } from "./CartItemVariantSelect";
import { useOverlay } from "@/components/ui/Overlay";

export function CartDrawer() {
  const {
    items,
    itemCount,
    subtotal,
    totals,
    updateQuantity,
    removeItem,
    isDrawerOpen,
    closeDrawer,
  } = useCart();
  const hasStackSave = totals.stack_save_discount_cents > 0;
  const hasSameSku = totals.same_sku_discount_cents > 0;
  const hasAnyDiscount = hasStackSave || hasSameSku;

  // Foundation commit 8 of 22: migrated from bespoke focus-trap +
  // scroll-lock useEffects onto the shared useOverlay primitive
  // (Codex Review #1 fix H1). Behavior preserved.
  const { containerRef } = useOverlay<HTMLElement>(isDrawerOpen, {
    closeOnEscape: true,
    onClose: closeDrawer,
    restoreFocus: true,
    lockScroll: true,
    trapFocus: true,
  });

  return (
    <>
      <div
        aria-hidden="true"
        onClick={closeDrawer}
        className={cn(
          "fixed inset-0 z-40 bg-ink/40 transition-opacity",
          isDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />
      <aside
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
        inert={!isDrawerOpen}
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-md bg-paper border-l rule flex flex-col",
          "transition-transform duration-200 ease-out",
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b rule">
          <div>
            <div className="label-eyebrow text-ink-muted">Cart</div>
            <div className="text-sm text-ink">
              {itemCount === 0 ? "Empty" : `${itemCount} ${itemCount === 1 ? "item" : "items"}`}
            </div>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close cart"
            className="p-2 -mr-2 text-ink-soft hover:text-ink"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-6 text-center">
            <div>
              <p className="text-ink-soft mb-6">Your cart is empty.</p>
              <Link
                href="/catalogue"
                onClick={closeDrawer}
                className="inline-flex items-center h-11 px-6 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-gold transition-colors"
              >
                Browse the catalogue
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y rule">
              {items.map((item) => (
                <li key={item.sku} className="px-5 py-4 flex gap-3">
                  {/* Thumbnail — shrunk 80→64 px per direct user ask
                      ("we need the checkout pictures to be smaller"). For
                      supplies (BAC water / syringes / needles) without a
                      product photo, render a Package glyph so we don't
                      ship the broken-image '?' tile from the screenshot. */}
                  <div className="relative w-16 h-16 bg-paper-soft rounded-md border border-rule shrink-0 overflow-hidden">
                    {item.is_supply ? (
                      <div className="w-full h-full flex items-center justify-center text-gold-dark/70">
                        <Package className="w-6 h-6" strokeWidth={1.5} aria-hidden />
                      </div>
                    ) : (
                      <Image
                        src={item.vial_image}
                        alt={item.name}
                        fill
                        sizes="64px"
                        className="object-contain"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        href={`/catalogue/${item.category_slug}/${item.product_slug}`}
                        onClick={closeDrawer}
                        className="font-display text-base text-ink hover:text-gold truncate"
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeItem(item.sku)}
                        className="text-xs text-ink-muted hover:text-wine shrink-0"
                        aria-label={`Remove ${item.name} ${item.pack_size}-vial pack from cart`}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="font-mono-data text-[11px] text-ink-muted mb-2">
                      {item.is_supply ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="px-1.5 py-px bg-gold-light/40 text-gold-dark text-[9px] uppercase tracking-[0.1em]">
                            1st free
                          </span>
                          <span>{item.sku}</span>
                        </span>
                      ) : (
                        <>{item.pack_size}-vial pack · {item.sku}</>
                      )}
                    </div>
                    {!item.is_supply && (
                      <div className="mb-2">
                        <CartItemVariantSelect item={item} />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center border rule">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.sku, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center text-ink-soft hover:bg-paper-soft"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" strokeWidth={1.5} />
                        </button>
                        <span className="w-10 text-center font-mono-data text-sm text-ink">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.sku, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center text-ink-soft hover:bg-paper-soft"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" strokeWidth={1.5} />
                        </button>
                      </div>
                      <span className="font-mono-data text-sm text-ink">
                        {item.is_supply && lineSubtotalCents(item) === 0 ? (
                          <span className="text-gold-dark uppercase tracking-[0.1em] text-[10px]">
                            Free
                          </span>
                        ) : (
                          formatPrice(lineSubtotalCents(item))
                        )}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t rule px-5 py-5 space-y-4 bg-paper-soft">
              <StackSaveProgress />

              {/* Discount-code affordance — Praetorian-style. The actual
                  validation runs server-side at checkout (saves us a
                  round-trip on every keystroke). The hint reads as a
                  collapsed input that delegates to the dedicated coupon
                  field on the checkout page. */}
              <Link
                href="/checkout#coupon"
                onClick={closeDrawer}
                className="group flex items-center justify-between gap-2 w-full px-3 py-2.5 rounded-md border border-dashed border-gold-dark/40 bg-paper hover:border-gold-dark hover:bg-gold/5 transition-colors"
                aria-label="Have a discount code? Apply at checkout"
              >
                <span className="inline-flex items-center gap-2 text-xs text-ink-soft group-hover:text-wine">
                  <Tag className="w-3.5 h-3.5 text-gold-dark" strokeWidth={1.75} aria-hidden />
                  Have a discount code?
                </span>
                <span className="text-[11px] font-ui font-bold uppercase tracking-[0.10em] text-gold-dark group-hover:text-wine">
                  Apply →
                </span>
              </Link>

              {/* Sign-in nudge — Praetorian's checkout shows this top-of-
                  panel; we put it adjacent to the coupon row so both
                  affordances live in the same band. */}
              <Link
                href="/login?next=/checkout"
                onClick={closeDrawer}
                className="group flex items-center justify-between gap-2 -mt-2 px-3 py-2 text-xs text-ink-soft hover:text-wine transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <LogIn className="w-3.5 h-3.5 text-gold-dark" strokeWidth={1.75} aria-hidden />
                  Returning customer? Sign in to apply your tier.
                </span>
                <span className="text-gold-dark group-hover:text-wine">→</span>
              </Link>

              <div className="flex items-baseline justify-between">
                <span className="label-eyebrow text-ink-muted">Subtotal</span>
                <span
                  className={cn(
                    "font-mono-data text-sm",
                    hasAnyDiscount ? "text-ink-muted line-through" : "text-ink"
                  )}
                >
                  {formatPrice(subtotal * 100)}
                </span>
              </div>

              {hasStackSave && (
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-gold-dark">
                    Stack &amp; Save · {totals.stack_save_tier_percent}% off
                  </span>
                  <span className="font-mono-data text-sm text-gold-dark">
                    −{formatPrice(totals.stack_save_discount_cents)}
                  </span>
                </div>
              )}

              {hasSameSku && (
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-gold-dark">Same-SKU bonus · 5% off</span>
                  <span className="font-mono-data text-sm text-gold-dark">
                    −{formatPrice(totals.same_sku_discount_cents)}
                  </span>
                </div>
              )}

              {totals.free_shipping && (
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-gold-dark">Free domestic shipping</span>
                  <span className="font-mono-data text-sm text-gold-dark">included</span>
                </div>
              )}

              <div className="flex items-baseline justify-between border-t rule pt-3">
                <span className="label-eyebrow text-ink">Total</span>
                <span className="font-mono-data text-2xl text-wine">
                  {formatPrice(totals.total_cents)}
                </span>
              </div>

              <p className="text-xs text-ink-muted leading-relaxed">
                Shipping calculated at checkout. Payment by bank transfer only — order confirmation
                email includes wire instructions.{" "}
                <Link
                  href="/why-no-cards"
                  onClick={closeDrawer}
                  className="text-gold-dark hover:text-gold underline underline-offset-2"
                >
                  Why no cards? →
                </Link>
              </p>
              <Link
                href="/checkout"
                onClick={closeDrawer}
                className="flex items-center justify-center w-full h-12 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-gold transition-colors"
              >
                Proceed to checkout
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
