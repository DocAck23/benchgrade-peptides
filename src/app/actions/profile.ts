"use server";

/**
 * Customer profile actions (sprint G).
 *
 * `getMyProfile` reads the row scoped by auth.uid() through the
 * cookie-scoped client (RLS does the work). On first read for a
 * customer that has placed orders but never saved a profile, we
 * lazily seed from the most recent order's customer JSON so the
 * form starts populated rather than empty.
 *
 * `updateMyProfile` validates with Zod, upserts the row, then
 * mirrors first_name + last_name into auth.users.user_metadata so
 * the dashboard greeting picks up the edit. The mirror is
 * best-effort — a failure there is logged and swallowed; the
 * canonical profile row already saved is what the next page render
 * will read.
 */

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/client";
import { getSupabaseServer } from "@/lib/supabase/server";
import { US_STATES_AND_TERRITORIES } from "@/lib/geography/us-states";
import type { ProfileRow } from "@/lib/supabase/types";

export type ProfileFormValues = {
  first_name: string;
  last_name: string;
  phone: string;
  institution: string;
  ship_address_1: string;
  ship_address_2: string;
  ship_city: string;
  ship_state: string;
  ship_zip: string;
};

const ProfileSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required.").max(60),
  last_name: z.string().trim().min(1, "Last name is required.").max(60),
  phone: z.string().trim().max(40).default(""),
  institution: z.string().trim().max(200).default(""),
  ship_address_1: z.string().trim().max(200).default(""),
  ship_address_2: z.string().trim().max(200).default(""),
  ship_city: z.string().trim().max(100).default(""),
  // State / zip are optional on profile (the customer might not have
  // a default address) but if anything is filled in we validate it.
  ship_state: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine(
      (s) => s === "" || US_STATES_AND_TERRITORIES.has(s),
      "Valid US state, territory, or APO code is required.",
    )
    .default(""),
  ship_zip: z
    .string()
    .trim()
    .refine(
      (s) => s === "" || /^\d{5}(-\d{4})?$/u.test(s),
      "ZIP code is invalid.",
    )
    .default(""),
});

export interface GetProfileResult {
  ok: boolean;
  profile?: ProfileFormValues;
  email?: string;
  error?: string;
}

export async function getMyProfile(): Promise<GetProfileResult> {
  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // RLS enforces ownership — this query can only return the caller's
  // row. A 404 (no row yet) is fine: we'll seed from the latest order.
  const { data: row } = await cookie
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (row) {
    const r = row as ProfileRow;
    return {
      ok: true,
      email: user.email ?? "",
      profile: {
        first_name: r.first_name ?? "",
        last_name: r.last_name ?? "",
        phone: r.phone ?? "",
        institution: r.institution ?? "",
        ship_address_1: r.ship_address_1 ?? "",
        ship_address_2: r.ship_address_2 ?? "",
        ship_city: r.ship_city ?? "",
        ship_state: r.ship_state ?? "",
        ship_zip: r.ship_zip ?? "",
      },
    };
  }

  // Lazy seed from the most recent order's customer JSON so the form
  // starts populated. We do NOT auto-insert a profile row here — that
  // happens on first save. This keeps the surface read-only until the
  // user explicitly opts in.
  const { data: latest } = await cookie
    .from("orders")
    .select("customer")
    .eq("customer_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cust = (latest?.customer ?? {}) as Partial<{
    first_name: string;
    last_name: string;
    name: string;
    phone: string;
    institution: string;
    ship_address_1: string;
    ship_address_2: string;
    ship_city: string;
    ship_state: string;
    ship_zip: string;
  }>;
  const composed = (cust.name ?? "").trim();
  const splitFirst = composed.split(/\s+/, 1)[0] ?? "";
  const splitLast = composed.replace(splitFirst, "").trim();
  return {
    ok: true,
    email: user.email ?? "",
    profile: {
      first_name: cust.first_name ?? splitFirst,
      last_name: cust.last_name ?? splitLast,
      phone: cust.phone ?? "",
      institution: cust.institution ?? "",
      ship_address_1: cust.ship_address_1 ?? "",
      ship_address_2: cust.ship_address_2 ?? "",
      ship_city: cust.ship_city ?? "",
      ship_state: cust.ship_state ?? "",
      ship_zip: cust.ship_zip ?? "",
    },
  };
}

export interface UpdateProfileResult {
  ok: boolean;
  error?: string;
}

export async function updateMyProfile(
  input: Partial<ProfileFormValues>,
): Promise<UpdateProfileResult> {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const v = parsed.data;
  // Empty strings on optional fields persist as NULL — keeps the
  // table's "untouched defaults" semantics clean for SELECTs.
  const row = {
    user_id: user.id,
    first_name: v.first_name,
    last_name: v.last_name,
    phone: v.phone || null,
    institution: v.institution || null,
    ship_address_1: v.ship_address_1 || null,
    ship_address_2: v.ship_address_2 || null,
    ship_city: v.ship_city || null,
    ship_state: v.ship_state || null,
    ship_zip: v.ship_zip || null,
  };

  // Upsert: customer may not have a row yet (lazy seed didn't write).
  // RLS allows insert + update on user_id = auth.uid().
  const { error } = await cookie
    .from("profiles")
    .upsert(row, { onConflict: "user_id" });
  if (error) {
    console.error("[updateMyProfile] upsert failed:", error);
    return { ok: false, error: "Could not save profile." };
  }

  // Best-effort mirror to user_metadata so the dashboard greeting picks
  // up the edit. Service-role required (auth.admin updates require
  // service key); failure logs but doesn't fail the save.
  try {
    const service = getSupabaseServer();
    if (service) {
      const { data: userResp } = await service.auth.admin.getUserById(user.id);
      const existing = userResp?.user?.user_metadata ?? {};
      await service.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...existing,
          first_name: v.first_name,
          last_name: v.last_name,
        },
      });
    }
  } catch (mirrorErr) {
    console.error("[updateMyProfile] user_metadata mirror failed:", mirrorErr);
  }

  return { ok: true };
}
