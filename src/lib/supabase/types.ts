/**
 * Shared Supabase-row types.
 *
 * Source of truth for the schema lives in `supabase/migrations/*.sql`.
 * Applied migrations at launch: `0001_init_orders.sql` +
 * `0002_rate_limits.sql`.
 *
 * Catalog types (Product, ProductVariant, Category) are NOT in the live
 * schema today — the catalog is a TS constant (`src/lib/catalog/data.ts`)
 * and only order / acknowledgment / rate-limit tables actually live in
 * Postgres. When we move the catalog into Supabase those types go here.
 */

import type { OrderStatus } from "@/lib/orders/status";

export interface OrderRow {
  order_id: string;
  customer: {
    name: string;
    email: string;
    institution?: string;
    phone?: string;
    ship_address_1: string;
    ship_address_2?: string;
    ship_city: string;
    ship_state: string;
    ship_zip: string;
    notes?: string;
  };
  items: Array<{
    sku: string;
    product_slug: string;
    category_slug: string;
    name: string;
    size_mg: number;
    unit_price: number;
    quantity: number;
    vial_image: string;
  }>;
  subtotal_cents: number;
  acknowledgment: {
    certification_text: string;
    certification_version: string;
    certification_hash: string;
    is_adult: boolean;
    is_researcher: boolean;
    accepts_ruo: boolean;
    acknowledged_at: string;
    ip: string;
    user_agent: string;
  };
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface RuoAcknowledgmentRow {
  id: string;
  order_id: string | null;
  certification_text: string;
  certification_hash: string;
  is_adult: boolean;
  is_researcher: boolean;
  accepts_ruo: boolean;
  ip: string | null;
  user_agent: string | null;
  acknowledged_at: string;
  server_received_at: string;
}
