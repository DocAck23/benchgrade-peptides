"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { setAccountPassword } from "@/app/actions/auth";

export function SetPasswordForm({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (success) {
    return (
      <div className="border-2 border-gold-dark bg-gold-light/20 p-6">
        <div className="label-eyebrow text-gold-dark mb-2">Saved</div>
        <h2 className="font-display text-xl text-ink mb-2">Password updated.</h2>
        <p className="text-sm text-ink-soft leading-relaxed">
          You can now sign in with <span className="font-mono-data text-ink">{email}</span> and
          your new password — or keep using a magic link, whichever you prefer.
        </p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="mt-4 text-xs text-ink-muted underline hover:text-ink"
        >
          Change it again
        </button>
      </div>
    );
  }

  return (
    <form
      action={(formData: FormData) => {
        setError(null);
        startTransition(async () => {
          const res = await setAccountPassword(formData);
          if (res.ok) {
            setSuccess(true);
          } else {
            setError(res.error ?? "Something went wrong. Please try again.");
          }
        });
      }}
      className="border rule bg-paper p-6 space-y-5"
      noValidate
    >
      {error && (
        <div
          role="alert"
          className="border-l-4 border-l-[color:var(--color-danger)] bg-paper-soft p-4 text-sm text-ink leading-relaxed"
        >
          {error}
        </div>
      )}
      {/* Email is read-only; only present so password managers know which
          account this credential is for. */}
      <Input
        label="Email"
        name="email"
        type="email"
        value={email}
        readOnly
        autoComplete="username"
      />
      <Input
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        placeholder="At least 10 characters"
        disabled={pending}
      />
      <Input
        label="Confirm password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        disabled={pending}
      />
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
