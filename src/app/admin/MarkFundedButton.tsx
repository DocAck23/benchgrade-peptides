"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markOrderFunded } from "@/app/actions/admin";

/**
 * Inline mark-funded action for the orders list. Provides a one-click
 * confirmation flow so admin doesn't have to navigate into each order
 * during reconciliation. Mirrors the transition rules in
 * StatusControls (only awaiting_payment / awaiting_wire allowed).
 */
export function MarkFundedButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (error) {
    return (
      <span className="text-xs text-oxblood" title={error}>
        {error.slice(0, 40)}
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs px-2 py-1 border border-teal text-teal hover:bg-teal hover:text-paper transition-colors"
      >
        Mark funded
      </button>
    );
  }

  return (
    <span className="inline-flex gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await markOrderFunded(orderId);
            if (!res.ok) {
              setError(res.error ?? "Failed");
              setConfirming(false);
              return;
            }
            router.refresh();
          })
        }
        className="text-xs px-2 py-1 bg-teal text-paper hover:bg-teal-dark disabled:opacity-50"
      >
        {pending ? "Marking…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="text-xs px-2 py-1 border rule text-ink-soft hover:bg-paper-soft"
      >
        Cancel
      </button>
    </span>
  );
}
