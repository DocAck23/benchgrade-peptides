"use server";

/**
 * Saved stacks — customer's named multi-vial compositions
 * (PRD-stack-builder).
 *
 * Four actions:
 *   listMyStacks       — read the caller's saved stacks
 *   saveStack(input)   — create or update (id optional). Validates
 *                        every SKU against the catalog and rejects
 *                        unknown / retired SKUs cleanly.
 *   deleteSavedStack   — remove a named stack
 *   loadSavedStack     — fetch one + filter against current catalog
 *                        so a stack pinned to a SKU we later retired
 *                        comes back with the dropped lines flagged
 *
 * RLS gates customer-facing reads/writes; the action layer also
 * filters explicitly on auth.uid() (belt + suspenders) and surfaces
 * friendly errors for the unique-name violation.
 */

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/client";
import { getSupabaseServer } from "@/lib/supabase/server";
import { PRODUCTS, SUPPLIES } from "@/lib/catalogue/data";
import type { SavedStackLine, SavedStackRow } from "@/lib/supabase/types";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Per-line and per-stack limits — kept in sync with CartLineSchema. */
const MAX_LINES_PER_STACK = 20;
const MAX_QTY_PER_LINE = 20;
/** Soft per-account cap so a runaway script can't fill the table. */
const MAX_STACKS_PER_USER = 50;
/** Postgres unique-violation SQLSTATE — surfaced as duplicate-name. */
const PG_UNIQUE_VIOLATION = "23505";

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

const SkuSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9-]{3,40}$/u, "Invalid SKU format.");

const LineSchema = z.object({
  sku: SkuSchema,
  quantity: z.number().int().positive().max(MAX_QTY_PER_LINE),
});

const SaveInput = z.object({
  /** Optional. Present → update an existing saved stack; absent → insert. */
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Stack name is required.")
    .max(100, "Stack name is too long (100 chars max)."),
  lines: z
    .array(LineSchema)
    .min(1, "Add at least one vial before saving.")
    .max(
      MAX_LINES_PER_STACK,
      `A stack can hold up to ${MAX_LINES_PER_STACK} different items.`,
    ),
});

export type SaveStackInput = z.input<typeof SaveInput>;

// Build a SKU set across both PRODUCTS and SUPPLIES so a saved stack
// can reference syringes/draw needles + product vials. Computed once
// at module load — the catalog is a TS constant.
const KNOWN_SKUS: ReadonlySet<string> = (() => {
  const set = new Set<string>();
  for (const p of PRODUCTS) for (const v of p.variants) set.add(v.sku);
  for (const p of SUPPLIES) for (const v of p.variants) set.add(v.sku);
  return set;
})();

