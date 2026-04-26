"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalogue/data";
import type { CartApi, CartItem, SubscriptionMode } from "./types";
import {
  computeCartTotals,
  computeCartTotalsForCheckout,
  nextStackSaveTier,
} from "./discounts";

// Bump the storage key on schema changes so stale carts from the
// pre-pack-tier era don't resurface as broken line items.
const STORAGE_KEY = "bgp.cart.v2";
// Separate key so the cart and subscription draft can evolve independently.
const SUB_MODE_STORAGE_KEY = "bgp.subscription_mode.v1";

function isSubscriptionMode(x: unknown): x is SubscriptionMode {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    [1, 3, 6, 9, 12].includes(o.duration_months as number) &&
    (o.payment_cadence === "prepay" || o.payment_cadence === "bill_pay") &&
    (o.ship_cadence === "monthly" || o.ship_cadence === "quarterly" || o.ship_cadence === "once")
  );
}

function readStoredSubscriptionMode(): SubscriptionMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SUB_MODE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSubscriptionMode(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
const CartContext = createContext<CartApi | null>(null);

function readStoredItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is CartItem =>
        x &&
        typeof x.sku === "string" &&
        typeof x.product_slug === "string" &&
        typeof x.pack_size === "number" &&
        x.pack_size > 0 &&
        typeof x.quantity === "number" &&
        x.quantity > 0
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Start empty on first render to match SSR; hydrate from localStorage
  // on mount. Without this gate the server/client HTML diverges and
  // React throws a hydration error on any page with the cart badge.
  //
  // The merge (rather than replace) on mount matters: if the user clicks
  // Add-to-Cart before the mount effect runs, the in-memory state already
  // has that item — naïvely overwriting with localStorage would lose it.
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [subscriptionMode, setSubscriptionModeState] =
    useState<SubscriptionMode | null>(null);

  useEffect(() => {
    const stored = readStoredItems();
    setItems((inMemory) => {
      if (inMemory.length === 0) return stored;
      // Merge by SKU: sum quantities, prefer in-memory metadata.
      const merged = new Map<string, CartItem>(stored.map((i) => [i.sku, i]));
      for (const item of inMemory) {
        const prev = merged.get(item.sku);
        merged.set(item.sku, prev ? { ...item, quantity: prev.quantity + item.quantity } : item);
      }
      return [...merged.values()];
    });
    setSubscriptionModeState(readStoredSubscriptionMode());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore quota / private-mode failures — cart is ephemeral then.
    }
  }, [items, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (subscriptionMode === null) {
        window.localStorage.removeItem(SUB_MODE_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          SUB_MODE_STORAGE_KEY,
          JSON.stringify(subscriptionMode),
        );
      }
    } catch {
      // Same swallow as the cart write — survives quota / private-mode.
    }
  }, [subscriptionMode, hydrated]);

  const addItem = useCallback(
    (product: CatalogProduct, variant: CatalogVariant, quantity: number) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.sku === variant.sku);
        if (existing) {
          return prev.map((i) =>
            i.sku === variant.sku ? { ...i, quantity: i.quantity + quantity } : i
          );
        }
        const next: CartItem = {
          sku: variant.sku,
          product_slug: product.slug,
          category_slug: product.category_slug,
          name: product.name,
          size_mg: variant.size_mg,
          pack_size: variant.pack_size,
          unit_price: variant.retail_price,
          quantity,
          vial_image: product.vial_image,
        };
        return [...prev, next];
      });
      setDrawerOpen(true);
    },
    []
  );

  const updateQuantity = useCallback((sku: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.sku !== sku);
      return prev.map((i) => (i.sku === sku ? { ...i, quantity } : i));
    });
  }, []);

  const changeItemVariant = useCallback(
    (currentSku: string, product: CatalogProduct, newVariant: CatalogVariant) => {
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.sku === currentSku);
        if (idx === -1) return prev;
        const current = prev[idx];
        // If the target variant is already in the cart as a separate line,
        // merge quantities and drop the old line.
        const existingTargetIdx = prev.findIndex(
          (i) => i.sku === newVariant.sku && i.sku !== currentSku
        );
        if (existingTargetIdx !== -1) {
          const next = [...prev];
          next[existingTargetIdx] = {
            ...next[existingTargetIdx],
            quantity: next[existingTargetIdx].quantity + current.quantity,
          };
          next.splice(idx, 1);
          return next;
        }
        // Otherwise rewrite this line's variant fields in place.
        const next = [...prev];
        next[idx] = {
          ...current,
          sku: newVariant.sku,
          size_mg: newVariant.size_mg,
          pack_size: newVariant.pack_size,
          unit_price: newVariant.retail_price,
          // name + product_slug + category_slug + vial_image stay the same
          // (same product, different size).
        };
        return next;
      });
    },
    []
  );

  const removeItem = useCallback((sku: string) => {
    setItems((prev) => prev.filter((i) => i.sku !== sku));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const setSubscriptionMode = useCallback((mode: SubscriptionMode | null) => {
    setSubscriptionModeState(mode);
  }, []);

  const totals = useMemo(() => computeCartTotals(items), [items]);
  const checkoutTotals = useMemo(
    () => computeCartTotalsForCheckout(items, subscriptionMode),
    [items, subscriptionMode],
  );
  const nextTier = useMemo(() => nextStackSaveTier(totals.vial_count), [totals.vial_count]);

  const api = useMemo<CartApi>(
    () => ({
      items,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((s, i) => s + i.unit_price * i.quantity, 0),
      totals,
      checkoutTotals,
      nextTier,
      subscriptionMode,
      setSubscriptionMode,
      addItem,
      changeItemVariant,
      updateQuantity,
      removeItem,
      clear,
      openDrawer,
      closeDrawer,
      isDrawerOpen,
    }),
    [
      items,
      totals,
      checkoutTotals,
      nextTier,
      subscriptionMode,
      setSubscriptionMode,
      addItem,
      updateQuantity,
      removeItem,
      clear,
      openDrawer,
      closeDrawer,
      isDrawerOpen,
    ],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
