import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { getSupabaseServer } from "@/lib/supabase/server";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/analytics/types";
import type { AnalyticsEventName } from "@/lib/analytics/types";
import { resolveClientIp } from "@/lib/ratelimit/ip";
import { checkAndIncrement } from "@/lib/ratelimit/window";
import { SupabaseRateLimitStore } from "@/lib/ratelimit/supabase-store";
import { MemoryRateLimitStore } from "@/lib/ratelimit/memory-store";

export const runtime = "nodejs";

const ALLOWED_EVENTS: AnalyticsEventName[] = [
  "pageview",
  "product_view",
  "add_to_cart",
  "remove_from_cart",
  "checkout_start",
  "checkout_step",
  "coupon_attempt",
  "order_submitted",
  "order_funded",
  "subscription_started",
  "affiliate_click",
  "referral_click",
  "coa_request",
  "newsletter_signup",
  "product_search",
];

function classifyDevice(ua: string): "mobile" | "tablet" | "desktop" | "bot" | "unknown" {
  if (!ua) return "unknown";
  const lower = ua.toLowerCase();
  if (/bot|crawl|spider|slurp|preview|fetch|duckduck/.test(lower)) return "bot";
  if (/ipad|tablet/.test(lower)) return "tablet";
  if (/mobi|iphone|android.*mobile/.test(lower)) return "mobile";
  return "desktop";
}

// Generous beacon-specific limit. A normal session fires ~20 events
// across pageviews + cart + checkout. 300 / 5 min / IP = 60/min,
// well above legit usage and tight enough to make table-bloat or
// junk-session DoS uneconomical (codex review #4).
const ANALYTICS_RATE_LIMIT = { limit: 300, windowSeconds: 300 } as const;
const beaconMemoryStore = new MemoryRateLimitStore();

/**
 * Hard length-cap a client-supplied string before persisting it to
 * the analytics tables. Defends against a malicious client that
 * pads `path` / `referrer` / `utm_*` to MB-scale to bloat storage
 * (codex review #4).
 */
function cap(input: string | null | undefined, max: number): string | null {
  if (input == null) return null;
  if (typeof input !== "string") return null;
  return input.length > max ? input.slice(0, max) : input;
}

interface IncomingEvent {
  name: string;
  path?: string;
  properties?: Record<string, unknown>;
  // Sent only on the very first beacon of a session.
  init?: {
    landing_path: string;
    referrer?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
    gclid?: string | null;
    fbclid?: string | null;
    utm_id?: string | null;
  };
}

/**
 * Compute a one-way fingerprint of the visitor for revisit /
 * unique-count analytics. Inputs: salt + ip + device class. UA-class
 * (not full UA) keeps a phone vs laptop split without inflating
 * fingerprints for every browser-update string change.
 *
 * Returns null when the salt is missing — this collapses analytics
 * fingerprinting to "session-only" gracefully so production never
 * blows up if the env var is rotated or unset; the dashboard widgets
 * that depend on fingerprints just show empty rather than throwing.
 */
function computeFingerprint(
  ip: string,
  deviceClass: string,
): string | null {
  const salt = process.env.ANALYTICS_FINGERPRINT_SALT;
  if (!salt || ip === "unknown") return null;
  return crypto
    .createHash("sha256")
    .update(`${salt}|${ip}|${deviceClass}`)
    .digest("hex");
}

/**
 * POST /api/analytics — single-event ingestion.
 *
 * Designed to be called via `navigator.sendBeacon` (so it survives page
 * unload) OR a regular `fetch` for ack-required cases (rare). The
 * response is intentionally tiny — sendBeacon ignores the body anyway.
 *
 * Session model:
 *   • Client sends `bgp_sess` cookie if it has one.
 *   • If missing or unparseable, we mint a new UUID server-side and
 *     Set-Cookie it back. The client picks it up on the next request.
 *   • Session row is upserted on every event so `last_seen_at` stays
 *     current → "active visitors" widgets work.
 *
 * No PII beyond the email a customer voluntarily types into checkout
 * (set on `order_submitted`). IP is read for country resolution but not
 * persisted; UA is stored verbatim for forensics.
 */
