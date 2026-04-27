"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { expireCouponAdmin, deleteCouponAdmin } from "@/app/actions/coupons-admin";

export function CouponRowActions({
  code,
  status,
}: {
  code: string;
  status: "active" | "expired" | "exhausted";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onExpire = () => {
    if (!confirm(`Expire coupon ${code.toUpperCase()}? It will stop applying immediately.`))
      return;
    start(async () => {
      const res = await expireCouponAdmin(code);
      if (!res.ok) {
        setError(res.error ?? "Expire failed.");
        return;
      }
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!confirm(`Delete coupon ${code.toUpperCase()}? This is permanent.`)) return;
    start(async () => {
      const res = await deleteCouponAdmin(code);
      if (!res.ok) {
        setError(res.error ?? "Delete failed.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-3 justify-end">
      {status === "active" && (
        <button
          type="button"
          onClick={onExpire}
          disabled={pending}
          className="text-xs text-ink-soft hover:text-ink"
        >
          Expire
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="text-xs text-danger/80 hover:text-danger"
      >
        Delete
      </button>
      {error && <span className="text-xs text-danger ml-2">{error}</span>}
    </div>
  );
}
