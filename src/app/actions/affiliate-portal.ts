"use server";

/**
 * Affiliate portal server actions (W6).
 *
 *   generateAffiliateInvite        — admin-only; mints a one-time link.
 *   consumeAffiliateInvite         — invitee, post-auth; concurrency-safe
 *                                    via .is("consumed_at", null) guard.
 *   signAffiliateAgreement         — captures snapshot HTML + name + ip + UA.
 *   uploadAffiliateW9              — multipart PDF, <=5MB, into Storage.
 *   getMyAffiliateOnboarding       — affiliate-scope status read.
 *   listAffiliatesAdmin            — admin list.
 *   getAffiliateDetailAdmin        — admin per-user detail.
 *   getAffiliateW9SignedUrlAdmin   — admin 5-min signed URL.
 *   getAffiliateW9SignedUrlForMe   — owner 5-min signed URL.
 *
 * Security: admin paths gate on isAdmin(); affiliate paths gate on
 * createServerSupabase().auth.getUser() AND rely on RLS (deny-by-default
 * INSERT, owner-scoped SELECT).
 */

import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/client";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/auth";
import { resolveClientIp } from "@/lib/ratelimit/ip";
import { checkAndIncrement } from "@/lib/ratelimit/window";
import { SupabaseRateLimitStore } from "@/lib/ratelimit/supabase-store";
import { SITE_URL } from "@/lib/site";
import {
  AGREEMENT_HTML,
  AGREEMENT_VERSION,
} from "@/lib/affiliate/agreement-1099-v1";

const W9_BUCKET = "affiliate-w9";
const W9_MAX_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_TTL_SEC = 300;

/**
 * Codex pass 1 (MEDIUM #3): pre-condition check used by both
 * signAffiliateAgreement and uploadAffiliateW9. An affiliate must
 * have consumed an invite before they can write to the agreements
 * or W9 ledger — without this, any account holder could spam those
 * tables and appear in the admin affiliate list.
 *
 * Reads `affiliate_invites` for any row consumed by `userId`. Single
 * indexed lookup; cheap.
 */
async function hasConsumedInvite(
  supa: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { count } = await supa
      .from("affiliate_invites")
      .select("token", { count: "exact", head: true })
      .eq("consumed_by_user_id", userId);
    return (count ?? 0) > 0;
  } catch (err) {
    console.error("[hasConsumedInvite] lookup failed:", err);
    return false; // fail closed
  }
}

// ---------------------------------------------------------------------------
// generateAffiliateInvite (admin)
// ---------------------------------------------------------------------------

const GenerateInviteSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
  expiresInDays: z.number().int().min(1).max(365).optional().nullable(),
});

export interface GenerateAffiliateInviteInput {
  note?: string | null;
  expiresInDays?: number | null;
}

export interface GenerateAffiliateInviteResult {
  ok: boolean;
  token?: string;
  url?: string;
  error?: string;
}

export async function generateAffiliateInvite(
  input: GenerateAffiliateInviteInput,
): Promise<GenerateAffiliateInviteResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  const parsed = GenerateInviteSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };

  const expiresAt =
    parsed.data.expiresInDays != null
      ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString()
      : null;

  const { data, error } = await supa
    .from("affiliate_invites")
    .insert({
      created_by_admin: true,
      expires_at: expiresAt,
      note: parsed.data.note ?? null,
    })
    .select("token")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Insert failed." };
  }
  const token = data.token as string;
  const url = `${SITE_URL}/affiliate/invite/${token}`;
  revalidatePath("/admin/affiliates");
  return { ok: true, token, url };
}

// ---------------------------------------------------------------------------
// consumeAffiliateInvite (post-auth invitee)
// ---------------------------------------------------------------------------

export interface ConsumeAffiliateInviteResult {
  ok: boolean;
  error?: string;
  already_consumed?: boolean;
}

