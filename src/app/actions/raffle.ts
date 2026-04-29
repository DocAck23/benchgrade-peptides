"use server";

/**
 * Raffle actions (sprint G3 of the rewards system).
 *
 * Three flows:
 *   getMyRaffleEntries  — customer's live entries-this-month count.
 *                         Computed on demand from rewards row +
 *                         this-month spend; not snapshotted yet.
 *   snapshotRaffleMonth — cron-driven, last day of month at 23:55 UTC.
 *                         Walks every active fingerprint+user, computes
 *                         entries, writes raffle_entries rows. Marks
 *                         entry_snapshot_at on the raffle_months row.
 *   drawRaffleMonth     — cron-driven, 1st of month at 09:00 UTC.
 *                         Picks a weighted-random winner from the
 *                         frozen entries. Sets winner_user_id +
 *                         drawn_at. Admin must confirm before any
 *                         prize side-effects (vial credit, cash
 *                         payout) are issued.
 *
 * `confirmRaffleDraw` is a separate admin action that fires the prize
 * side-effects after the founder eyeballs the result — required step
 * before any winner email goes out (PRD §4.9).
 */

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/client";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import {
  computeRaffleEntries,
  monthKey,
  startOfMonthUtc,
  startOfNextMonthUtc,
} from "@/lib/raffle/entries";
import type {
  RaffleMonthRow,
  RaffleEntryRow,
  RewardTier,
} from "@/lib/supabase/types";

// -----------------------------------------------------------------------------
// Customer-facing read
// -----------------------------------------------------------------------------

export interface MyRaffleEntriesResult {
  ok: boolean;
  entry_count: number;
  base_from_tier: number;
  from_own_spend: number;
  from_referee_spend: number;
  current_month: string;
  prize?: {
    kind: "cash" | "vials_2";
    amount_cents: number | null;
    vial_size_cap_mg: number | null;
  };
  error?: string;
}

/**
 * Live entries-this-month count for the signed-in customer. Computed
 * on demand because the snapshot is end-of-month — during the month,
 * the dashboard wants the running total.
 */
export async function getMyRaffleEntries(): Promise<MyRaffleEntriesResult> {
  const empty: MyRaffleEntriesResult = {
    ok: false,
    entry_count: 0,
    base_from_tier: 0,
    from_own_spend: 0,
    from_referee_spend: 0,
    current_month: monthKey(startOfMonthUtc()),
  };
  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ...empty, error: "Not authenticated." };

  const monthStart = startOfMonthUtc();
  const monthEnd = startOfNextMonthUtc();
  const monthKeyStr = monthKey(monthStart);

  // Pull tier from user_rewards.
  const { data: rewards } = await cookie
    .from("user_rewards")
    .select("tier")
    .eq("user_id", user.id)
    .maybeSingle();
  const tier: RewardTier =
    (rewards as { tier?: RewardTier } | null)?.tier ?? "initiate";

  // Own-spend this month (funded orders).
  const { data: ownOrders } = await cookie
    .from("orders")
    .select("total_cents")
    .eq("customer_user_id", user.id)
    .eq("status", "funded")
    .gte("funded_at", monthStart.toISOString())
    .lt("funded_at", monthEnd.toISOString());
  const ownSpend = (ownOrders ?? []).reduce(
    (s, r) => s + ((r as { total_cents: number | null }).total_cents ?? 0),
    0,
  );

  // Referee spend this month — orders with this user as referrer_user_id.
  const { data: refOrders } = await cookie
    .from("orders")
    .select("total_cents")
    .eq("referrer_user_id", user.id)
    .eq("status", "funded")
    .gte("funded_at", monthStart.toISOString())
    .lt("funded_at", monthEnd.toISOString());
  const refSpend = (refOrders ?? []).reduce(
    (s, r) => s + ((r as { total_cents: number | null }).total_cents ?? 0),
    0,
  );

  const entries = computeRaffleEntries({
    tier,
    ownSpendCentsThisMonth: ownSpend,
    refereeSpendCentsThisMonth: refSpend,
  });

  // Pull this-month prize spec (if admin pre-configured it). Public read
  // policy lets even an unauthenticated visitor see what the prize is,
  // so the page can advertise "win $500 in May" without a login.
  const { data: monthRow } = await cookie
    .from("raffle_months")
    .select("prize_kind, prize_amount_cents, vial_size_cap_mg")
    .eq("month", monthKeyStr)
    .maybeSingle();
  const prize = (monthRow ?? null) as
    | {
        prize_kind: "cash" | "vials_2";
        prize_amount_cents: number | null;
        vial_size_cap_mg: number | null;
      }
    | null;

  return {
    ok: true,
    entry_count: entries,
    base_from_tier: entries - Math.floor(ownSpend / 2500) - Math.floor(refSpend / 1000),
    from_own_spend: Math.floor(ownSpend / 2500),
    from_referee_spend: Math.floor(refSpend / 1000),
    current_month: monthKeyStr,
    prize: prize
      ? {
          kind: prize.prize_kind,
          amount_cents: prize.prize_amount_cents,
          vial_size_cap_mg: prize.vial_size_cap_mg,
        }
      : undefined,
  };
}

