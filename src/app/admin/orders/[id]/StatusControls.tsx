"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markOrderFunded,
  markOrderShipped,
  markOrderRefunded,
  cancelOrder,
} from "@/app/actions/admin";

type Variant = "primary" | "ghost" | "destructive";
type ActionKind = "fund" | "ship" | "refund" | "cancel";

interface Action {
  label: string;
  kind: ActionKind;
  variant: Variant;
}

/**
 * State-machine of admin transitions exposed in the dashboard. Every
 * action routes to a validating server-side helper (markOrderFunded,
 * markOrderShipped, markOrderRefunded, cancelOrder) — never to a
 * generic UPDATE primitive — so each transition fires its required
 * side effects (customer email, AgeRecode handoff, affiliate clawback,
 * funded_at stamp, etc.).
 */
const TRANSITIONS: Record<string, Action[]> = {
  awaiting_payment: [
    { label: "Mark funded", kind: "fund", variant: "primary" },
    { label: "Cancel", kind: "cancel", variant: "destructive" },
  ],
  awaiting_wire: [
    { label: "Mark funded", kind: "fund", variant: "primary" },
    { label: "Cancel", kind: "cancel", variant: "destructive" },
  ],
  funded: [
    { label: "Mark shipped", kind: "ship", variant: "primary" },
    { label: "Refund", kind: "refund", variant: "destructive" },
  ],
  // Refund is intentionally NOT exposed from `shipped` — server-side
  // markOrderRefunded only allows `funded → refunded`. Once the box is
  // out the door, refund flows through a different (out-of-band) path.
  shipped: [],
  cancelled: [],
  refunded: [],
};

const CARRIERS = ["USPS", "UPS", "FedEx", "DHL"] as const;

export function StatusControls({ orderId, current }: { orderId: string; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shipFormOpen, setShipFormOpen] = useState(false);
  const actions = TRANSITIONS[current] ?? [];

  const variantClass = (v: Variant) =>
    v === "primary"
      ? "bg-ink text-paper border-ink hover:bg-gold hover:border-gold"
      : v === "destructive"
      ? "rule bg-paper text-oxblood hover:bg-oxblood/5"
      : "rule bg-paper text-ink hover:bg-paper-soft";

  const runSimple = (kind: Exclude<ActionKind, "ship">) => {
    setError(null);
    startTransition(async () => {
      let res: { ok: boolean; error?: string };
      if (kind === "fund") res = await markOrderFunded(orderId);
      else if (kind === "refund") res = await markOrderRefunded(orderId);
      else res = await cancelOrder(orderId);
      if (!res.ok) setError(res.error ?? "Update failed.");
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <span className="font-mono-data text-xs text-ink-muted uppercase tracking-wider">
        {current.replace(/_/g, " ")}
      </span>

      {!shipFormOpen && (
        <div className="flex gap-2 flex-wrap justify-end">
          {actions.map((a) => (
            <button
              key={a.kind}
              type="button"
              disabled={pending}
              onClick={() => {
                if (a.kind === "ship") {
                  setError(null);
                  setShipFormOpen(true);
                  return;
                }
                runSimple(a.kind);
              }}
              className={`inline-flex items-center h-9 px-3 text-xs border transition-colors disabled:opacity-60 ${variantClass(a.variant)}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {shipFormOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const trackingNumber = String(fd.get("tracking_number") ?? "").trim();
            const carrier = String(fd.get("carrier") ?? "");
            setError(null);
            if (!trackingNumber) {
              setError("Tracking number is required.");
              return;
            }
            startTransition(async () => {
              const res = await markOrderShipped(orderId, trackingNumber, carrier);
              if (!res.ok) {
                setError(res.error ?? "Failed to mark shipped.");
                return;
              }
              setShipFormOpen(false);
              router.refresh();
            });
          }}
          className="border rule bg-paper p-3 flex flex-col gap-2 w-full max-w-sm"
        >
          <div className="text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            Mark shipped — required:
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
              Carrier
            </span>
            <select
              name="carrier"
              defaultValue="USPS"
              required
              disabled={pending}
              className="h-9 px-2 border rule bg-paper text-sm focus:outline-none focus:border-ink"
            >
              {CARRIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
              Tracking number
            </span>
            <input
              type="text"
              name="tracking_number"
              autoComplete="off"
              autoCapitalize="characters"
              required
              maxLength={120}
              pattern="[A-Z0-9-]+"
              placeholder="9400111899560000000000"
              disabled={pending}
              className="h-9 px-2 border rule bg-paper text-sm font-mono-data focus:outline-none focus:border-ink"
            />
          </label>
          <div className="flex gap-2 mt-1">
            <button
              type="submit"
              disabled={pending}
              className={`inline-flex items-center h-9 px-3 text-xs border transition-colors disabled:opacity-60 ${variantClass("primary")}`}
            >
              {pending ? "Marking…" : "Mark shipped"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setShipFormOpen(false);
                setError(null);
              }}
              className={`inline-flex items-center h-9 px-3 text-xs border transition-colors disabled:opacity-60 ${variantClass("ghost")}`}
            >
              Cancel
            </button>
          </div>
          <p className="text-[10px] text-ink-muted leading-tight mt-1">
            Server enforces uppercase letters / digits / hyphens only. Tracking is
            required so the shipped email + customer portal carrier link both work.
          </p>
        </form>
      )}

      {error && <div className="text-xs text-oxblood">{error}</div>}
    </div>
  );
}
