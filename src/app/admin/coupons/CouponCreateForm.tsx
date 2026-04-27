"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCouponAdmin } from "@/app/actions/coupons-admin";

type DiscountKind = "percent" | "flat";

export function CouponCreateForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [kind, setKind] = useState<DiscountKind>("percent");
  const [percentOff, setPercentOff] = useState("");
  const [flatOffDollars, setFlatOffDollars] = useState("");
  const [minSubtotalDollars, setMinSubtotalDollars] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [maxPerEmail, setMaxPerEmail] = useState("1");
  const [note, setNote] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const percent = kind === "percent" ? Number.parseInt(percentOff, 10) : null;
    const flatCents =
      kind === "flat"
        ? Math.round(Number.parseFloat(flatOffDollars || "0") * 100)
        : null;
    const minCents = Math.round(
      Number.parseFloat(minSubtotalDollars || "0") * 100,
    );

    if (kind === "percent" && (!percent || percent < 1 || percent > 100)) {
      setError("Percent off must be 1-100.");
      return;
    }
    if (kind === "flat" && (!flatCents || flatCents < 1)) {
      setError("Flat amount must be greater than $0.");
      return;
    }

    start(async () => {
      const res = await createCouponAdmin({
        code: code.trim().toLowerCase(),
        percent_off: percent,
        flat_off_cents: flatCents,
        min_subtotal_cents: Number.isFinite(minCents) ? minCents : 0,
        valid_from: validFrom ? new Date(validFrom).toISOString() : null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        max_redemptions: maxRedemptions
          ? Number.parseInt(maxRedemptions, 10)
          : null,
        max_per_email: Number.parseInt(maxPerEmail || "1", 10),
        note: note.trim() || null,
      });
      if (!res.ok) {
        setError(res.error ?? "Failed to create coupon.");
        return;
      }
      setSuccess(`Created ${code.trim().toLowerCase()}.`);
      setCode("");
      setPercentOff("");
      setFlatOffDollars("");
      setMinSubtotalDollars("");
      setValidFrom("");
      setValidUntil("");
      setMaxRedemptions("");
      setMaxPerEmail("1");
      setNote("");
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="border rule bg-paper p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <Field label="Code" required>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="WELCOME10"
          autoCapitalize="characters"
          className="h-10 px-3 border rule bg-paper text-sm font-mono-data uppercase"
          required
        />
      </Field>

      <Field label="Discount type">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as DiscountKind)}
          className="h-10 px-3 border rule bg-paper text-sm"
        >
          <option value="percent">Percent off</option>
          <option value="flat">Flat dollars off</option>
        </select>
      </Field>

      {kind === "percent" ? (
        <Field label="Percent off (1-100)" required>
          <input
            type="number"
            min={1}
            max={100}
            value={percentOff}
            onChange={(e) => setPercentOff(e.target.value)}
            className="h-10 px-3 border rule bg-paper text-sm"
            required
          />
        </Field>
      ) : (
        <Field label="Flat off ($)" required>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={flatOffDollars}
            onChange={(e) => setFlatOffDollars(e.target.value)}
            className="h-10 px-3 border rule bg-paper text-sm"
            required
          />
        </Field>
      )}

      <Field label="Min subtotal ($)">
        <input
          type="number"
          min={0}
          step={1}
          value={minSubtotalDollars}
          onChange={(e) => setMinSubtotalDollars(e.target.value)}
          placeholder="0"
          className="h-10 px-3 border rule bg-paper text-sm"
        />
      </Field>

      <Field label="Valid from">
        <input
          type="datetime-local"
          value={validFrom}
          onChange={(e) => setValidFrom(e.target.value)}
          className="h-10 px-3 border rule bg-paper text-sm"
        />
      </Field>

      <Field label="Valid until">
        <input
          type="datetime-local"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          className="h-10 px-3 border rule bg-paper text-sm"
        />
      </Field>

      <Field label="Max total redemptions">
        <input
          type="number"
          min={1}
          value={maxRedemptions}
          onChange={(e) => setMaxRedemptions(e.target.value)}
          placeholder="∞"
          className="h-10 px-3 border rule bg-paper text-sm"
        />
      </Field>

      <Field label="Max per email">
        <input
          type="number"
          min={1}
          value={maxPerEmail}
          onChange={(e) => setMaxPerEmail(e.target.value)}
          className="h-10 px-3 border rule bg-paper text-sm"
        />
      </Field>

      <Field label="Note (internal)">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="2026 Q2 newsletter promo"
          className="h-10 px-3 border rule bg-paper text-sm"
        />
      </Field>

      <div className="md:col-span-2 lg:col-span-3 flex items-center justify-between gap-4 pt-2">
        <div className="text-sm">
          {error && <span className="text-danger">{error}</span>}
          {success && <span className="text-teal">{success}</span>}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-10 px-6 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-gold disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create coupon"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
        {label}
        {required ? <span className="text-wine"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