export async function consumeAffiliateInvite(
  token: string,
): Promise<ConsumeAffiliateInviteResult> {
  const tokenParse = z.string().uuid().safeParse(token);
  if (!tokenParse.success) return { ok: false, error: "Invalid invite link." };

  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to accept the invite." };

  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };

  // Fetch first to distinguish missing / expired / already-consumed for
  // a helpful error message — the atomic UPDATE below is the actual
  // race-safe state transition.
  const { data: existing, error: readErr } = await supa
    .from("affiliate_invites")
    .select("token, expires_at, consumed_at, consumed_by_user_id")
    .eq("token", tokenParse.data)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!existing) return { ok: false, error: "Invite link not found." };
  if (existing.consumed_at) {
    if (existing.consumed_by_user_id === user.id) {
      return { ok: true, already_consumed: true };
    }
    return { ok: false, error: "This invite has already been used." };
  }
  if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
    return { ok: false, error: "This invite has expired." };
  }

  // Atomic claim: only flip the row if it's still NULL. .select() forces
  // a return so we can check rowcount and detect a TOCTOU race.
  const { data: claimed, error: claimErr } = await supa
    .from("affiliate_invites")
    .update({
      consumed_at: new Date().toISOString(),
      consumed_by_user_id: user.id,
    })
    .eq("token", tokenParse.data)
    .is("consumed_at", null)
    .select("token");
  if (claimErr) return { ok: false, error: claimErr.message };
  if (!claimed || claimed.length === 0) {
    return { ok: false, error: "This invite has already been used." };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// signAffiliateAgreement
// ---------------------------------------------------------------------------

const SignSchema = z.object({
  signed_name: z.string().trim().min(2).max(200),
});

export interface SignAffiliateAgreementInput {
  signed_name: string;
}

export interface SignAffiliateAgreementResult {
  ok: boolean;
  agreement_id?: string;
  error?: string;
}

export async function signAffiliateAgreement(
  input: SignAffiliateAgreementInput,
): Promise<SignAffiliateAgreementResult> {
  const parsed = SignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };

  // Codex pass 1 (MEDIUM #3): require a consumed invite before
  // allowing agreement signing — previously any signed-in account
  // could write affiliate_agreement rows and be treated as an
  // affiliate by the admin list.
  if (!(await hasConsumedInvite(supa, user.id))) {
    return { ok: false, error: "Affiliate invitation required." };
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const ua = h.get("user-agent") ?? null;

  const { data, error } = await supa
    .from("affiliate_agreements")
    .insert({
      affiliate_user_id: user.id,
      agreement_version: AGREEMENT_VERSION,
      signed_name: parsed.data.signed_name,
      ip,
      user_agent: ua,
      agreement_html: AGREEMENT_HTML,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed." };
  return { ok: true, agreement_id: data.id as string };
}

// ---------------------------------------------------------------------------
// uploadAffiliateW9
// ---------------------------------------------------------------------------

export interface UploadAffiliateW9Result {
  ok: boolean;
  storage_path?: string;
  error?: string;
}

export async function uploadAffiliateW9(
  formData: FormData,
): Promise<UploadAffiliateW9Result> {
  // Cheap checks first — file shape, size, extension. Avoid reading
  // the file buffer or hitting the DB until we've validated the
  // basics.
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file received." };
  }
  if (file.size === 0) return { ok: false, error: "Empty file." };
  if (file.size > W9_MAX_BYTES) {
    return { ok: false, error: "File exceeds 5 MB." };
  }
  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return { ok: false, error: "PDF only." };

  // Auth before any further IO — codex pass 1 reordering. Cheaper to
  // reject unauth callers before reading their file buffer.
  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };

  // Codex pass 1 (MEDIUM #3): require a consumed invite — without
  // this, any signed-in account could re-upload PDFs into a folder
  // under their UID and then show up in the admin-affiliates list.
  if (!(await hasConsumedInvite(supa, user.id))) {
    return { ok: false, error: "Affiliate invitation required." };
  }

  // Codex pass 1 (MEDIUM #4): per-user rate limit on uploads. 5 per
  // hour is plenty for the legitimate "uploaded the wrong file → fix"
  // case but blocks an attacker from spamming 5MB blobs into storage.
  try {
    const h0 = await headers();
    const ipResult = resolveClientIp(h0, {
      isProduction: process.env.NODE_ENV === "production",
    });
    const ipForLimit = ipResult.ok ? ipResult.ip : "unknown";
    const store = new SupabaseRateLimitStore(supa);
    const rl = await checkAndIncrement({
      bucket: `affiliate-w9:${user.id}:${ipForLimit}`,
      limit: 5,
      windowSeconds: 3600,
      store,
    });
    if (!rl.allowed) {
      return {
        ok: false,
        error:
          "Too many W9 upload attempts. Please wait an hour and try again, or email admin if this is urgent.",
      };
    }
  } catch (err) {
    // Rate-limit infra failure → continue. Better to over-accept the
    // upload than to block a legitimate affiliate over a transient
    // hiccup — the size cap + invite gate still bound exposure.
    console.error("[uploadAffiliateW9] rate-limit check failed:", err);
  }

  // Codex pass 1 (MEDIUM #4): PDF magic-bytes check. Without this,
  // an attacker could upload arbitrary binary as `.pdf` content-type
  // and have it persisted in our private bucket. Done AFTER auth +
  // invite gate so we don't read the file buffer for unauth callers.
  const arrayBuffer = await file.arrayBuffer();
  const head = new Uint8Array(arrayBuffer.slice(0, 5));
  // %PDF- = 0x25 0x50 0x44 0x46 0x2D
  const isPdfMagic =
    head[0] === 0x25 &&
    head[1] === 0x50 &&
    head[2] === 0x44 &&
    head[3] === 0x46 &&
    head[4] === 0x2d;
  if (!isPdfMagic) {
    return { ok: false, error: "File does not appear to be a valid PDF." };
  }

  // Path must start with the user's UID so storage RLS authorises owner
  // SELECT/INSERT. We use crypto.randomUUID() to avoid collisions when
  // an affiliate uploads twice.
  const objectPath = `${user.id}/${crypto.randomUUID()}.pdf`;

  const { error: uploadErr } = await supa.storage
    .from(W9_BUCKET)
    .upload(objectPath, new Uint8Array(arrayBuffer), {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const ua = h.get("user-agent") ?? null;

  // Codex pass 1 (MEDIUM #4): on supersession, also DELETE the old
  // storage object so we don't accumulate orphaned 5MB PDFs forever.
  // Read the prior current row, mark it superseded, then drop the
  // storage object. Best-effort — failure to delete the storage
  // object doesn't roll back the row supersession.
  const { data: priorRows } = await supa
    .from("affiliate_w9")
    .select("storage_path")
    .eq("affiliate_user_id", user.id)
    .is("superseded_at", null);
  await supa
    .from("affiliate_w9")
    .update({ superseded_at: new Date().toISOString() })
    .eq("affiliate_user_id", user.id)
    .is("superseded_at", null);
  if (Array.isArray(priorRows) && priorRows.length > 0) {
    const stalePaths = priorRows
      .map((r) => (r as { storage_path?: string }).storage_path)
      .filter((p): p is string => typeof p === "string");
    if (stalePaths.length > 0) {
      try {
        await supa.storage.from(W9_BUCKET).remove(stalePaths);
      } catch (err) {
        console.error("[uploadAffiliateW9] storage cleanup failed:", err);
      }
    }
  }

  const { error: insertErr } = await supa.from("affiliate_w9").insert({
    affiliate_user_id: user.id,
    storage_path: objectPath,
    original_filename: file.name.slice(0, 255),
    ip,
    user_agent: ua,
    byte_size: file.size,
  });
  if (insertErr) return { ok: false, error: insertErr.message };

  revalidatePath("/account/affiliate-onboarding");
  revalidatePath("/account/affiliate");
  return { ok: true, storage_path: objectPath };
}

// ---------------------------------------------------------------------------
// getMyAffiliateOnboarding
// ---------------------------------------------------------------------------

export interface MyAffiliateOnboardingState {
  ok: boolean;
  error?: string;
  invite_consumed: boolean;
  agreement_signed: boolean;
  agreement_signed_at: string | null;
  agreement_signed_name: string | null;
  agreement_version: string | null;
  w9_uploaded: boolean;
  w9_uploaded_at: string | null;
  w9_filename: string | null;
}

const EMPTY_ONBOARDING: MyAffiliateOnboardingState = {
  ok: true,
  invite_consumed: false,
  agreement_signed: false,
  agreement_signed_at: null,
  agreement_signed_name: null,
  agreement_version: null,
  w9_uploaded: false,
  w9_uploaded_at: null,
  w9_filename: null,
};

export async function getMyAffiliateOnboarding(): Promise<MyAffiliateOnboardingState> {
  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ...EMPTY_ONBOARDING, ok: false, error: "Sign in required." };

  // RLS-scoped reads (cookie client) — each query returns ONLY rows the
  // user owns, so no manual auth.uid() filter is needed.
  const [inviteRes, agreementRes, w9Res] = await Promise.all([
    cookie
      .from("affiliate_invites")
      .select("token")
      .eq("consumed_by_user_id", user.id)
      .limit(1),
    cookie
      .from("affiliate_agreements")
      .select("signed_at, signed_name, agreement_version")
      .order("signed_at", { ascending: false })
      .limit(1),
    cookie
      .from("affiliate_w9")
      .select("uploaded_at, original_filename, superseded_at")
      .is("superseded_at", null)
      .order("uploaded_at", { ascending: false })
      .limit(1),
  ]);

  const agreement = agreementRes.data?.[0] ?? null;
  const w9 = w9Res.data?.[0] ?? null;

  return {
    ok: true,
    invite_consumed: (inviteRes.data?.length ?? 0) > 0,
    agreement_signed: !!agreement,
    agreement_signed_at: (agreement?.signed_at as string | undefined) ?? null,
    agreement_signed_name: (agreement?.signed_name as string | undefined) ?? null,
    agreement_version:
      (agreement?.agreement_version as string | undefined) ?? null,
    w9_uploaded: !!w9,
    w9_uploaded_at: (w9?.uploaded_at as string | undefined) ?? null,
    w9_filename: (w9?.original_filename as string | undefined) ?? null,
  };
}

// ---------------------------------------------------------------------------
// listAffiliatesAdmin / getAffiliateDetailAdmin
// ---------------------------------------------------------------------------

export interface AdminAffiliateRow {
  user_id: string;
  email: string | null;
  invite_consumed_at: string | null;
  agreement_signed_at: string | null;
  agreement_version: string | null;
  w9_uploaded_at: string | null;
}

export interface ListAffiliatesAdminResult {
  ok: boolean;
  rows?: AdminAffiliateRow[];
  error?: string;
}

export async function listAffiliatesAdmin(): Promise<ListAffiliatesAdminResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };

  // Union of every user that has at least one invite/agreement/w9 row.
  const [invites, agreements, w9s] = await Promise.all([
    supa
      .from("affiliate_invites")
      .select("consumed_by_user_id, consumed_at")
      .not("consumed_by_user_id", "is", null),
    supa
      .from("affiliate_agreements")
      .select("affiliate_user_id, signed_at, agreement_version")
      .order("signed_at", { ascending: false }),
    supa
      .from("affiliate_w9")
      .select("affiliate_user_id, uploaded_at, superseded_at")
      .is("superseded_at", null)
      .order("uploaded_at", { ascending: false }),
  ]);

  if (invites.error) return { ok: false, error: invites.error.message };
  if (agreements.error) return { ok: false, error: agreements.error.message };
  if (w9s.error) return { ok: false, error: w9s.error.message };

  const map = new Map<string, AdminAffiliateRow>();
  const ensure = (id: string): AdminAffiliateRow => {
    let row = map.get(id);
    if (!row) {
      row = {
        user_id: id,
        email: null,
        invite_consumed_at: null,
        agreement_signed_at: null,
        agreement_version: null,
        w9_uploaded_at: null,
      };
      map.set(id, row);
    }
    return row;
  };

  for (const r of (invites.data ?? []) as Array<{
    consumed_by_user_id: string;
    consumed_at: string | null;
  }>) {
    ensure(r.consumed_by_user_id).invite_consumed_at = r.consumed_at;
  }
  for (const r of (agreements.data ?? []) as Array<{
    affiliate_user_id: string;
    signed_at: string;
    agreement_version: string;
  }>) {
    const row = ensure(r.affiliate_user_id);
    if (!row.agreement_signed_at) {
      row.agreement_signed_at = r.signed_at;
      row.agreement_version = r.agreement_version;
    }
  }
  for (const r of (w9s.data ?? []) as Array<{
    affiliate_user_id: string;
    uploaded_at: string;
  }>) {
    const row = ensure(r.affiliate_user_id);
    if (!row.w9_uploaded_at) row.w9_uploaded_at = r.uploaded_at;
  }

  // Resolve emails best-effort. auth.admin.getUserById is one round-trip
  // per user, fine for an early-cohort affiliate list.
  await Promise.all(
    Array.from(map.values()).map(async (row) => {
      try {
        const { data } = await supa.auth.admin.getUserById(row.user_id);
        row.email = data.user?.email ?? null;
      } catch {
        row.email = null;
      }
    }),
  );

  const rows = Array.from(map.values()).sort((a, b) => {
    const ta = a.invite_consumed_at ?? a.agreement_signed_at ?? "";
    const tb = b.invite_consumed_at ?? b.agreement_signed_at ?? "";
    return tb.localeCompare(ta);
  });
  return { ok: true, rows };
}

