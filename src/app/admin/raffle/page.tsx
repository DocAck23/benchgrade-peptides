import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { listRaffleMonths } from "@/app/actions/raffle";
import { LocalTime } from "@/components/admin/LocalTime";
import { formatPrice } from "@/lib/utils";
import { RaffleMonthCard } from "./RaffleMonthCard";

export const metadata: Metadata = {
  title: "Raffle · Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /admin/raffle — founder's surface for the monthly raffle:
 *   • Configure each month's prize (cash $X or 2 vials)
 *   • Trigger snapshot manually if the cron missed
 *   • Confirm the drawn winner before the prize side-effects fire
 *
 * Lists the last 24 months. Each row is a client island
 * (RaffleMonthCard) so the configure / snapshot-now / confirm
 * actions are one click away with no full-page rerender.
 */
export default async function AdminRafflePage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const months = await listRaffleMonths();

  return (
    <article className="max-w-5xl mx-auto px-6 lg:px-10 py-12 space-y-8">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <div className="label-eyebrow text-ink-muted mb-2">Admin</div>
          <h1 className="font-display text-4xl text-ink">Raffle</h1>
          <p className="text-sm text-ink-soft mt-1 max-w-prose">
            Pre-configure monthly prizes, run the snapshot/draw if a cron
            missed, and confirm winners before prize side-effects fire.
          </p>
        </div>
        <a href="/admin" className="text-sm text-teal hover:underline">
          ← Back to orders
        </a>
      </header>

      {months.length === 0 ? (
        <p className="border rule bg-paper-soft p-6 text-sm text-ink-muted">
          No raffle months yet. The first cron snapshot runs on the last
          day of the calendar month at 23:55 UTC and creates this month&rsquo;s
          row automatically with a default cash $500 prize. You can also
          configure a month manually below to override the default before
          the snapshot fires.
        </p>
      ) : (
        <div className="space-y-4">
          {months.map((m) => (
            <RaffleMonthCard
              key={m.month}
              month={m.month}
              prizeKind={m.prize_kind}
              prizeAmountCents={m.prize_amount_cents}
              entrySnapshotAt={m.entry_snapshot_at}
              drawnAt={m.drawn_at}
              confirmedAt={m.confirmed_by_admin_at}
              winnerUserId={m.winner_user_id}
              totalEntries={m.total_entries}
            />
          ))}
        </div>
      )}

      <section className="border rule bg-paper-soft p-5 text-xs text-ink-muted leading-relaxed">
        <p>
          Schedule: snapshot fires on day 28–31 at 23:55 UTC; the action is
          idempotent so the redundant Feb-30 / Mar-31 firings on shorter
          months are no-ops. Draw fires on the 1st at 09:00 UTC for the
          previous calendar month. Both crons require{" "}
          <code className="font-mono-data">CRON_SECRET</code> in production.
        </p>
        <p className="mt-2">
          Confirmed months are frozen — once you click <em>Confirm winner</em>
          on a row, the prize side-effects (cash payout entry or two vial
          credits) are issued and the row can&rsquo;t be edited.
        </p>
      </section>

      <section>
        <h2 className="label-eyebrow text-ink-muted mb-3">Most recent months</h2>
        <div className="border rule bg-paper">
          <ul className="divide-y rule">
            {months.slice(0, 12).map((m) => (
              <li
                key={`row-${m.month}`}
                className="px-5 py-3 flex items-center gap-4 text-sm"
              >
                <span className="font-mono-data text-ink w-24 shrink-0">
                  {m.month}
                </span>
                <span className="text-ink-soft w-32 shrink-0">
                  {m.prize_kind === "cash"
                    ? m.prize_amount_cents
                      ? `${formatPrice(m.prize_amount_cents)} cash`
                      : "Cash"
                    : "2 vials"}
                </span>
                <span className="text-ink-muted w-24 shrink-0 text-right">
                  {m.total_entries.toLocaleString()} entries
                </span>
                <span className="flex-1 text-xs text-ink-muted text-right">
                  {m.confirmed_by_admin_at ? (
                    <>
                      Confirmed <LocalTime iso={m.confirmed_by_admin_at} />
                    </>
                  ) : m.drawn_at ? (
                    <>
                      Drawn <LocalTime iso={m.drawn_at} /> · awaiting confirmation
                    </>
                  ) : m.entry_snapshot_at ? (
                    <>
                      Snapshotted <LocalTime iso={m.entry_snapshot_at} /> · awaiting draw
                    </>
                  ) : (
                    "Open"
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </article>
  );
}