// -----------------------------------------------------------------------------
// Cron: snapshot
// -----------------------------------------------------------------------------

export interface SnapshotResult {
  ok: boolean;
  month: string;
  entries_written: number;
  error?: string;
}

/**
 * Freeze entry counts for the previous calendar month. Called by the
 * cron at 23:55 UTC on the last day so any orders funded right up to
 * the end-of-month bell are included.
 *
 * Idempotent: a re-run on the same month is a no-op (entry_snapshot_at
 * is set on first success and we refuse to re-snapshot).
 *
 * Implementation: walk every user_rewards row, sum the user's funded
 * orders and their referees' funded orders within the calendar month,
 * compute entries, upsert into raffle_entries.
 */
export async function snapshotRaffleMonth(
  monthAsKey?: string,
): Promise<SnapshotResult> {
  const service = getSupabaseServer();
  if (!service)
    return {
      ok: false,
      month: monthAsKey ?? monthKey(startOfMonthUtc()),
      entries_written: 0,
      error: "Database unavailable.",
    };

  // Default: snapshot the calendar month in which "now" falls. The
  // cron schedules this for the last day so it covers the just-
  // ending month. Admin can pass an explicit key to back-fill.
  const targetMonth = monthAsKey ?? monthKey(startOfMonthUtc());
  const monthStart = new Date(`${targetMonth}T00:00:00Z`);
  const monthEnd = startOfNextMonthUtc(monthStart);

  // Refuse to re-snapshot a month already frozen.
  const { data: existing } = await service
    .from("raffle_months")
    .select("entry_snapshot_at")
    .eq("month", targetMonth)
    .maybeSingle();
  if (
    existing &&
    (existing as { entry_snapshot_at?: string | null }).entry_snapshot_at
  ) {
    return {
      ok: true,
      month: targetMonth,
      entries_written: 0,
      error: "Already snapshotted.",
    };
  }
  // Auto-create the raffle_months row with default cash $500 if admin
  // never configured it. Founder can always override later (until
  // confirmed_by_admin_at is set).
  if (!existing) {
    await service.from("raffle_months").insert({
      month: targetMonth,
      prize_kind: "cash",
      prize_amount_cents: 50_000,
    });
  }

  // Pull every user with rewards activity. We iterate this set rather
  // than analytics_sessions because raffle entries are scoped to
  // signed-in customers (anonymous browsers don't have user_rewards).
  const { data: users } = await service
    .from("user_rewards")
    .select("user_id, tier");
  if (!Array.isArray(users) || users.length === 0) {
    await service
      .from("raffle_months")
      .update({ entry_snapshot_at: new Date().toISOString() })
      .eq("month", targetMonth);
    return { ok: true, month: targetMonth, entries_written: 0 };
  }

  let written = 0;
  for (const u of users as Array<{ user_id: string; tier: RewardTier }>) {
    const { data: ownOrders } = await service
      .from("orders")
      .select("total_cents")
      .eq("customer_user_id", u.user_id)
      .eq("status", "funded")
      .gte("funded_at", monthStart.toISOString())
      .lt("funded_at", monthEnd.toISOString());
    const ownSpend = (ownOrders ?? []).reduce(
      (s, r) => s + ((r as { total_cents: number | null }).total_cents ?? 0),
      0,
    );

    const { data: refOrders } = await service
      .from("orders")
      .select("total_cents")
      .eq("referrer_user_id", u.user_id)
      .eq("status", "funded")
      .gte("funded_at", monthStart.toISOString())
      .lt("funded_at", monthEnd.toISOString());
    const refSpend = (refOrders ?? []).reduce(
      (s, r) => s + ((r as { total_cents: number | null }).total_cents ?? 0),
      0,
    );

    const entries = computeRaffleEntries({
      tier: u.tier,
      ownSpendCentsThisMonth: ownSpend,
      refereeSpendCentsThisMonth: refSpend,
    });
    if (entries <= 0) continue;
    const { error: upsertErr } = await service
      .from("raffle_entries")
      .upsert(
        { month: targetMonth, user_id: u.user_id, entry_count: entries },
        { onConflict: "month,user_id" },
      );
    if (!upsertErr) written += 1;
  }

  await service
    .from("raffle_months")
    .update({ entry_snapshot_at: new Date().toISOString() })
    .eq("month", targetMonth);

  return { ok: true, month: targetMonth, entries_written: written };
}

