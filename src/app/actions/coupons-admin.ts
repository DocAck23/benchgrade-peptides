"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Admin coupon CRUD. Mirrors the columns on `public.coupons` plus a
 * computed `redemptions_used` field pulled from `coupon_redemptions`.
 *
 * All mutations gate on `isAdmin()` — no service-role key in the client
 * path ever reaches this file.
 */

export interface CouponAdminRow {
  code: string;
  percent_off: number | null;
  flat_off_cents: number | null;
  min_subtotal_cents: number;
  valid_from: string | null;
  valid_until: string | null;
  max_redemptions: number | null;
  max_per_email: number;
  note: string | null;
  created_at: string;
  redemptions_used: number;
  total_discount_cents_applied: number;
}

const CreateCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_-]{2,64}$/u, "Code must be lowercase letters/digits/_-, 2-64 chars."),
    percent_off: z
      .union([z.number().int().min(1).max(100), z.null()])
      .optional()
      .default(null),
    flat_off_cents: z
      .union([z.number().int().min(1).max(1_000_000), z.null()])
      .optional()
      .default(null),
    min_subtotal_cents: z.number().int().min(0).max(10_000_000).default(0),
    valid_from: z.string().datetime().optional().nullable(),
    valid_until: z.string().datetime().optional().nullable(),
    max_redemptions: z.number().int().min(1).max(100_000).optional().nullable(),
    max_per_email: z.number().int().min(1).max(100).default(1),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .refine(
    (v) =>
      (v.percent_off !== null && v.flat_off_cents === null) ||
      (v.percent_off === null && v.flat_off_cents !== null),
    {
      message:
        "Set exactly one of percent_off or flat_off_cents (and leave the other null).",
    },
  );

export type CreateCouponInput = z.input<typeof CreateCouponSchema>;

export async function listCouponsAdmin(): Promise<{
  ok: boolean;
  rows?: CouponAdminRow[];
  error?: string;
}> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };

  const { data: coupons, error } = await supa
    .from("coupons")
    .select(
      "code, percent_off, flat_off_cents, min_subtotal_cents, valid_from, valid_until, max_redemptions, max_per_email, note, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };

  // One follow-up query for redemption stats. With <1k coupons this
  // is fine; if it ever grows we'd push it into a SQL view.
  const { data: redemptions } = await supa
    .from("coupon_redemptions")
    .select("coupon_code, discount_cents_applied");

  const stats = new Map<string, { count: number; sum: number }>();
  for (const r of (redemptions ?? []) as Array<{
    coupon_code: string;
    discount_cents_applied: number;
  }>) {
    const cur = stats.get(r.coupon_code) ?? { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += r.discount_cents_applied;
    stats.set(r.coupon_code, cur);
  }

  const rows: CouponAdminRow[] = (coupons ?? []).map((c) => {
    const s = stats.get(c.code) ?? { count: 0, sum: 0 };
    return {
      ...(c as Omit<
        CouponAdminRow,
        "redemptions_used" | "total_discount_cents_applied"
      >),
      redemptions_used: s.count,
      total_discount_cents_applied: s.sum,
    };
  });
  return { ok: true, rows };
}

export async function createCouponAdmin(
  input: CreateCouponInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  const parsed = CreateCouponSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };

  const v = parsed.data;
  const { error } = await supa.from("coupons").insert({
    code: v.code,
    percent_off: v.percent_off,
    flat_off_cents: v.flat_off_cents,
    min_subtotal_cents: v.min_subtotal_cents,
    valid_from: v.valid_from,
    valid_until: v.valid_until,
    max_redemptions: v.max_redemptions,
    max_per_email: v.max_per_email,
    note: v.note,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A coupon with that code already exists." };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath("/admin/coupons");
  return { ok: true };
}

export async function expireCouponAdmin(
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) return { ok: false, error: "Code required." };

  const { error } = await supa
    .from("coupons")
    .update({ valid_until: new Date().toISOString() })
    .eq("code", trimmed);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/coupons");
  return { ok: true };
}

export async function deleteCouponAdmin(
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) return { ok: false, error: "Code required." };

  // Coupons with redemptions cannot be deleted (we need them for the
  // historical audit trail). Force the user to expire instead.
  const { count } = await supa
    .from("coupon_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("coupon_code", trimmed);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "This code has redemptions. Expire it instead of deleting.",
    };
  }

  const { error } = await supa.from("coupons").delete().eq("code", trimmed);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/coupons");
  return { ok: true };
}
