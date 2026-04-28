"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  editOrderShippingAddress,
  cancelOrderByCustomer,
  type ShipAddressInput,
} from "@/app/actions/account";

interface Props {
  orderId: string;
  current: {
    ship_address_1: string;
    ship_address_2?: string | null;
    ship_city: string;
    ship_state: string;
    ship_zip: string;
  };
  /**
   * Compact mode drops the panel chrome (eyebrow + descriptor) and
   * renders the buttons inline so the parent can place them in a
   * shared "manage row" alongside other actions. The expandable form
   * and cancel-confirmation still drop in below the buttons.
   */
  compact?: boolean;
}

/**
 * Customer self-service panel for an awaiting-payment order. Two
 * actions, both server-side gated: edit shipping address (validates,
 * merges into customer JSON, conditional UPDATE) and cancel order
 * (status → cancelled with same status guard).
 *
 * Renders only when the parent decides the order is still in a
 * mutable state — there's no client-side enforcement here, the
 * server actions are the boundary.
 */
export function OrderManagePanel({ orderId, current, compact = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const onSubmitEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: ShipAddressInput = {
      ship_address_1: String(fd.get("ship_address_1") ?? "").trim(),
      ship_address_2: String(fd.get("ship_address_2") ?? "").trim(),
      ship_city: String(fd.get("ship_city") ?? "").trim(),
      ship_state: String(fd.get("ship_state") ?? "").trim(),
      ship_zip: String(fd.get("ship_zip") ?? "").trim(),
    };
    setError(null);
    startTransition(async () => {
      const res = await editOrderShippingAddress(orderId, input);
      if (!res.ok) {
        setError(res.error ?? "Could not update address.");
        return;
      }
      setEditOpen(false);
      router.refresh();
    });
  };

  const onCancel = () => {
    setError(null);
    startTransition(async () => {
      const res = await cancelOrderByCustomer(orderId);
      if (!res.ok) {
        setError(res.error ?? "Could not cancel order.");
        return;
      }
      router.refresh();
    });
  };

  // In compact mode skip the panel chrome and render the buttons in a
  // self-contained group; the parent handles its own surrounding card.
  if (compact) {
    return (
      <div className="contents">
        {!editOpen && !confirmCancel && (
          <>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center justify-center h-10 px-4 bg-paper text-ink border rule font-display uppercase text-[11px] tracking-[0.14em] hover:bg-paper-soft transition-colors"
            >
              Edit address
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="inline-flex items-center justify-center h-10 px-4 bg-paper text-[color:var(--color-danger)] border rule font-display uppercase text-[11px] tracking-[0.14em] hover:bg-paper-soft transition-colors"
            >
              Cancel order
            </button>
          </>
        )}
        {(editOpen || confirmCancel || error) && (
          <div className="basis-full mt-3 space-y-3">
            {error && (
              <div className="border-l-4 border-l-[color:var(--color-danger)] bg-paper-soft px-4 py-3 text-sm text-ink">
                {error}
              </div>
            )}
            {editOpen && (
              <form onSubmit={onSubmitEdit} className="grid grid-cols-1 sm:grid-cols-2 gap-3" noValidate>
                <Field label="Address line 1" name="ship_address_1" defaultValue={current.ship_address_1} required disabled={pending} className="sm:col-span-2" />
                <Field label="Address line 2 (optional)" name="ship_address_2" defaultValue={current.ship_address_2 ?? ""} disabled={pending} className="sm:col-span-2" />
                <Field label="City" name="ship_city" defaultValue={current.ship_city} required disabled={pending} />
                <Field label="State (2 letters)" name="ship_state" defaultValue={current.ship_state} required disabled={pending} maxLength={2} pattern="[A-Za-z]{2}" autoCapitalize="characters" />
                <Field label="ZIP" name="ship_zip" defaultValue={current.ship_zip} required disabled={pending} pattern="\d{5}(-\d{4})?" />
                <div className="sm:col-span-2 flex gap-2">
                  <button type="submit" disabled={pending} className="text-xs h-9 px-4 bg-ink text-paper hover:bg-teal transition-colors disabled:opacity-60">
                    {pending ? "Saving…" : "Save address"}
                  </button>
                  <button type="button" disabled={pending} onClick={() => { setEditOpen(false); setError(null); }} className="text-xs h-9 px-4 border rule bg-paper hover:bg-paper-soft text-ink transition-colors">
                    Cancel edit
                  </button>
                </div>
              </form>
            )}
            {confirmCancel && (
              <div className="border border-[color:var(--color-danger)]/40 bg-paper-soft p-4 space-y-3">
                <p className="text-sm text-ink leading-relaxed">
                  Cancel this order? The order will be moved to <strong>cancelled</strong> and removed from the fulfillment queue. This can&rsquo;t be undone — you&rsquo;ll need to place a new order if you change your mind.
                </p>
                <div className="flex gap-2">
                  <button type="button" disabled={pending} onClick={onCancel} className="text-xs h-9 px-4 bg-[color:var(--color-danger)] text-paper transition-colors disabled:opacity-60">
                    {pending ? "Cancelling…" : "Yes, cancel order"}
                  </button>
                  <button type="button" disabled={pending} onClick={() => { setConfirmCancel(false); setError(null); }} className="text-xs h-9 px-4 border rule bg-paper hover:bg-paper-soft text-ink transition-colors">
                    Keep my order
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="border rule bg-paper p-5 sm:p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="label-eyebrow text-ink-muted mb-1">Manage order</div>
          <p className="text-xs text-ink-muted">
            Editable while the order is awaiting payment.
          </p>
        </div>
        {!editOpen && !confirmCancel && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="text-xs h-9 px-4 border rule bg-paper hover:bg-paper-soft text-ink transition-colors"
            >
              Edit shipping address
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="text-xs h-9 px-4 border rule bg-paper hover:bg-oxblood/5 text-oxblood transition-colors"
            >
              Cancel order
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="border-l-4 border-l-oxblood bg-oxblood/5 px-4 py-3 text-sm text-ink">
          {error}
        </div>
      )}

      {editOpen && (
        <form onSubmit={onSubmitEdit} className="grid grid-cols-1 sm:grid-cols-2 gap-3" noValidate>
          <Field label="Address line 1" name="ship_address_1" defaultValue={current.ship_address_1} required disabled={pending} className="sm:col-span-2" />
          <Field label="Address line 2 (optional)" name="ship_address_2" defaultValue={current.ship_address_2 ?? ""} disabled={pending} className="sm:col-span-2" />
          <Field label="City" name="ship_city" defaultValue={current.ship_city} required disabled={pending} />
          <Field label="State (2 letters)" name="ship_state" defaultValue={current.ship_state} required disabled={pending} maxLength={2} pattern="[A-Za-z]{2}" autoCapitalize="characters" />
          <Field label="ZIP" name="ship_zip" defaultValue={current.ship_zip} required disabled={pending} pattern="\d{5}(-\d{4})?" />
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="text-xs h-9 px-4 bg-ink text-paper hover:bg-teal transition-colors disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save address"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setEditOpen(false);
                setError(null);
              }}
              className="text-xs h-9 px-4 border rule bg-paper hover:bg-paper-soft text-ink transition-colors"
            >
              Cancel edit
            </button>
          </div>
        </form>
      )}

      {confirmCancel && (
        <div className="border border-oxblood/40 bg-oxblood/5 p-4 space-y-3">
          <p className="text-sm text-ink leading-relaxed">
            Cancel this order? The order will be moved to <strong>cancelled</strong>
            {" "}and removed from the fulfillment queue. This can&rsquo;t be undone — you&rsquo;ll
            need to place a new order if you change your mind.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onCancel}
              className="text-xs h-9 px-4 bg-oxblood text-paper hover:bg-oxblood/90 transition-colors disabled:opacity-60"
            >
              {pending ? "Cancelling…" : "Yes, cancel order"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setConfirmCancel(false);
                setError(null);
              }}
              className="text-xs h-9 px-4 border rule bg-paper hover:bg-paper-soft text-ink transition-colors"
            >
              Keep my order
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

function Field({ label, className, ...rest }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">{label}</span>
      <input
        {...rest}
        className="h-9 px-3 border rule bg-paper text-sm focus:outline-none focus:border-ink"
      />
    </label>
  );
}
