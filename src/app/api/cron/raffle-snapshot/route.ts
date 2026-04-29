import { NextResponse, type NextRequest } from "next/server";
import { snapshotRaffleMonth } from "@/app/actions/raffle";
import { monthKey } from "@/lib/raffle/entries";

/**
 * Cron: freeze raffle entries for the just-ENDED calendar month.
 *
 * Codex caught a fatal race in the original "fire on day 28-31"
 * schedule: a March 28 firing snapshotted March three days early,
 * then the idempotency guard blocked the actual end-of-month re-run.
 * Funded orders from those final days fell out of the snapshot
 * permanently.
 *
 * Fixed schedule: fire on the 1st of each month at 08:55 UTC. The
 * action is called with an explicit "previous month" key so it
 * always snapshots a fully-completed month with no possibility of
 * a partial-month freeze. The draw cron then fires at 09:00 UTC on
 * the same day.
 *
 * Auth: same Bearer pattern as /api/cron/rewards-recompute. In
 * production with no CRON_SECRET we fail closed; in dev we allow.
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
  // Compute the prior calendar month key. Today is the 1st by the
  // cron schedule, so prior month = today - 1 month at first-of-
  // month UTC. Date.UTC handles year rollover (-1 from January
  // becomes prior December).
  const now = new Date();
  const priorMonthDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const target = monthKey(priorMonthDate);
  const result = await snapshotRaffleMonth(target);
  return NextResponse.json(result);
}