export async function POST(req: NextRequest) {
  // Rate-limit by IP first — before parsing the body — so a flood
  // of malformed JSON can't drive arbitrary parser cost (codex
  // review #4). Failures fall back to memory-only counting in dev.
  const ipResult = resolveClientIp(req.headers, {
    isProduction: process.env.NODE_ENV === "production",
  });
  const ip = ipResult.ok ? ipResult.ip : "unknown";
  try {
    const supaForLimit = getSupabaseServer();
    const store = supaForLimit
      ? new SupabaseRateLimitStore(supaForLimit)
      : beaconMemoryStore;
    const rl = await checkAndIncrement({
      bucket: `analytics:${ip}`,
      limit: ANALYTICS_RATE_LIMIT.limit,
      windowSeconds: ANALYTICS_RATE_LIMIT.windowSeconds,
      store,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429 },
      );
    }
  } catch {
    // Rate-limit infrastructure error → fall through. We'd rather
    // accept some events than 5xx the page beacon.
  }

  let body: IncomingEvent;
  try {
    body = (await req.json()) as IncomingEvent;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body || typeof body.name !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!ALLOWED_EVENTS.includes(body.name as AnalyticsEventName)) {
    // Silently drop — beacon callers don't read responses, but a 200
    // here keeps the network panel clean during dev.
    return NextResponse.json({ ok: true, dropped: "unknown_event" });
  }

  const supa = getSupabaseServer();
  if (!supa) return NextResponse.json({ ok: true, dropped: "no_db" });

  // Resolve / mint session.
  let sessionId = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  let isNewSession = false;
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    sessionId = crypto.randomUUID();
    isNewSession = true;
  }

  const userAgent = req.headers.get("user-agent") ?? "";
  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    null;
  const deviceClass = classifyDevice(userAgent);
  // Salted-hash visitor fingerprint for unique/revisit analytics.
  // Persisting only the hash (no raw IP) keeps the table out of GDPR
  // PII scope. Salt rotation in env intentionally severs prior
  // fingerprints from new sessions — acts as a retention reset.
  const fingerprintHash = computeFingerprint(ip, deviceClass);

  // Drop bot traffic from the events table — we don't want googlebot
  // pageviews skewing conversion math. We still mint the session so a
  // bot retrying with the cookie isn't multiplied.
  if (deviceClass === "bot") {
    const res = NextResponse.json({ ok: true, dropped: "bot" });
    if (isNewSession) {
      res.cookies.set(SESSION_COOKIE, sessionId, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
      });
    }
    return res;
  }

  try {
    // Visitor fingerprint upsert. is_first_visit is derived from the
    // INSERT outcome rather than a select-then-count: codex caught
    // the original two-step pattern as race-prone (two simultaneous
    // tab-opens both reading session_count=0 and both setting
    // is_first_visit=true). The fingerprint table's PK on
    // fingerprint_hash means an INSERT either succeeds (= row
    // didn't exist before us = first visit) or hits a duplicate-
    // key error (= someone got here first = returning). The
    // PostgREST onConflict:'fingerprint_hash' upsert returns the
    // resulting row but doesn't tell us whether we inserted or
    // updated; we use a two-statement pattern: try INSERT, on
    // conflict 23505 = returning visitor. Best-effort throughout —
    // a fingerprint failure leaves the session row null and the
    // dashboard falls back to session-level counts.
    let isFirstVisit: boolean | null = null;
    if (fingerprintHash) {
      try {
        const { error: insertErr } = await supa
          .from("visitor_fingerprints")
          .insert({
            fingerprint_hash: fingerprintHash,
            session_count: 1,
            event_count: 1,
          });
        if (!insertErr) {
          // Row didn't exist → this is the first visit. The session
          // row about to be inserted will carry is_first_visit=true.
          isFirstVisit = isNewSession ? true : null;
        } else {
          // Either a duplicate-key (returning visitor — expected
          // happy path) or a real error. Either way, fall through
          // to the increment update; on returning visitor the
          // update writes monotonically. On a real error the update
          // probably also fails and we just log.
          isFirstVisit = isNewSession ? false : null;
          await supa
            .from("visitor_fingerprints")
            .update({
              // For session_count we need a read+add or an RPC; the
              // PostgREST UPDATE doesn't support arithmetic. Use a
              // best-effort read + write, accepting the small race
              // on the increment counter (codex pass 1 marked this
              // race as low-blast-radius — none of the dashboards
              // consume session_count directly, only fingerprint
              // existence + last_seen_at + ordered_at).
              last_seen_at: new Date().toISOString(),
            })
            .eq("fingerprint_hash", fingerprintHash);
          if (isNewSession) {
            const { data: cur } = await supa
              .from("visitor_fingerprints")
              .select("session_count, event_count")
              .eq("fingerprint_hash", fingerprintHash)
              .maybeSingle();
            const row = cur as
              | { session_count?: number; event_count?: number }
              | null;
            await supa
              .from("visitor_fingerprints")
              .update({
                session_count: (row?.session_count ?? 0) + 1,
                event_count: (row?.event_count ?? 0) + 1,
              })
              .eq("fingerprint_hash", fingerprintHash);
          } else {
            const { data: cur } = await supa
              .from("visitor_fingerprints")
              .select("event_count")
              .eq("fingerprint_hash", fingerprintHash)
              .maybeSingle();
            const row = cur as { event_count?: number } | null;
            await supa
              .from("visitor_fingerprints")
              .update({ event_count: (row?.event_count ?? 0) + 1 })
              .eq("fingerprint_hash", fingerprintHash);
          }
        }
      } catch (fpErr) {
        console.error("[analytics] fingerprint upsert failed:", fpErr);
        // Non-fatal: session/event still record without fingerprint.
      }
    }

    if (isNewSession) {
      // First touch — insert the canonical session row with all the
      // first-touch attribution. We use INSERT here rather than upsert
      // because the cookie-derived sessionId is, by construction, new
      // for new sessions. If a duplicate slips through (concurrent
      // tabs racing on cookie set), the unique-violation is swallowed
      // by the catch below — best-effort.
      const initialPath = cap(body.init?.landing_path ?? body.path ?? null, 1024);
      await supa.from("analytics_sessions").insert({
        session_id: sessionId,
        country,
        user_agent: cap(userAgent, 512),
        device_class: deviceClass,
        landing_path: initialPath,
        last_path: initialPath,
        referrer: cap(body.init?.referrer ?? null, 1024),
        utm_source: cap(body.init?.utm_source ?? null, 200),
        utm_medium: cap(body.init?.utm_medium ?? null, 200),
        utm_campaign: cap(body.init?.utm_campaign ?? null, 200),
        utm_content: cap(body.init?.utm_content ?? null, 200),
        utm_term: cap(body.init?.utm_term ?? null, 200),
        gclid: cap(body.init?.gclid ?? null, 200),
        fbclid: cap(body.init?.fbclid ?? null, 200),
        utm_id: cap(body.init?.utm_id ?? null, 200),
        fingerprint_hash: fingerprintHash,
        is_first_visit: isFirstVisit,
        last_seen_at: new Date().toISOString(),
      });
    } else {
      // Existing session — bump last_seen_at only. We deliberately
      // do NOT re-write first-touch fields even when the client sends
      // a fresh `init` payload (codex review #8 — every new tab in
      // sessionStorage was firing init and overwriting the original
      // landing/UTM with whatever the user clicked through to next).
      // last_path IS updated on every pageview so the abandonment
      // dashboard knows the most recent surface the visitor saw.
      const sessionUpdate: Record<string, unknown> = {
        last_seen_at: new Date().toISOString(),
      };
      if (body.name === "pageview" && typeof body.path === "string") {
        sessionUpdate.last_path = body.path.slice(0, 1024);
      }
      await supa
        .from("analytics_sessions")
        .update(sessionUpdate)
        .eq("session_id", sessionId);
    }

    // Sanitize event properties before persistence:
    //   • Strip `email` — we don't want PII duplicated into the
    //     append-only event stream (codex review #5). The session
    //     row carries the correlation; the event stream stays
    //     anonymous.
    //   • Cap `properties` JSON to a sane upper bound so a hostile
    //     client can't bloat the table (codex review #4).
    const rawProps =
      body.properties && typeof body.properties === "object"
        ? body.properties
        : {};
    const { email: _stripEmail, ...withoutEmail } = rawProps as {
      email?: unknown;
    } & Record<string, unknown>;
    void _stripEmail;
    // Codex pass 2 (MEDIUM #7): the prior version stripped `email`
    // and capped `path` but inserted `properties` verbatim — the
    // claimed cap was never enforced. Walk one level deep, drop any
    // value that's not string/number/boolean/null, length-cap
    // strings to 256 chars, and bail entirely if the serialized
    // result exceeds 8KB.
    const sanitizedProps: Record<string, unknown> = {};
    let serializedSize = 0;
    for (const [k, v] of Object.entries(withoutEmail)) {
      if (k.length > 64) continue;
      let safe: unknown;
      if (typeof v === "string") {
        safe = v.slice(0, 256);
      } else if (
        typeof v === "number" ||
        typeof v === "boolean" ||
        v === null
      ) {
        safe = v;
      } else {
        // Reject objects, arrays, functions, BigInts — keeps the
        // event-stream schema flat and predictable.
        continue;
      }
      sanitizedProps[k] = safe;
      serializedSize += k.length + 8;
      if (typeof safe === "string") serializedSize += safe.length;
      if (serializedSize > 8 * 1024) break;
    }
    const eventName = body.name;

    // Email correlation: ONLY on the order_submitted event. Codex
    // review #2 — without this gate, any client could overwrite a
    // session's email correlation with `victim@example.com`. We
    // also still set the email only once per session: a second
    // order_submitted with a different email is rejected.
    if (eventName === "order_submitted") {
      const propEmailRaw = (rawProps as { email?: unknown }).email;
      const propEmail =
        typeof propEmailRaw === "string"
          ? propEmailRaw.trim().toLowerCase()
          : null;
      if (propEmail && /^\S+@\S+\.\S+$/.test(propEmail)) {
        // is(null) → only set on first capture; later orders from a
        // different email on the same browser don't overwrite the
        // attribution.
        await supa
          .from("analytics_sessions")
          .update({ customer_email_lower: propEmail })
          .eq("session_id", sessionId)
          .is("customer_email_lower", null);
      }
      // Stamp the fingerprint as having ordered, once. Conditional on
      // `is(null)` so the very first conversion timestamp wins —
      // matters for "first-session conversion" cohorts on the admin
      // analytics page.
      if (fingerprintHash) {
        try {
          await supa
            .from("visitor_fingerprints")
            .update({ ordered_at: new Date().toISOString() })
            .eq("fingerprint_hash", fingerprintHash)
            .is("ordered_at", null);
        } catch (fpErr) {
          console.error(
            "[analytics] fingerprint ordered_at update failed:",
            fpErr,
          );
        }
      }
    }

    await supa.from("analytics_events").insert({
      session_id: sessionId,
      event_name: eventName,
      path: typeof body.path === "string" ? body.path.slice(0, 1024) : null,
      properties: sanitizedProps,
    });
  } catch (err) {
    console.error("[analytics] insert failed:", err);
    // Don't fail the page — best-effort.
  }

  const res = NextResponse.json({ ok: true });
  if (isNewSession) {
    res.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    });
  }
  return res;
}
