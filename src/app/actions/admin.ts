"use server";

import { redirect } from "next/navigation";
import { setAdminCookie, clearAdminCookie, isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function adminLogin(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { ok: false, error: "Password required." };
  const ok = await setAdminCookie(password);
  if (!ok) return { ok: false, error: "Invalid password." };
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  await clearAdminCookie();
  redirect("/admin/login");
}

export const ORDER_STATUSES = [
  "awaiting_wire",
  "funded",
  "shipped",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

function isValidStatus(s: unknown): s is OrderStatus {
  return typeof s === "string" && (ORDER_STATUSES as readonly string[]).includes(s);
}

function isValidUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized." };
  // Runtime validation — TS types don't narrow over the network boundary.
  // A forged request can set `status` to anything the client chooses.
  if (!isValidUuid(orderId)) return { ok: false, error: "Invalid order id." };
  if (!isValidStatus(status)) return { ok: false, error: "Invalid status." };
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };
  const { error } = await supa.from("orders").update({ status }).eq("order_id", orderId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

