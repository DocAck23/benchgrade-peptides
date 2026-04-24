"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/app/actions/admin";
import type { OrderStatus } from "@/lib/orders/status";

const TRANSITIONS: Record<string, { label: string; target: OrderStatus; variant: "primary" | "ghost" | "destructive" }[]> = {
  awaiting_payment: [
    { label: "Mark funded", target: "funded", variant: "primary" },
    { label: "Cancel", target: "cancelled", variant: "destructive" },
  ],
  // Legacy pre-rename orders can still be actioned via the same transitions.
  awaiting_wire: [
    { label: "Mark funded", target: "funded", variant: "primary" },
    { label: "Cancel", target: "cancelled", variant: "destructive" },
  ],
  funded: [
    { label: "Mark shipped", target: "shipped", variant: "primary" },
    { label: "Refund", target: "refunded", variant: "destructive" },
  ],
  shipped: [{ label: "Refund", target: "refunded", variant: "destructive" }],
  cancelled: [],
  refunded: [],
};

export function StatusControls({ orderId, current }: { orderId: string; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const actions = TRANSITIONS[current] ?? [];

  return (
    <div className="flex flex-col items-end gap-2">
      <span className="font-mono-data text-xs text-ink-muted uppercase tracking-wider">
        {current.replace(/_/g, " ")}
      </span>
      <div className="flex gap-2">
        {actions.map((a) => (
          <button
            key={a.target}
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await updateOrderStatus(orderId, a.target);
                if (!res.ok) setError(res.error ?? "Update failed.");
                else router.refresh();
              });
            }}
            className={`inline-flex items-center h-9 px-3 text-xs border transition-colors disabled:opacity-60 ${
              a.variant === "primary"
                ? "bg-ink text-paper border-ink hover:bg-teal hover:border-teal"
                : a.variant === "destructive"
                ? "rule bg-paper text-oxblood hover:bg-oxblood/5"
                : "rule bg-paper text-ink hover:bg-paper-soft"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {error && <div className="text-xs text-oxblood">{error}</div>}
    </div>
  );
}
