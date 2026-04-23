"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import type { RUOAcknowledgmentPayload } from "@/components/compliance/RUOGate";
import type { CartItem } from "@/lib/cart/types";
import { getSupabaseServer } from "@/lib/supabase/server";

export interface CustomerInfo {
  name: string;
  email: string;
  institution: string;
  phone: string;
  ship_address_1: string;
  ship_address_2?: string;
  ship_city: string;
  ship_state: string;
  ship_zip: string;
  notes?: string;
}

export interface SubmitOrderInput {
  customer: CustomerInfo;
  items: CartItem[];
  acknowledgment: RUOAcknowledgmentPayload;
}

export interface SubmitOrderResult {
  ok: boolean;
  order_id?: string;
  error?: string;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function validate(input: SubmitOrderInput): string | null {
  const { customer, items, acknowledgment } = input;
  if (!customer.name?.trim()) return "Name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return "Valid email is required.";
  if (!customer.ship_address_1?.trim()) return "Shipping address is required.";
  if (!customer.ship_city?.trim()) return "City is required.";
  if (!customer.ship_state?.trim()) return "State is required.";
  if (!/^\d{5}(-\d{4})?$/.test(customer.ship_zip.trim())) return "ZIP code is invalid.";
  if (!items.length) return "Cart is empty.";
  if (!acknowledgment.is_adult || !acknowledgment.is_researcher || !acknowledgment.accepts_ruo) {
    return "RUO certification is required.";
  }
  return null;
}

export async function submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const headerBag = await headers();
  const ip =
    headerBag.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerBag.get("x-real-ip") ??
    "unknown";
  const userAgent = headerBag.get("user-agent") ?? "unknown";

  const subtotal_cents = Math.round(
    input.items.reduce((s, i) => s + i.unit_price * i.quantity, 0) * 100
  );

  const certification_hash = sha256Hex(input.acknowledgment.certification_text);
  const order_id = crypto.randomUUID();

  const row = {
    order_id,
    customer: input.customer,
    items: input.items,
    subtotal_cents,
    acknowledgment: {
      ...input.acknowledgment,
      certification_hash,
      server_received_at: new Date().toISOString(),
      ip,
      user_agent: userAgent,
    },
    status: "awaiting_wire" as const,
    created_at: new Date().toISOString(),
  };

  const supa = getSupabaseServer();
  if (supa) {
    const { error } = await supa.from("orders").insert(row);
    if (error) return { ok: false, error: `Order persistence failed: ${error.message}` };

    // Mirror the RUO acknowledgment into the compliance table so the
    // evidentiary record survives even if the order row is later deleted.
    const { error: ackError } = await supa.from("ruo_acknowledgments").insert({
      order_id,
      certification_text: input.acknowledgment.certification_text,
      certification_hash,
      is_adult: input.acknowledgment.is_adult,
      is_researcher: input.acknowledgment.is_researcher,
      accepts_ruo: input.acknowledgment.accepts_ruo,
      ip,
      user_agent: userAgent,
      acknowledged_at: input.acknowledgment.acknowledged_at,
    });
    if (ackError) {
      console.error("[submitOrder] RUO acknowledgment mirror failed:", ackError);
    }
  } else {
    console.info(
      "[submitOrder] Supabase not configured; logging order only:\n",
      JSON.stringify(row, null, 2)
    );
  }

  return { ok: true, order_id };
}