export interface AdminAffiliateDetail {
  user_id: string;
  email: string | null;
  agreement: {
    id: string;
    signed_name: string;
    signed_at: string;
    ip: string | null;
    user_agent: string | null;
    agreement_version: string;
    agreement_html: string;
  } | null;
  w9: {
    id: string;
    storage_path: string;
    original_filename: string;
    uploaded_at: string;
    byte_size: number;
  } | null;
}

export interface GetAffiliateDetailAdminResult {
  ok: boolean;
  detail?: AdminAffiliateDetail;
  error?: string;
}

export async function getAffiliateDetailAdmin(
  userId: string,
): Promise<GetAffiliateDetailAdminResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  const idParse = z.string().uuid().safeParse(userId);
  if (!idParse.success) return { ok: false, error: "Invalid user id." };

  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };

  const [{ data: agreementRows }, { data: w9Rows }, userRes] = await Promise.all([
    supa
      .from("affiliate_agreements")
      .select(
        "id, signed_name, signed_at, ip, user_agent, agreement_version, agreement_html",
      )
      .eq("affiliate_user_id", idParse.data)
      .order("signed_at", { ascending: false })
      .limit(1),
    supa
      .from("affiliate_w9")
      .select("id, storage_path, original_filename, uploaded_at, byte_size")
      .eq("affiliate_user_id", idParse.data)
      .is("superseded_at", null)
      .order("uploaded_at", { ascending: false })
      .limit(1),
    supa.auth.admin.getUserById(idParse.data).catch(() => ({ data: { user: null } })),
  ]);

  const ag = agreementRows?.[0] ?? null;
  const w9 = w9Rows?.[0] ?? null;

  return {
    ok: true,
    detail: {
      user_id: idParse.data,
      email: userRes?.data?.user?.email ?? null,
      agreement: ag
        ? {
            id: ag.id as string,
            signed_name: ag.signed_name as string,
            signed_at: ag.signed_at as string,
            ip: (ag.ip as string | null) ?? null,
            user_agent: (ag.user_agent as string | null) ?? null,
            agreement_version: ag.agreement_version as string,
            agreement_html: ag.agreement_html as string,
          }
        : null,
      w9: w9
        ? {
            id: w9.id as string,
            storage_path: w9.storage_path as string,
            original_filename: w9.original_filename as string,
            uploaded_at: w9.uploaded_at as string,
            byte_size: w9.byte_size as number,
          }
        : null,
    },
  };
}

