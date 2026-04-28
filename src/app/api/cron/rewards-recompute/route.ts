import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { recomputeRewards } from "@/app/actions/rewards";

/**
 * Nightly rewards recompute (PRD §4.3, §8).
 *
 * Walks every user_rewards row and re-runs the per-user recompute so
 * any rolling-window rolloff that happens at month-start is reflected
 * in the denormalized tier/points columns even when no other ledger
 * activity touched the user that day. Also picks up users who only
 * appear in points_ledger but never made it into user_rewards (which
 * shouldn't happen in normal flow but does protect against an action
 * crashing post-insert).
 *
 * Auth: Bearer header `Authorization: Bearer ${CRON_SECRET}`. Protects
 * the endpoint from public discovery; Vercel Cron sets this header
 * automatically when CRON_SECRET is configured. A bare GET without
 * the header returns 401.
 *
 * Idempotency: recomputeRewards is itself idempotent — running it
 * twice just produces the same upsert. The cron failing mid-batch is
 * fine; the next run will re-process everyone.
 */

export const dynamic = "force-dynamic";

function isAuthed(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // No secret configured — allow only in dev (so a local curl
    // works) and refuse in production so a misconfiguration can't
    // ship as an open endpoint.
    return process.env.NODE_ENV !== "production";
  }
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

interface RecomputeOutcome {
  total: number;
  succeeded: number;
  failed: number;
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const service = getSupabaseServer();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "Database unavailable." },
      { status: 503 },
    );
  }

  // Pull every user that has either a rewards row or any ledger
  // activity. Union via a distinct SELECT so ledger-only users aren't
  // missed (defense against a recompute crash leaving them stranded).
  const userIds = new Set<string>();
  try {
    const { data: rewardUsers } = await service
      .from("user_rewards")
      .select("user_id");
    for (const r of (rewardUsers ?? []) as Array<{ user_id: string }>) {
      userIds.add(r.user_id);
    }
    const { data: ledgerUsers } = await service
      .from("points_ledger")
      .select("user_id");
    for (const r of (ledgerUsers ?? []) as Array<{ user_id: string }>) {
      userIds.add(r.user_id);
    }
  } catch (err) {
    console.error("[cron rewards-recompute] user enumeration failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not enumerate users." },
      { status: 500 },
    );
  }

  const outcome: RecomputeOutcome = {
    total: userIds.size,
    succeeded: 0,
    failed: 0,
  };

  // Sequential rather than parallel — supabase service-role client
  // doesn't pool well under high concurrency in serverless, and the
  // rolloff transition is rare enough that latency isn't critical.
  for (const userId of userIds) {
    const res = await recomputeRewards(userId);
    if (res.ok) outcome.succeeded += 1;
    else outcome.failed += 1;
  }

  return NextResponse.json({ ok: true, ...outcome });
}
