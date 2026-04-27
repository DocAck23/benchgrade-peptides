/**
 * First-party analytics event shapes. The `event_name` column on
 * `analytics_events` is constrained by a CHECK in the migration, so
 * this union must stay in sync with that list.
 */
export type AnalyticsEventName =
  | "pageview"
  | "product_view"
  | "add_to_cart"
  | "remove_from_cart"
  | "checkout_start"
  | "checkout_step"
  | "coupon_attempt"
  | "order_submitted"
  | "order_funded"
  | "subscription_started"
  | "affiliate_click"
  | "referral_click"
  | "coa_request"
  | "newsletter_signup";

export interface AnalyticsEventInput {
  name: AnalyticsEventName;
  path?: string;
  properties?: Record<string, unknown>;
}

export interface AnalyticsSessionInit {
  /** First page path the visitor lands on. */
  landing_path: string;
  /** document.referrer (or "" / null for direct). */
  referrer: string | null;
  /** Captured from query string on first hit. */
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
}

export const SESSION_COOKIE = "bgp_sess";
export const SESSION_TTL_DAYS = 30;
