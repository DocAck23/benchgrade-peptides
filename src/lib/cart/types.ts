import type { CatalogProduct, CatalogVariant } from "@/lib/catalog/data";

export interface CartItem {
  sku: string;
  product_slug: string;
  category_slug: string;
  name: string;
  /** Dose in mg (per vial). Mirrors product.dose_mg. */
  size_mg: number;
  /** Vials in this pack (1 / 5 / 10 for launch). */
  pack_size: number;
  /** Retail price for one whole pack (USD). */
  unit_price: number;
  /** Number of packs of this variant in the cart. */
  quantity: number;
  vial_image: string;
}

export interface CartState {
  items: CartItem[];
}

export interface CartApi {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  /** Stack & Save totals — discounts applied, free-shipping flag, etc. Wave 2d. */
  totals: import("./discounts").CartTotals;
  /** Next-tier nudge for the cart drawer / checkout summary; null at top tier. */
  nextTier: import("./discounts").NextTierInfo | null;
  addItem: (product: CatalogProduct, variant: CatalogVariant, quantity: number) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  removeItem: (sku: string) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  isDrawerOpen: boolean;
}
