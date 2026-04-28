"use server";

/**
 * Customer-facing messaging server actions (Sprint 3 Wave B1).
 *
 * Codex review #3 H3+M7: we previously routed every write through the
 * cookie-scoped client and trusted the broad messages RLS policies for
 * ownership. Migration 0011 dropped those policies (INSERT could forge the
 * sender column; UPDATE could mutate any column on an owned row). We now
 * use the cookie-scoped client only to resolve auth.uid() (the security
 * boundary), then route the actual INSERT/UPDATE through the service-role
 * client with the customer_user_id and sender hardcoded server-side.
 *
 * Body length cap (2000 chars) is enforced via Zod here AND at the DB
 * via a CHECK constraint — server-side defense in depth.
 */

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/client";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { MessageRow } from "@/lib/supabase/types";

const BodySchema = z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message too long.");

const UuidSchema = z.string().uuid("Invalid message id.");
const MarkReadSchema = z
  .array(UuidSchema)
  .min(1, "At least one message id required.")
  .max(50, "Too many ids.");

// Order IDs are short slugs like BGP-893CE45D. Anchored regex keeps the
// payload to known characters so it can't smuggle SQL/JSON metacharacters
// into the messages.order_id column. The DB also enforces a length CHECK.
const OrderIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,40}$/u, "Invalid order id.");

export interface SendCustomerMessageResult {
  ok: boolean;
  message_id?: string;
  error?: string;
}

export async function sendCustomerMessage(
  body: string,
  orderId?: string | null,
): Promise<SendCustomerMessageResult> {
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid body." };
  }

  // Optional order tag. Empty string and null both mean "not tagged" —
  // we only validate the slug shape when something non-empty is passed.
  let validatedOrderId: string | null = null;
  if (orderId != null && orderId !== "") {
    const orderParsed = OrderIdSchema.safeParse(orderId);
    if (!orderParsed.success) {
      return { ok: false, error: "Invalid order id." };
    }
    validatedOrderId = orderParsed.data;
  }

  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please sign in to send a message." };
  }

  // Service-role INSERT — sender hardcoded server-side. The cookie client
  // is only used to read auth.uid(); RLS no longer permits the customer
  // to insert directly (migration 0011), so a forged sender field on the
  // wire would have failed the policy anyway. Belt + suspenders.
  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  // Ownership check: the order_id must belong to the caller. Without
  // this, a hostile client could tag messages with arbitrary order IDs
  // (admin tools surface these and would mislead). RLS doesn't help —
  // the column has no FK, and even if it did, RLS fires on the messages
  // table, not on cross-table joins.
  //
  // Known race: between this SELECT and the INSERT below an admin could
  // delete or reassign the order. The worst-case outcome is a message
  // tagged with an order_id that no longer points to a live row — an
  // audit smell for admin tooling, not a security violation (the
  // attacker still can't tag someone else's order). Acceptable for
  // launch; revisit with an RPC + FK if cross-table integrity ever
  // becomes load-bearing.
  if (validatedOrderId) {
    const { data: own, error: ownErr } = await service
      .from("orders")
      .select("order_id")
      .eq("order_id", validatedOrderId)
      .eq("customer_user_id", user.id)
      .maybeSingle();
    if (ownErr || !own) {
      return { ok: false, error: "Order not found." };
    }
  }

  const { data, error } = await service
    .from("messages")
    .insert({
      customer_user_id: user.id,
      sender: "customer",
      body: parsed.data,
      order_id: validatedOrderId,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Insert failed." };
  }
  return { ok: true, message_id: (data as { id: string }).id };
}

/**
 * List the current customer's full thread, oldest first. RLS scopes
 * the SELECT to rows where customer_user_id = auth.uid(); a non-owner
 * (or unauthenticated) caller gets [].
 */
export async function listMyMessages(): Promise<MessageRow[]> {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return [];

  const { data, error } = await supa
    .from("messages")
    .select("*")
    .eq("customer_user_id", user.id)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as MessageRow[];
}

export interface MarkMessagesReadResult {
  ok: boolean;
  updated: number;
  error?: string;
}

/**
 * Mark admin replies as read by the customer. Atomic UPDATE filtered on
 * `sender='admin' AND read_at IS NULL` so a duplicate click is a no-op
 * (rowcount=0) and customer-sent rows can never be flagged.
 *
 * Field-restriction: only `read_at` is set — no other column smuggled.
 */
export async function markMessagesRead(
  messageIds: string[]
): Promise<MarkMessagesReadResult> {
  const parsed = MarkReadSchema.safeParse(messageIds);
  if (!parsed.success) {
    return {
      ok: false,
      updated: 0,
      error: parsed.error.issues[0]?.message ?? "Invalid ids.",
    };
  }

  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, updated: 0, error: "Not authenticated." };

  // Service-role UPDATE filtered explicitly on customer_user_id so the
  // owner gate is enforced server-side now that the broad UPDATE RLS
  // policy is gone (migration 0011). read_at is the only mutated field.
  const service = getSupabaseServer();
  if (!service) return { ok: false, updated: 0, error: "Database unavailable." };

  const readAt = new Date().toISOString();
  const { data, error } = await service
    .from("messages")
    .update({ read_at: readAt })
    .in("id", parsed.data)
    .eq("customer_user_id", user.id)
    .eq("sender", "admin")
    .is("read_at", null)
    .select("id");
  if (error) return { ok: false, updated: 0, error: error.message };
  return { ok: true, updated: data?.length ?? 0 };
}