function validateSkusOrError(
  lines: SavedStackLine[],
): { ok: true } | { ok: false; error: string } {
  const unknown: string[] = [];
  for (const l of lines) if (!KNOWN_SKUS.has(l.sku)) unknown.push(l.sku);
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Unknown SKU${unknown.length > 1 ? "s" : ""}: ${unknown.slice(0, 3).join(", ")}`,
    };
  }
  // Distinct SKU enforcement — no duplicate line for the same SKU.
  // Builder UI prevents duplicates by stacking quantity, but defense
  // in depth at the API boundary catches a hostile client.
  const skus = new Set<string>();
  for (const l of lines) {
    if (skus.has(l.sku))
      return { ok: false, error: `Duplicate SKU: ${l.sku}` };
    skus.add(l.sku);
  }
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Public actions
// -----------------------------------------------------------------------------

export interface ListResult {
  ok: boolean;
  stacks: SavedStackRow[];
  error?: string;
}

export async function listMyStacks(): Promise<ListResult> {
  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: true, stacks: [] };

  const { data, error } = await cookie
    .from("saved_stacks")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("[listMyStacks] read failed:", error);
    return { ok: false, stacks: [], error: "Could not load saved stacks." };
  }
  return { ok: true, stacks: (data ?? []) as SavedStackRow[] };
}

export interface SaveResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function saveStack(input: SaveStackInput): Promise<SaveResult> {
  const parsed = SaveInput.safeParse(input);
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
  if (!user) return { ok: false, error: "Sign in to save a stack." };

  const validation = validateSkusOrError(parsed.data.lines);
  if (!validation.ok) return { ok: false, error: validation.error };

  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  // Updating an existing stack — re-check ownership before writing
  // (RLS enforces this too; the explicit eq is belt-and-suspenders
  // and lets us return a clean "not found" instead of a generic RLS
  // permission denial).
  if (parsed.data.id) {
    const { data: existing } = await service
      .from("saved_stacks")
      .select("id")
      .eq("id", parsed.data.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing) {
      return { ok: false, error: "Stack not found." };
    }
    const { error } = await service
      .from("saved_stacks")
      .update({
        name: parsed.data.name,
        lines: parsed.data.lines,
      })
      .eq("id", parsed.data.id)
      .eq("user_id", user.id);
    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        return {
          ok: false,
          error: `You already have a stack named '${parsed.data.name}' — pick a different name.`,
        };
      }
      console.error("[saveStack] update failed:", error);
      return { ok: false, error: "Could not save." };
    }
    return { ok: true, id: parsed.data.id };
  }

  // Per-account stack count guardrail. RLS lets us count own rows
  // through the cookie client too, but service-role here keeps the
  // path inside one connection.
  const { count } = await service
    .from("saved_stacks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_STACKS_PER_USER) {
    return {
      ok: false,
      error: `You've saved the maximum of ${MAX_STACKS_PER_USER} stacks. Delete one before saving another.`,
    };
  }

  const { data: inserted, error } = await service
    .from("saved_stacks")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      lines: parsed.data.lines,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return {
        ok: false,
        error: `You already have a stack named '${parsed.data.name}' — pick a different name.`,
      };
    }
    console.error("[saveStack] insert failed:", error);
    return { ok: false, error: "Could not save." };
  }
  return { ok: true, id: (inserted as { id: string }).id };
}

export interface DeleteResult {
  ok: boolean;
  error?: string;
}

export async function deleteSavedStack(id: string): Promise<DeleteResult> {
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Invalid id." };

  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  const { error, data } = await service
    .from("saved_stacks")
    .delete()
    .eq("id", idParsed.data)
    .eq("user_id", user.id)
    .select("id");
  if (error) {
    console.error("[deleteSavedStack] failed:", error);
    return { ok: false, error: "Could not delete." };
  }
  if (!data || data.length === 0) {
    // RLS already blocks cross-user deletes, but be explicit so the
    // UI can show "stack not found" instead of optimistic success.
    return { ok: false, error: "Stack not found." };
  }
  return { ok: true };
}

export interface LoadedStack {
  id: string;
  name: string;
  lines: SavedStackLine[];
  /** SKUs in the saved stack that are no longer in the catalog. */
  dropped_skus: string[];
}

export interface LoadResult {
  ok: boolean;
  stack?: LoadedStack;
  error?: string;
}

/**
 * Fetch one saved stack and reconcile its lines against the current
 * catalog. Lines whose SKU no longer exists are filtered out and
 * returned in `dropped_skus` so the UI can surface "X items in this
 * stack are no longer available." Quantities exceeding the per-line
 * cap are clamped to MAX_QTY_PER_LINE.
 */
export async function loadSavedStack(id: string): Promise<LoadResult> {
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) return { ok: false, error: "Invalid id." };

  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data, error } = await cookie
    .from("saved_stacks")
    .select("*")
    .eq("id", idParsed.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[loadSavedStack] read failed:", error);
    return { ok: false, error: "Could not load stack." };
  }
  if (!data) return { ok: false, error: "Stack not found." };
  const row = data as SavedStackRow;

  const reconciled: SavedStackLine[] = [];
  const dropped: string[] = [];
  for (const l of row.lines ?? []) {
    if (!KNOWN_SKUS.has(l.sku)) {
      dropped.push(l.sku);
      continue;
    }
    reconciled.push({
      sku: l.sku,
      quantity: Math.max(1, Math.min(MAX_QTY_PER_LINE, l.quantity)),
    });
  }

  return {
    ok: true,
    stack: {
      id: row.id,
      name: row.name,
      lines: reconciled,
      dropped_skus: dropped,
    },
  };
}
