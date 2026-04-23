import type { CatalogProduct, CatalogVariant } from "@/lib/catalog/data";

export interface CartItem {
  sku: string;
  product_slug: string;
  category_slug: string;
  name: string;
  size_mg: number;
  unit_price: number;
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
  addItem: (product: CatalogProduct, variant: CatalogVariant, quantity: number) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  removeItem: (sku: string) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  isDrawerOpen: boolean;
}
