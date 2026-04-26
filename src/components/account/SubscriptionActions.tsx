"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
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

type Pending = "pause" | "resume" | "cancel" | null;

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
  const [error, setError] = useState<string | null>(null);
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
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending !== null}
              onClick={() =>
                run("cancel", () => cancelSubscription(sub.id))
              }
              className={primaryBtn}
            >
              {pending === "cancel" ? "Cancelling…" : "Confirm cancel"}
            </button>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => setConfirmingCancel(false)}
              className={secondaryBtn}
            >
              Keep subscription
            </button>
          </div>
        </div>
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