// -----------------------------------------------------------------------------
// Cron: draw
// -----------------------------------------------------------------------------

export interface DrawResult {
  ok: boolean;
  month: string;
  winner_user_id?: string | null;
  total_entries?: number;
  error?: string;
}

/**
 * Draw a winner for a frozen raffle month. Weighted-random selection
 * across raffle_entries — a customer with 50 entries is 5× more
 * likely to win than one with 10. Cryptographically-random seed via
 * `crypto.randomInt` keeps the draw unforgeable.
 *
 * Idempotent on the winner: if `winner_user_id` is already set, this
 * returns the existing row rather than re-rolling.
 */
export async function drawRaffleMonth(monthAsKey: string): Promise<DrawResult> {
  const service = getSupabaseServer();
  if (!service)
    return { ok: false, month: monthAsKey, error: "Database unavailable." };

  const { data: monthRow } = await service
    .from("raffle_months")
    .select("month, winner_user_id, entry_snapshot_at")
    .eq("month", monthAsKey)
    .maybeSingle();
  const m = monthRow as
    | {
        month: string;
        winner_user_id: string | null;
        entry_snapshot_at: string | null;
      }
    | null;
  if (!m) return { ok: false, month: monthAsKey, error: "Month not found." };
  if (!m.entry_snapshot_at) {
    return {
      ok: false,
      month: monthAsKey,
      error: "Month not snapshotted yet.",
    };
  }
  if (m.winner_user_id) {
    return {
      ok: true,
      month: monthAsKey,
      winner_user_id: m.winner_user_id,
      error: "Already drawn.",
    };
  }

  const { data: entries } = await service
    .from("raffle_entries")
    .select("user_id, entry_count")
    .eq("month", monthAsKey);
  const rows =
    (entries as Array<{ user_id: string; entry_count: number }> | null) ?? [];
  const total = rows.reduce((s, r) => s + r.entry_count, 0);
  if (total === 0) {
    return { ok: true, month: monthAsKey, winner_user_id: null, total_entries: 0 };
  }

  // Weighted random: produce a uniform integer in [0, total) and walk
  // the cumulative entry list. crypto.randomInt is unbiased; Math.random
  // would tilt at the tails of the range with rejection sampling.
  const cryptoMod = await import("node:crypto");
  const pick = cryptoMod.randomInt(0, total);
  let acc = 0;
  let winner: string | null = null;
  for (const r of rows) {
    acc += r.entry_count;
    if (pick < acc) {
      winner = r.user_id;
      break;
    }
  }

  await service
    .from("raffle_months")
    .update({
      winner_user_id: winner,
      drawn_at: new Date().toISOString(),
    })
    .eq("month", monthAsKey)
    .is("winner_user_id", null);

  return {
    ok: true,
    month: monthAsKey,
    winner_user_id: winner,
    total_entries: total,
  };
}