// ---------------------------------------------------------------------------
// signed URL helpers
// ---------------------------------------------------------------------------

export interface SignedUrlResult {
  ok: boolean;
  url?: string;
  error?: string;
}

async function signW9Path(path: string): Promise<SignedUrlResult> {
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };
  const { data, error } = await supa.storage
    .from(W9_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? "Could not sign URL." };
  }
  return { ok: true, url: data.signedUrl };
}

export async function getAffiliateW9SignedUrlAdmin(
  userId: string,
): Promise<SignedUrlResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not authorized." };
  const idParse = z.string().uuid().safeParse(userId);
  if (!idParse.success) return { ok: false, error: "Invalid user id." };
  const supa = getSupabaseServer();
  if (!supa) return { ok: false, error: "Database unavailable." };
  const { data, error } = await supa
    .from("affiliate_w9")
    .select("storage_path")
    .eq("affiliate_user_id", idParse.data)
    .is("superseded_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "No W9 on file." };
  return signW9Path(data.storage_path as string);
}

export async function getAffiliateW9SignedUrlForMe(): Promise<SignedUrlResult> {
  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  // Owner-scoped read via RLS — no need for service-role here for the
  // lookup; signing the URL itself uses the service-role bucket binding,
  // which is fine because we already verified ownership.
  const { data, error } = await cookie
    .from("affiliate_w9")
    .select("storage_path")
    .is("superseded_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "No W9 on file." };
  return signW9Path(data.storage_path as string);
}
