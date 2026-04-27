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
import { SUPPLIES, requiresReconstitution } from "@/lib/catalogue/data";
import type { CartApi, CartItem, SubscriptionMode } from "./types";
import { sendAnalyticsEvent } from "@/lib/analytics/client";
import {
  computeCartTotals,
  computeCartTotalsForCheckout,
  lineSubtotalCents,
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

/**
 * Top up bundled supplies (BAC water + each syringe pack) so that the
 * cart contains 1 of each per 5 lyophilized vials, ceil. Never
 * decrements existing supply quantities — the user's manual "I don't
 * need these" stays sticky. Returns a possibly-mutated copy of
 * `items`; if no top-up is needed, returns `items` unchanged.
 */
function topUpSupplies(items: CartItem[]): CartItem[] {
  const lyoVials = items
    .filter((i) => !i.is_supply && i.category_slug !== "liquid-formulations")
    .reduce((n, i) => n + i.quantity * i.pack_size, 0);
  const desired = Math.max(0, Math.ceil(lyoVials / 5));
  if (desired === 0) return items;
  let next = items;
  let changed = false;
  for (const supply of SUPPLIES) {
    const v = supply.variants[0];
    const cur = next.find((i) => i.sku === v.sku);
    const have = cur?.quantity ?? 0;
    const needed = desired - have;
    if (needed <= 0) continue;
    changed = true;
    if (cur) {
      next = next.map((i) =>
        i.sku === v.sku ? { ...i, quantity: i.quantity + needed } : i,
      );
    } else {
      next = [
        ...next,
        {
          sku: v.sku,
          product_slug: supply.slug,
          category_slug: supply.category_slug,
          name: supply.name,
          size_mg: v.size_mg,
          pack_size: v.pack_size,
          unit_price: v.retail_price,
          quantity: needed,
          vial_image: supply.vial_image,
          is_supply: true,
        },
      ];
    }
  }
  return changed ? next : items;
}

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
      // First-party analytics — direct import so it works even before
      // the AnalyticsBeacon component mounts and installs window.bgpTrack.
      sendAnalyticsEvent("add_to_cart", {
        properties: {
          sku: variant.sku,
          product_slug: product.slug,
          quantity,
          unit_price_cents: Math.round(variant.retail_price * 100),
        },
      });
      setItems((prev) => {
        // Step 1: add (or top-up) the requested line.
        const existing = prev.find((i) => i.sku === variant.sku);
        let next: CartItem[];
        if (existing) {
          next = prev.map((i) =>
            i.sku === variant.sku
              ? { ...i, quantity: i.quantity + quantity }
              : i
          );
        } else {
          const newItem: CartItem = {
            sku: variant.sku,
            product_slug: product.slug,
            category_slug: product.category_slug,
            name: product.name,
            size_mg: variant.size_mg,
            pack_size: variant.pack_size,
            unit_price: variant.retail_price,
            quantity,
            vial_image: product.vial_image,
            is_supply: variant.bundle_supply ? true : undefined,
          };
          next = [...prev, newItem];
        }

        // Step 2: top up bundle supplies if the freshly-added line is a
        // reconstitution-needing peptide. Supplies themselves never
        // trigger a top-up (otherwise removing then re-adding a supply
        // would re-trigger the cascade).
        if (!variant.bundle_supply && requiresReconstitution(product)) {
          next = topUpSupplies(next);
        }
        return next;
      });
      setDrawerOpen(true);
    },
    []
  );

  const updateQuantity = useCallback((sku: string, quantity: number) => {
    setItems((prev) => {
      let next: CartItem[];
      if (quantity <= 0) {
        next = prev.filter((i) => i.sku !== sku);
      } else {
        next = prev.map((i) => (i.sku === sku ? { ...i, quantity } : i));
      }
      // If the user just bumped a peptide line up (or kept the line),
      // make sure supplies are still topped up. Decrements that drop the
      // peptide count never re-add supplies (we only top up).
      const touched = prev.find((i) => i.sku === sku);
      if (touched && !touched.is_supply) {
        next = topUpSupplies(next);
      }
      return next;
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
    sendAnalyticsEvent("remove_from_cart", { properties: { sku } });
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
      // First-free supply pricing in dollars (not cents) so legacy
      // callers reading `cart.subtotal` see the same number the
      // drawer / cart page show.
      subtotal: items.reduce((s, i) => s + lineSubtotalCents(i) / 100, 0),
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