// -----------------------------------------------------------------------------
// Admin: confirm draw + issue prize side-effects
// -----------------------------------------------------------------------------

const ConfirmInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/u, "Invalid month."),
});

export async function confirmRaffleDraw(
  input: z.infer<typeof ConfirmInput>,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized." };
  const parsed = ConfirmInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  // Codex caught a TOCTOU race in the original read-then-issue
  // pattern: two concurrent admin clicks could both see
  // confirmed_by_admin_at=null and both insert prize side-effects.
  // Fix: atomically CLAIM the month first via a conditional UPDATE
  // that filters on confirmed_by_admin_at IS NULL. Whoever wins the
  // claim gets the row back and proceeds with the side-effects;
  // anyone else gets zero rows and surfaces "already confirmed."
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await service
    .from("raffle_months")
    .update({ confirmed_by_admin_at: claimedAt })
    .eq("month", parsed.data.month)
    .is("confirmed_by_admin_at", null)
    .select(
      "month, prize_kind, prize_amount_cents, vial_size_cap_mg, winner_user_id, drawn_at",
    );
  if (claimErr) {
    console.error("[confirmRaffleDraw] claim update failed:", claimErr);
    return { ok: false, error: "Could not claim the draw." };
  }
  if (!Array.isArray(claimed) || claimed.length === 0) {
    // Already confirmed by another admin — or month not found — or
    // we got beaten in the race. Distinguish "not found" by a
    // follow-up read so the message is accurate.
    const { data: monthRow } = await service
      .from("raffle_months")
      .select("month, drawn_at, confirmed_by_admin_at")
      .eq("month", parsed.data.month)
      .maybeSingle();
    const m = monthRow as RaffleMonthRow | null;
    if (!m) return { ok: false, error: "Month not found." };
    if (!m.drawn_at) {
      return { ok: false, error: "Month has not been drawn yet." };
    }
    return { ok: false, error: "Draw already confirmed." };
  }

  const m = claimed[0] as RaffleMonthRow;
  if (!m.drawn_at || !m.winner_user_id) {
    // We claimed a row that wasn't actually drawn yet — release the
    // claim and fail. The IS NULL filter only checked
    // confirmed_by_admin_at, so a confirm-before-draw is possible
    // and we have to back it out.
    await service
      .from("raffle_months")
      .update({ confirmed_by_admin_at: null })
      .eq("month", m.month);
    return { ok: false, error: "Month has not been drawn yet." };
  }

  // Issue the prize side-effect on the row we own. If the insert
  // fails (FK orphan from a deleted-mid-flight winner, network
  // blip, etc.) we ROLL BACK the claim so an admin can retry once
  // the underlying issue is resolved — A10 in codex review.
  let issueErr: string | null = null;
  try {
    if (m.prize_kind === "cash") {
      const amount = m.prize_amount_cents ?? 50_000;
      const { error } = await service.from("cash_payouts").insert({
        user_id: m.winner_user_id,
        amount_cents: amount,
        source_month: m.month,
      });
      if (error) issueErr = error.message;
    } else if (m.prize_kind === "vials_2") {
      const { error } = await service.from("vial_credits").insert([
        {
          user_id: m.winner_user_id,
          source: "raffle",
          max_size_mg: m.vial_size_cap_mg,
          note: `Raffle ${m.month} prize (1 of 2)`,
        },
        {
          user_id: m.winner_user_id,
          source: "raffle",
          max_size_mg: m.vial_size_cap_mg,
          note: `Raffle ${m.month} prize (2 of 2)`,
        },
      ]);
      if (error) issueErr = error.message;
    }
  } catch (err) {
    issueErr = err instanceof Error ? err.message : String(err);
  }

  if (issueErr) {
    // Roll back the claim so the admin can retry. We deliberately
    // don't try to re-insert here — surface the error and let the
    // admin investigate (likely a deleted user account or bad data).
    await service
      .from("raffle_months")
      .update({ confirmed_by_admin_at: null })
      .eq("month", m.month);
    console.error("[confirmRaffleDraw] prize issue failed:", issueErr);
    return {
      ok: false,
      error: `Prize issue failed: ${issueErr}. Claim rolled back; you can retry.`,
    };
  }

  return { ok: true };
}

