"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unsubscribeFromMarketing } from "@/app/actions/account";

interface Props {
  email: string;
  initialSubscribed: boolean;
}

/**
 * Marketing-email opt-out card on /account/security. Customers opt
 * IN by default at checkout (per product decision); this is the
 * permanent opt-out path. We don't expose re-subscribe — if a
 * customer wants back in, the next checkout's pre-checked checkbox
 * does it for them.
 */
export function MarketingPreferences({ email, initialSubscribed }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(initialSubscribed);

  if (!subscribed) {
    return (
      <section className="border rule bg-paper p-6">
        <div className="label-eyebrow text-ink-muted mb-2">Marketing email</div>
        <p className="text-sm text-ink-soft leading-relaxed">
          You&rsquo;re currently <strong>unsubscribed</strong>. We won&rsquo;t send
          marketing email to <span className="font-mono-data text-ink">{email}</span>.
          You&rsquo;ll still receive transactional emails (order confirmations,
          tracking, etc.) — that&rsquo;s required.
        </p>
        <p className="text-xs text-ink-muted mt-3 leading-relaxed">
          To re-subscribe, just leave the checkbox ticked the next time you
          place an order.
        </p>
      </section>
    );
  }

  const onUnsub = () => {
    setError(null);
    startTransition(async () => {
      const res = await unsubscribeFromMarketing();
      if (!res.ok) {
        setError(res.error ?? "Could not unsubscribe.");
        return;
      }
      setSubscribed(false);
      router.refresh();
    });
  };

  return (
    <section className="border rule bg-paper p-6 space-y-3">
      <div className="label-eyebrow text-ink-muted mb-1">Marketing email</div>
      <p className="text-sm text-ink-soft leading-relaxed">
        You&rsquo;re subscribed to occasional research updates and
        new-compound announcements at <span className="font-mono-data text-ink">{email}</span>.
        Transactional order emails always send regardless.
      </p>
      {error && (
        <div className="border-l-4 border-l-oxblood bg-oxblood/5 px-4 py-3 text-sm text-ink">
          {error}
        </div>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={onUnsub}
        className="text-xs h-9 px-4 border rule bg-paper hover:bg-paper-soft text-ink transition-colors disabled:opacity-60"
      >
        {pending ? "Unsubscribing…" : "Unsubscribe from marketing emails"}
      </button>
    </section>
  );
}
