"use server";

/**
 * Customer-facing messaging server actions (Sprint 3 Wave B1).
 *
 * Cookie-scoped Supabase client throughout — RLS is the authoritative
 * ownership boundary. A hostile caller passing someone else's
 * customer_user_id or message id gets rowcount = 0 from the UPDATE / an
 * empty array from the SELECT, the same as if the row didn't exist.
 *
 * Body length cap (2000 chars) is enforced via Zod here AND at the DB
 * via a CHECK constraint — server-side defense in depth.
 */

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/client";
import type { MessageRow } from "@/lib/supabase/types";

const BodySchema = z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message too long.");

const UuidSchema = z.string().uuid("Invalid message id.");
const MarkReadSchema = z
  .array(UuidSchema)
  .min(1, "At least one message id required.")
  .max(50, "Too many ids.");

export interface SendCustomerMessageResult {
  ok: boolean;
  message_id?: string;
  error?: string;
}

export async function sendCustomerMessage(
  body: string
): Promise<SendCustomerMessageResult> {
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid body." };
  }

  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return { ok: false, error: "Please sign in to send a message." };
  }

  const { data, error } = await supa
    .from("messages")
    .insert({
      customer_user_id: user.id,
      sender: "customer",
      body: parsed.data,
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

  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return { ok: false, updated: 0, error: "Not authenticated." };

  const readAt = new Date().toISOString();
  const { data, error } = await supa
    .from("messages")
    .update({ read_at: readAt })
    .in("id", parsed.data)
    .eq("sender", "admin")
    .is("read_at", null)
    .select("id");
  if (error) return { ok: false, updated: 0, error: error.message };
  return { ok: true, updated: data?.length ?? 0 };
}