// -----------------------------------------------------------------------------
// Admin reads
// -----------------------------------------------------------------------------

export interface AdminRaffleListItem {
  month: string;
  prize_kind: "cash" | "vials_2";
  prize_amount_cents: number | null;
  entry_snapshot_at: string | null;
  drawn_at: string | null;
  confirmed_by_admin_at: string | null;
  winner_user_id: string | null;
  total_entries: number;
}

export async function listRaffleMonths(): Promise<AdminRaffleListItem[]> {
  if (!(await isAdmin())) return [];
  const service = getSupabaseServer();
  if (!service) return [];
  const { data: months } = await service
    .from("raffle_months")
    .select("*")
    .order("month", { ascending: false })
    .limit(24);
  if (!Array.isArray(months) || months.length === 0) return [];
  // Aggregate entry totals per month in one fetch.
  const keys = months.map((m) => (m as RaffleMonthRow).month);
  const { data: entries } = await service
    .from("raffle_entries")
    .select("month, entry_count")
    .in("month", keys);
  const totals = new Map<string, number>();
  for (const e of (entries ?? []) as Array<RaffleEntryRow>) {
    totals.set(e.month, (totals.get(e.month) ?? 0) + e.entry_count);
  }
  return (months as RaffleMonthRow[]).map((m) => ({
    month: m.month,
    prize_kind: m.prize_kind,
    prize_amount_cents: m.prize_amount_cents,
    entry_snapshot_at: m.entry_snapshot_at,
    drawn_at: m.drawn_at,
    confirmed_by_admin_at: m.confirmed_by_admin_at,
    winner_user_id: m.winner_user_id,
    total_entries: totals.get(m.month) ?? 0,
  }));
}

const ConfigureInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/u, "Invalid month."),
  prize_kind: z.enum(["cash", "vials_2"]),
  prize_amount_cents: z.number().int().min(0).max(1_000_000).optional(),
  vial_size_cap_mg: z.number().int().min(1).max(200).optional(),
});

export async function configureRaffleMonth(
  input: z.infer<typeof ConfigureInput>,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized." };
  const parsed = ConfigureInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  // Refuse to mutate a month that has already been snapshotted —
  // codex caught a window where an admin could change cash → vials
  // after entries were frozen and a winner was about to be drawn,
  // delivering a different prize than the one in effect when
  // entries were earned. Lock the row at the snapshot boundary, not
  // the confirm boundary.
  const { data: existing } = await service
    .from("raffle_months")
    .select("entry_snapshot_at, confirmed_by_admin_at")
    .eq("month", parsed.data.month)
    .maybeSingle();
  const e = existing as
    | { entry_snapshot_at?: string | null; confirmed_by_admin_at?: string | null }
    | null;
  if (e?.confirmed_by_admin_at) {
    return { ok: false, error: "Month already confirmed; cannot edit." };
  }
  if (e?.entry_snapshot_at) {
    return {
      ok: false,
      error: "Entries already snapshotted for this month; the prize is locked.",
    };
  }

  const row = {
    month: parsed.data.month,
    prize_kind: parsed.data.prize_kind,
    prize_amount_cents: parsed.data.prize_amount_cents ?? null,
    vial_size_cap_mg: parsed.data.vial_size_cap_mg ?? null,
  };
  const { error } = await service
    .from("raffle_months")
    .upsert(row, { onConflict: "month" });
  if (error) {
    console.error("[configureRaffleMonth] upsert failed:", error);
    return { ok: false, error: "Could not save." };
  }
  return { ok: true };
}
