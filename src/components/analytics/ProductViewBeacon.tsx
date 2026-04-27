"use client";

import { useEffect } from "react";
import { sendAnalyticsEvent } from "@/lib/analytics/client";

/**
 * Drop into a (server) PDP to record a `product_view` event when the
 * page is rendered client-side. Calls `sendAnalyticsEvent` directly —
 * does NOT depend on `window.bgpTrack`, so this is robust against
 * effect-order races where ProductViewBeacon's effect runs before the
 * global AnalyticsBeacon has installed its tracker.
 */
export function ProductViewBeacon({
  sku,
  productSlug,
  categorySlug,
}: {
  sku: string;
  productSlug: string;
  categorySlug: string;
}) {
  useEffect(() => {
    sendAnalyticsEvent("product_view", {
      properties: {
        sku,
        product_slug: productSlug,
        category_slug: categorySlug,
      },
    });
  }, [sku, productSlug, categorySlug]);
  return null;
}
