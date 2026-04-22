/**
 * Database types for Supabase schema.
 * Keep in sync with supabase/schema.sql.
 */

export interface Category {
  slug: string;
  name: string;
  /** Internal MoA taxonomy label — not shown as a claim to customers */
  internal_taxonomy_label: string;
  sort_order: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  cas_number: string | null;
  molecular_formula: string | null;
  molecular_weight: number | null;
  sequence: string | null;
  category_slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size_mg: number;
  sku: string;
  wholesale_cost: number;
  retail_price: number;
  stock_on_hand: number;
  purity_percent: number | null;
  coa_url: string | null;
  lot_number: string | null;
  is_active: boolean;
}

export interface Customer {
  id: string;
  email: string;
  created_at: string;
  is_institutional: boolean;
  /** Hash of institutional domain verification, if performed */
  institutional_verification_ref: string | null;
}

export interface RuoAcknowledgment {
  id: string;
  customer_id: string | null;
  email: string;
  ip_address: string;
  user_agent: string;
  acknowledged_at: string;
  certification_text: string;
  /** SHA-256 of the acknowledged text — protects against retroactive changes */
  certification_hash: string;
}

export interface Order {
  id: string;
  customer_id: string;
  order_number: string;
  status: "pending_payment" | "payment_received" | "processing" | "shipped" | "delivered" | "cancelled";
  payment_method: "ach" | "wire" | "check";
  subtotal: number;
  shipping_cost: number;
  total: number;
  ruo_acknowledgment_id: string;
  shipping_address: ShippingAddress;
  created_at: string;
  updated_at: string;
}

export interface ShippingAddress {
  name: string;
  company: string | null;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string; // US only at launch
}

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  lot_number_at_fulfillment: string | null;
  coa_url_at_fulfillment: string | null;
}
