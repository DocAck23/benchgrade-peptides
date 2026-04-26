import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/client";

/**
 * GET /api/messaging/poll
 *
 * Poll-based message updates for <MessageThread/> (Sprint 3 Wave B2).
 *
 * Auth: cookie-scoped supabase client + supa.auth.getUser(); 401 if no
 * session. Returns ALL messages for the authenticated customer (RLS would
 * also enforce this — defense-in-depth here at the route level).
 *
 * Query params:
 *   - since (ISO timestamp): only return messages with `created_at > since`.
 *     Omitted on first load → returns full thread (small for v1; if threads
 *     get long we can switch to limit + cursor by id).
 *
 * Rate-limit: not implemented in v1 (Vercel edge handles burst). TODO v1.5:
 *   add per-user limit (10 reqs/min) — see spec §6 polling notes.
 */
export async function GET(req: NextRequest) {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const since = req.nextUrl.searchParams.get("since");
  let q = supa
    .from("messages")
    .select("*")
    .eq("customer_user_id", user.id)
    .order("created_at", { ascending: true });

  if (since) {
    q = q.gt("created_at", since);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, messages: data ?? [] });
}
