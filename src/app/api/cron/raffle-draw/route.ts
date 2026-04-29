import { NextResponse, type NextRequest } from "next/server";
import { drawRaffleMonth } from "@/app/actions/raffle";
import { monthKey, startOfMonthUtc } from "@/lib/raffle/entries";

/**
 * Cron: draw the winner of the previous calendar month. Schedule:
 * 1st of each month at 09:00 UTC. The month it draws for is
 * (current_month - 1) — the cron fires AFTER the snapshot ran on
 * the last day of the prior month.
 *
 * Idempotent: drawRaffleMonth refuses to re-draw an already-drawn
 * month.
 *
 * The draw only persists `winner_user_id` and `drawn_at`; no prize
 * email or payout fires until the founder confirms via
 * /admin/raffle. This guard prevents a cron-induced send to the
 * wrong winner if entries data was wonky.
 */
export const dynamic = "force-dynamic";

function isAuthed(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  // Compute prior-month key. e.g. firing at 2026-06-01 09:00 UTC
  // → draws 2026-05-01 month.
  const now = new Date();
  const priorMonthDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const target = monthKey(priorMonthDate);
  void startOfMonthUtc; // import kept for symmetry with snapshot
  const result = await drawRaffleMonth(target);
  return NextResponse.json(result);
}
