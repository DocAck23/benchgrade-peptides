"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  skipNextCycle,
} from "@/app/actions/subscriptions";
import type { SubscriptionRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Client-side pause/resume/cancel controls.
 *
 * Cancel is two-step (friction by design per spec §16.4): first click
 * expands a confirm panel that surfaces the locked-in discount the user
 * is about to forfeit, second click (Confirm cancel) actually fires the
 * action. router.refresh() re-fetches the server component on success.
 */

interface SubscriptionActionsProps {
  sub: SubscriptionRow;
}

type Pending = "pause" | "resume" | "cancel" | "skip" | null;

const primaryBtn =
  "inline-flex items-center justify-center h-11 px-6 bg-wine text-paper font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep transition-colors duration-200 ease-out disabled:opacity-60 disabled:cursor-not-allowed";

const secondaryBtn =
  "inline-flex items-center justify-center h-11 px-6 border rule bg-paper text-ink font-display uppercase text-[12px] tracking-[0.14em] hover:bg-paper-soft transition-colors duration-200 ease-out disabled:opacity-60 disabled:cursor-not-allowed";

const dangerBtn =
  "inline-flex items-center justify-center h-11 px-6 bg-paper text-ink-soft border rule font-display uppercase text-[12px] tracking-[0.14em] hover:text-ink hover:bg-paper-soft transition-colors duration-200 ease-out disabled:opacity-60 disabled:cursor-not-allowed";

export function SubscriptionActions({ sub }: SubscriptionActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [skipNotice, setSkipNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const status = sub.status;

  if (status === "cancelled" || status === "completed") {
    return (
      <div className="flex flex-wrap items-center gap-4 mt-6">
        <p className="text-sm text-ink-soft">
          {status === "completed"
            ? "Plan complete — every cycle shipped."
            : "This subscription is cancelled."}
        </p>
        <Link href="/catalogue" className={primaryBtn}>
          Subscribe again
        </Link>
      </div>
    );
  }

  async function run(
    kind: Exclude<Pending, null>,
    fn: () => Promise<{ ok: boolean; error?: string }>
  ) {
    setPending(kind);
    setError(null);
    const res = await fn();
    setPending(null);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong. Try again in a moment.");
      return;
    }
    setConfirmingCancel(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {status === "active" && (
          <button
            type="button"
            disabled={pending !== null}
            onClick={async () => {
              setError(null);
              setSkipNotice(null);
              setPending("skip");
              const res = await skipNextCycle(sub.id);
              setPending(null);
              if (!res.ok) {
                setError(res.error ?? "Could not skip the next cycle.");
                return;
              }
              if (res.nextShipDate) {
                const formatted = new Date(res.nextShipDate).toLocaleDateString(
                  undefined,
                  { month: "long", day: "numeric", year: "numeric" },
                );
                setSkipNotice(`Skipped — next shipment now ${formatted}.`);
              }
              startTransition(() => router.refresh());
            }}
            className={secondaryBtn}
          >
            {pending === "skip" ? "Skipping…" : "Skip next cycle"}
          </button>
        )}
        {status === "active" && (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() =>
              run("pause", () => pauseSubscription(sub.id))
            }
            className={secondaryBtn}
          >
            {pending === "pause" ? "Pausing…" : "Pause"}
          </button>
        )}
        {status === "paused" && (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() =>
              run("resume", () => resumeSubscription(sub.id))
            }
            className={primaryBtn}
          >
            {pending === "resume" ? "Resuming…" : "Resume"}
          </button>
        )}
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => setConfirmingCancel((v) => !v)}
          className={cn(dangerBtn, confirmingCancel && "text-ink")}
          aria-expanded={confirmingCancel}
          aria-controls={`cancel-confirm-${sub.id}`}
        >
          Cancel subscription
        </button>
      </div>

      {confirmingCancel && (
        <div
          id={`cancel-confirm-${sub.id}`}
          className="border rule bg-paper-soft p-5"
          role="alertdialog"
          aria-labelledby={`cancel-heading-${sub.id}`}
        >
          <h4
            id={`cancel-heading-${sub.id}`}
            className="font-display uppercase text-[12px] tracking-[0.14em] text-ink mb-2"
          >
            Cancel this subscription?
          </h4>
          <p
            className="font-editorial text-base text-ink-soft mb-4"
            style={{ fontFamily: "var(--font-editorial)" }}
          >
            You&apos;ll lose your locked-in {sub.discount_percent}% discount.
            Future cycles won&apos;t ship and won&apos;t be charged.
          </p>
          <label className="block mb-4">
            <span className="block text-[11px] uppercase tracking-[0.1em] text-ink-muted mb-1">
              What changed? (optional)
            </span>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="A note for our team — research wrapped, switching plans, found a better option, etc."
              className="w-full px-3 py-2 border rule bg-paper text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-ink"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending !== null}
              onClick={() =>
                run("cancel", () =>
                  cancelSubscription(sub.id, cancelReason.trim() || undefined),
                )
              }
              className={primaryBtn}
            >
              {pending === "cancel" ? "Cancelling…" : "Confirm cancel"}
            </button>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => {
                setConfirmingCancel(false);
                setCancelReason("");
              }}
              className={secondaryBtn}
            >
              Keep subscription
            </button>
          </div>
        </div>
      )}

      {skipNotice && !error && (
        <p
          role="status"
          className="text-sm text-ink-soft border rule bg-paper-soft p-3"
        >
          {skipNotice}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="text-sm text-wine-deep border rule bg-paper-soft p-3"
        >
          {error}
        </p>
      )}
    </div>
  );
}
