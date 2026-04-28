"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { US_STATES_OPTIONS } from "@/lib/geography/us-states";
import {
  updateMyProfile,
  type ProfileFormValues,
} from "@/app/actions/profile";

interface ProfileFormProps {
  initial: ProfileFormValues;
}

/**
 * Profile editor (client island).
 *
 * Local controlled state for snappy edit feedback. Save fires the
 * server action, which validates server-side and upserts into the
 * profiles table. On success we router.refresh() so the dashboard
 * greeting and any other surfaces reading user_metadata pick up the
 * new first/last name on the next render.
 */
export function ProfileForm({ initial }: ProfileFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProfileFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const update = <K extends keyof ProfileFormValues>(
    key: K,
    value: ProfileFormValues[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateMyProfile(form);
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="border rule bg-paper p-6 lg:p-8 space-y-6"
      noValidate
    >
      <div>
        <h2 className="font-display uppercase text-[12px] tracking-[0.18em] text-ink mb-4">
          Name
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First name"
            required
            autoComplete="given-name"
            value={form.first_name}
            onChange={(e) => update("first_name", e.target.value)}
            disabled={isPending}
          />
          <Input
            label="Last name"
            required
            autoComplete="family-name"
            value={form.last_name}
            onChange={(e) => update("last_name", e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      <div>
        <h2 className="font-display uppercase text-[12px] tracking-[0.18em] text-ink mb-4">
          Contact
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone"
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            disabled={isPending}
          />
          <Input
            label="Institution / lab"
            autoComplete="organization"
            value={form.institution}
            onChange={(e) => update("institution", e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      <div>
        <h2 className="font-display uppercase text-[12px] tracking-[0.18em] text-ink mb-4">
          Default shipping address
        </h2>
        <div className="space-y-4">
          <Input
            label="Address line 1"
            autoComplete="address-line1"
            value={form.ship_address_1}
            onChange={(e) => update("ship_address_1", e.target.value)}
            disabled={isPending}
          />
          <Input
            label="Address line 2"
            autoComplete="address-line2"
            value={form.ship_address_2}
            onChange={(e) => update("ship_address_2", e.target.value)}
            disabled={isPending}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="City"
              autoComplete="address-level2"
              value={form.ship_city}
              onChange={(e) => update("ship_city", e.target.value)}
              disabled={isPending}
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="profile-ship-state"
                className="label-eyebrow"
              >
                State
              </label>
              <select
                id="profile-ship-state"
                value={form.ship_state}
                onChange={(e) => update("ship_state", e.target.value)}
                disabled={isPending}
                className="h-11 px-3 rounded-sm bg-paper border border-rule text-ink focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold-light"
              >
                <option value="">—</option>
                {US_STATES_OPTIONS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="ZIP"
              autoComplete="postal-code"
              inputMode="numeric"
              value={form.ship_zip}
              onChange={(e) => update("ship_zip", e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-danger)] border-l-4 border-l-[color:var(--color-danger)] bg-paper-soft px-4 py-2"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-4 pt-2">
        <Button type="submit" variant="primary" size="lg" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {savedAt && !isPending && (
          <span className="text-sm text-ink-muted" aria-live="polite">
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}
