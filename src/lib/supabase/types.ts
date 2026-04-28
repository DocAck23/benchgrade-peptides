/**
 * Shared Supabase-row types.
 *
 * Source of truth for the schema lives in `supabase/migrations/*.sql`.
 * Applied migrations at launch: `0001_init_orders.sql` +
 * `0002_rate_limits.sql`.
 *
 * Catalogue types (Product, ProductVariant, Category) are NOT in the live
 * schema today — the catalog is a TS constant (`src/lib/catalogue/data.ts`)
 * and only order / acknowledgment / rate-limit tables actually live in
 * Postgres. When we move the catalogue into Supabase those types go here.
 */

import type { OrderStatus } from "@/lib/orders/status";

export interface OrderRow {
  order_id: string;
  customer: {
    /**
     * Composed display name. Always set: for new orders we compose it
     * from first_name + last_name on insert; legacy orders predating
     * the split carry the raw single-field value here.
     */
    name: string;
    /**
     * First / last name pair captured at checkout from sprint G onward.
     * Optional on the type so legacy rows still validate. Reader code
     * should prefer first_name when present and fall back to splitting
     * `name` on whitespace (see firstNameOf helper).
     */
    first_name?: string;
    last_name?: string;
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
  /** Server-computed discount in cents (Stack&Save + Same-SKU multiplier). */
  discount_cents?: number;
  /** Server-computed amount owed in cents (subtotal_cents - discount_cents). */
  total_cents?: number;
  /** Free-vial entitlement captured at order time; null if no tier reached. */
  free_vial_entitlement?: { size_mg: 5 | 10 } | null;
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
  tracking_number?: string | null;
  tracking_carrier?: 'USPS' | 'UPS' | 'FedEx' | 'DHL' | null;
  shipped_at?: string | null;
  customer_user_id?: string | null;
  subscription_id?: string | null;
  /**
   * Locked referral attribution captured at order placement from the
   * bgp_ref cookie (sprint G1, migration 0027). PRD §4.11: first
   * attribution wins; historical edits to the referrals table no
   * longer affect rewards earned on this order.
   */
  referrer_user_id?: string | null;
  /**
   * Sequential invoice number assigned at insert via the
   * orders_invoice_seq sequence (starts at 196). Parallel to order_id
   * which stays the customer-facing slug. Display via formatInvoiceNumber.
   */
  invoice_number: number;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRow {
  id: string;
  customer_user_id: string;
  plan_duration_months: 1 | 3 | 6 | 9 | 12;
  payment_cadence: 'prepay' | 'bill_pay';
  ship_cadence: 'monthly' | 'quarterly' | 'once';
  items: OrderRow['items'];
  cycle_subtotal_cents: number;
  cycle_total_cents: number;
  discount_percent: number;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  next_ship_date: string | null;
  next_charge_date: string | null;
  cycles_completed: number;
  cycles_total: number;
  created_at: string;
  updated_at: string;
  paused_at: string | null;
  cancelled_at: string | null;
}

export interface MessageRow {
  id: string;
  customer_user_id: string;
  sender: 'customer' | 'admin';
  body: string;
  /** Optional human order slug (e.g. BGP-XXXX) when the message is
   *  scoped to a specific order; null otherwise. Added in migration
   *  0023; legacy rows are null. */
  order_id: string | null;
  created_at: string;
  read_at: string | null;
}

/**
 * Customer profile row (one per auth.users.id). Source of truth for
 * editable defaults: shipping address, name, contact info. Optional
 * fields are null when the customer hasn't filled them in. Mirrored
 * to auth.users.user_metadata.first_name/last_name on save so the
 * dashboard greeting picks up edits without a join.
 */
export interface ProfileRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  institution: string | null;
  ship_address_1: string | null;
  ship_address_2: string | null;
  ship_city: string | null;
  ship_state: string | null;
  ship_zip: string | null;
  created_at: string;
  updated_at: string;
}

/** Customer status tier (sprint G1). Lowercase to match the Postgres enum. */
export type RewardTier =
  | "initiate"
  | "researcher"
  | "principal"
  | "fellow"
  | "laureate";

/** Every credit/debit on the rewards ledger. Append-only audit trail. */
export type PointsLedgerKind =
  | "earn_own_spend"
  | "earn_referee_first"
  | "earn_referee_spend"
  | "redeem_credit"
  | "redeem_raffle_entry"
  | "redeem_vial_5"
  | "redeem_vial_10"
  | "redeem_shipping"
  | "admin_credit"
  | "admin_debit"
  | "reversal";

export interface PointsLedgerRow {
  id: string;
  user_id: string;
  kind: PointsLedgerKind;
  /** Signed change to tier-points bucket (zero for pure redemptions). */
  tier_delta: number;
  /** Signed change to redeemable balance. */
  balance_delta: number;
  /** First-of-month date string (YYYY-MM-DD); used for rolling-window aging. */
  bucket_month: string;
  source_order_id: string | null;
  source_referral_user_id: string | null;
  note: string | null;
  created_at: string;
}

/** Denormalized rewards state per user; recomputed from ledger. */
export interface UserRewardsRow {
  user_id: string;
  tier: RewardTier;
  tier_points: number;
  available_balance: number;
  lifetime_points_earned: number;
  referee_count: number;
  referee_total_spend_cents: number;
  free_shipping_until: string | null;
  recomputed_at: string;
}

export type VialCreditSource = "redemption" | "raffle" | "admin";

export interface VialCreditRow {
  id: string;
  user_id: string;
  source: VialCreditSource;
  /** Max vial size redeemable; null = unrestricted (raffle "any vial"). */
  max_size_mg: number | null;
  issued_at: string;
  redeemed_at: string | null;
  redeemed_order_id: string | null;
  note: string | null;
}

export interface ReferralCodeRow {
  code: string;
  owner_user_id: string;
  created_at: string;
}

export interface ReferralRow {
  id: string;
  referrer_user_id: string;
  referee_user_id: string | null;
  referee_email: string;
  code: string;
  attributed_at: string;
  redeemed_at: string | null;
  status: 'pending' | 'shipped' | 'redeemed' | 'cancelled';
  first_order_id: string | null;
  created_at: string;
}

export interface FreeVialEntitlementRow {
  id: string;
  customer_user_id: string;
  size_mg: 5 | 10;
  source: 'referral' | 'stack_save_8' | 'stack_save_12' | 'admin_grant';
  source_referral_id: string | null;
  granted_at: string;
  redeemed_at: string | null;
  redeemed_order_id: string | null;
  status: 'available' | 'redeemed' | 'expired';
}

export interface AffiliateApplicationRow {
  id: string;
  applicant_email: string;
  applicant_name: string;
  audience_description: string;
  website_or_social: string | null;
  applicant_user_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_admin: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AffiliateRow {
  id: string;
  user_id: string;
  application_id: string | null;
  tier: 'bronze' | 'silver' | 'gold' | 'eminent';
  payout_method: 'zelle' | 'crypto' | 'wire';
  payout_handle: string | null;
  available_balance_cents: number;
  total_earned_cents: number;
  total_paid_cents: number;
  total_redeemed_cents: number;
  approved_at: string;
  created_at: string;
  updated_at: string;
}

export interface CommissionLedgerRow {
  id: string;
  affiliate_id: string;
  source_referral_id: string | null;
  source_order_id: string | null;
  kind: 'earned' | 'clawback' | 'redemption_debit' | 'payout_debit';
  amount_cents: number;
  tier_at_time: string;
  created_at: string;
}

export interface AffiliatePayoutRow {
  id: string;
  affiliate_id: string;
  amount_cents: number;
  method: 'zelle' | 'crypto' | 'wire';
  external_reference: string | null;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
  sent_at: string | null;
  notes: string | null;
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
