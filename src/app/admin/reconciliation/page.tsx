import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { isPaymentMethod } from "@/lib/payments/methods";
import { ReconciliationTable, type ReconRow } from "./ReconciliationTable";

export const metadata: Metadata = {
  title: "Reconciliation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface RawRow {
  order_id: string;
  customer: { name: string; email: string; phone?: string };
  subtotal_cents: number;
  total_cents?: number | null;
  status: string;
  payment_method: string | null;
  created_at: string;
}

/**
 * Defensive narrow. Mirrors the safety of /admin's safeNarrow — any
 * malformed row is rejected so the dashboard never silently undercounts
 * pending payments. Better to render nothing than render garbage.
 */
function narrow(row: unknown): RawRow | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.order_id !== "string") return null;
  if (typeof r.subtotal_cents !== "number") return null;
  if (typeof r.status !== "string") return null;
  if (typeof r.created_at !== "string") return null;
  const c = r.customer as Record<string, unknown> | null;
  if (!c || typeof c.name !== "string" || typeof c.email !== "string") return null;
  const phone = typeof c.phone === "string" ? c.phone : undefined;
  const pm = r.payment_method;
  let paymentMethod: string | null;
  if (pm === null || pm === undefined) paymentMethod = null;
  else if (isPaymentMethod(pm)) paymentMethod = pm;
  else return null;
  let totalCents: number | null = null;
  if (typeof r.total_cents === "number") totalCents = r.total_cents;
  return {
    order_id: r.order_id,
    customer: { name: c.name, email: c.email, phone },
    subtotal_cents: r.subtotal_cents,
    total_cents: totalCents,
    status: r.status,
    payment_method: paymentMethod,
    created_at: r.created_at,
  };
}

function memoFor(orderId: string): string {
  return `BGP-${orderId.slice(0, 8).toUpperCase()}`;
}

/** Days, rounded up — "2.7 days old" reads as "3 days" so aged-row
 * thresholds (≥3, ≥5, ≥7) trip on the right side of the boundary. */
function ageDays(iso: string): number {
  const created = new Date(iso).getTime();
  const now = Date.now();
  return Math.ceil((now - created) / 86_400_000);
}

function toReconRow(r: RawRow): ReconRow {
  return {
    order_id: r.order_id,
    memo: memoFor(r.order_id),
    customer_name: r.customer.name,
    customer_email: r.customer.email,
    customer_phone: r.customer.phone ?? null,
    payment_method: r.payment_method,
    amount_cents: r.total_cents ?? r.subtotal_cents,
    age_days: ageDays(r.created_at),
    created_at: r.created_at,
    status: r.status,
  };
}

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { tab } = await searchParams;
  const activeTab: "awaiting" | "funded" =
    tab === "funded" ? "funded" : "awaiting";

  const supa = getSupabaseServer();
  let awaitingRows: ReconRow[] = [];
  let fundedRows: ReconRow[] = [];
  let loadError: string | null = null;

  if (!supa) {
    loadError = "Supabase not configured.";
  } else {
    const cols =
      "order_id, customer, subtotal_cents, total_cents, status, payment_method, created_at";
    const [{ data: aData, error: aErr }, { data: fData, error: fErr }] =
      await Promise.all([
        supa
          .from("orders")
          .select(cols)
          // Include legacy `awaiting_wire` rows so old orders still appear.
          .in("status", ["awaiting_payment", "awaiting_wire"])
          // Crypto auto-funds via the NOWPayments IPN — never appears here.
          .in("payment_method", ["wire", "ach", "zelle"])
          .order("created_at", { ascending: true })
          .limit(200),
        supa
          .from("orders")
          .select(cols)
          .eq("status", "funded")
          .in("payment_method", ["wire", "ach", "zelle"])
          .order("created_at", { ascending: true })
          .limit(200),
      ]);
    if (aErr || fErr) loadError = (aErr ?? fErr)?.message ?? "Load error.";
    const aRaw = Array.isArray(aData) ? aData : [];
    const fRaw = Array.isArray(fData) ? fData : [];
    const aNarrowed = aRaw.map(narrow).filter((r): r is RawRow => r !== null);
    const fNarrowed = fRaw.map(narrow).filter((r): r is RawRow => r !== null);
    awaitingRows = aNarrowed.map(toReconRow);
    fundedRows = fNarrowed.map(toReconRow);
    const skippedCount =
      (aRaw.length - aNarrowed.length) + (fRaw.length - fNarrowed.length);
    if (skippedCount > 0) {
      // Codex P1 #10 — schema drift safety net. If `narrow()` rejected
      // any rows (unknown payment_method, malformed customer JSON), the
      // operator must see a count rather than silently undercounting
      // pending payments.
      loadError = (loadError ? loadError + " · " : "") +
        `${skippedCount} row${skippedCount === 1 ? "" : "s"} hidden due to schema drift — investigate /admin to find them.`;
    }
  }

  const stats = {
    awaiting_count: awaitingRows.length,
    awaiting_total_cents: awaitingRows.reduce((s, r) => s + r.amount_cents, 0),
    aged_count: awaitingRows.filter((r) => r.age_days >= 5).length,
    funded_count: fundedRows.length,
    funded_total_cents: fundedRows.reduce((s, r) => s + r.amount_cents, 0),
  };

  const visibleRows = activeTab === "awaiting" ? awaitingRows : fundedRows;

  return (
    <article className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="label-eyebrow text-ink-muted mb-1">Admin</div>
          <h1 className="font-display text-3xl text-ink">Reconciliation</h1>
        </div>
        <Link href="/admin" className="text-xs text-gold hover:underline">
          ← All orders
        </Link>
      </div>
      <p className="text-sm text-ink-muted mb-8 max-w-prose">
        Match incoming bank/Zelle/crypto payments to orders. Each row shows the
        order memo customers were asked to put in their transfer.
        Crypto orders auto-mark via NOWPayments IPN — only manual methods
        (wire, ACH, Zelle) appear here.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <Stat label="Awaiting" value={String(stats.awaiting_count)} />
        <Stat label="Awaiting total" value={formatPrice(stats.awaiting_total_cents)} />
        <Stat
          label="Aged ≥ 5 days"
          value={String(stats.aged_count)}
          danger={stats.aged_count > 0}
        />
        <Stat label="Funded queue" value={String(stats.funded_count)} />
      </div>

      <div className="flex gap-2 mb-6 border-b rule">
        <TabPill
          href="/admin/reconciliation"
          active={activeTab === "awaiting"}
          label={`Awaiting payment (${stats.awaiting_count})`}
        />
        <TabPill
          href="/admin/reconciliation?tab=funded"
          active={activeTab === "funded"}
          label={`Funded · ready to ship (${stats.funded_count})`}
        />
      </div>

      {loadError && (
        <div className="border border-oxblood/40 bg-oxblood/5 text-oxblood px-4 py-3 text-sm mb-6">
          {loadError}
        </div>
      )}

      <ReconciliationTable rows={visibleRows} mode={activeTab} />
    </article>
  );
}

function Stat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`border rule p-3 sm:p-4 ${danger ? "bg-oxblood/5 border-oxblood/40" : "bg-paper-soft"}`}>
      <div className="label-eyebrow text-ink-muted text-[10px] sm:text-xs">{label}</div>
      <div className={`font-mono-data text-lg sm:text-2xl mt-1 ${danger ? "text-oxblood" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function TabPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center h-10 px-4 text-sm border-b-2 -mb-px transition-colors ${
        active
          ? "border-ink text-ink font-medium"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
