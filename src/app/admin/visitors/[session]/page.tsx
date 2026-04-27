import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Visitor path · Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function VisitorPathPage({
  params,
}: {
  params: Promise<{ session: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { session } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(session)) notFound();

  const supa = getSupabaseServer();
  if (!supa) notFound();

  const { data: sessionRow } = await supa
    .from("analytics_sessions")
    .select("*")
    .eq("session_id", session)
    .maybeSingle();
  if (!sessionRow) notFound();

  const { data: events } = await supa
    .from("analytics_events")
    .select("event_name, occurred_at, path, properties")
    .eq("session_id", session)
    .order("occurred_at", { ascending: true });

  const s = sessionRow as Record<string, string | null>;
  const evList =
    (events ?? []) as Array<{
      event_name: string;
      occurred_at: string;
      path: string | null;
      properties: Record<string, unknown> | null;
    }>;
  const sessionStart = s.first_seen_at ? new Date(s.first_seen_at) : null;
  const sessionEnd = s.last_seen_at ? new Date(s.last_seen_at) : null;
  const sessionMs =
    sessionStart && sessionEnd ? sessionEnd.getTime() - sessionStart.getTime() : 0;

  return (
    <article className="max-w-5xl mx-auto px-6 lg:px-10 py-12 space-y-8">
      <header className="flex items-baseline justify-between gap-4 mb-2">
        <div>
          <div className="label-eyebrow text-ink-muted mb-2">Admin · visitor</div>
          <h1 className="font-display text-3xl text-ink font-mono-data">
            {session.slice(0, 8)}…
          </h1>
        </div>
        <Link
          href="/admin/visitors"
          className="text-sm text-teal hover:underline"
        >
          ← Back to visitors
        </Link>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="First seen" value={formatLocal(s.first_seen_at)} />
        <Field label="Last seen" value={formatLocal(s.last_seen_at)} />
        <Field label="Time on site" value={formatDuration(sessionMs)} />
        <Field label="Country" value={s.country ?? "—"} />
        <Field label="Device" value={s.device_class ?? "—"} />
        <Field
          label="Source"
          value={s.utm_source ?? referrerHost(s.referrer) ?? "(direct)"}
        />
        <Field label="Landing" value={s.landing_path ?? "—"} mono />
        <Field
          label="Email"
          value={s.customer_email_lower ?? "(not entered)"}
          mono
        />
      </section>

      <section>
        <h2 className="label-eyebrow text-ink-muted mb-3">Event timeline</h2>
        {evList.length === 0 ? (
          <div className="border rule bg-paper-soft p-5 text-sm text-ink-muted">
            No events recorded for this session.
          </div>
        ) : (
          <ol className="border rule bg-paper divide-y rule">
            {evList.map((e, i) => (
              <li key={i} className="px-5 py-3 flex items-baseline gap-4">
                <span className="font-mono-data text-xs text-ink-muted whitespace-nowrap w-44">
                  {formatLocal(e.occurred_at)}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 text-[10px] font-mono-data uppercase ${eventClass(e.event_name)}`}
                >
                  {e.event_name}
                </span>
                <span className="font-mono-data text-xs text-ink truncate flex-1">
                  {e.path ?? "—"}
                </span>
                {e.properties && Object.keys(e.properties).length > 0 && (
                  <span className="text-[10px] text-ink-muted truncate max-w-md">
                    {Object.entries(e.properties)
                      .map(([k, v]) => `${k}=${truncate(String(v), 24)}`)
                      .join(" · ")}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}

function eventClass(name: string): string {
  switch (name) {
    case "order_submitted":
    case "order_funded":
    case "subscription_started":
      return "bg-teal/10 text-teal";
    case "checkout_start":
    case "checkout_step":
      return "bg-oxblood/10 text-oxblood";
    case "add_to_cart":
    case "remove_from_cart":
      return "bg-gold-dark/10 text-gold-dark";
    case "coupon_attempt":
      return "bg-wine/10 text-wine";
    default:
      return "bg-ink-muted/15 text-ink-muted";
  }
}

function formatLocal(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  const rem = min % 60;
  return `${hr}h ${rem}m`;
}

function referrerHost(ref: string | null | undefined): string | null {
  if (!ref) return null;
  try {
    return new URL(ref).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border rule bg-paper px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
        {label}
      </div>
      <div
        className={`mt-1 text-sm text-ink ${mono ? "font-mono-data text-xs" : ""} truncate`}
      >
        {value}
      </div>
    </div>
  );
}
