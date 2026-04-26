"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Minus, Plus } from "lucide-react";
import { useCart } from "@/lib/cart/CartContext";
import { formatPrice, cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function CartDrawer() {
  const { items, itemCount, subtotal, updateQuantity, removeItem, isDrawerOpen, closeDrawer } =
    useCart();
  const panelRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isDrawerOpen) return;
    triggerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    // Defer so the drawer has its final dimensions before we move focus.
    const t = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDrawer();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener("keydown", onKey);
      // Return focus to whatever opened the drawer (the Header cart button).
      triggerRef.current?.focus();
    };
  }, [isDrawerOpen, closeDrawer]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isDrawerOpen]);

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
        ref={panelRef}
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
                href="/catalog"
                onClick={closeDrawer}
                className="inline-flex items-center h-11 px-6 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-gold transition-colors"
              >
                Browse the catalog
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y rule">
              {items.map((item) => (
                <li key={item.sku} className="px-6 py-4 flex gap-4">
                  <div className="relative w-20 h-20 bg-paper-soft border rule shrink-0 overflow-hidden">
                    <Image
                      src={item.vial_image}
                      alt={item.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        href={`/catalog/${item.category_slug}/${item.product_slug}`}
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
                    <div className="font-mono-data text-xs text-ink-muted mb-2">
                      {item.pack_size}-vial pack · {item.size_mg}mg ea. · {item.sku}
                    </div>
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
                        {formatPrice(item.unit_price * item.quantity * 100)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t rule px-6 py-5 space-y-4 bg-paper-soft">
              <div className="flex items-baseline justify-between">
                <span className="label-eyebrow text-ink-muted">Subtotal</span>
                <span className="font-mono-data text-lg text-ink">
                  {formatPrice(subtotal * 100)}
                </span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                Shipping calculated at checkout. Payment by bank transfer only — order confirmation
                email includes wire instructions.
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
