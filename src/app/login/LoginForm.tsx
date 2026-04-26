"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestMagicLink } from "@/app/actions/auth";

interface LoginFormProps {
  initialError: string | null;
  next: string | null;
}

export function LoginForm({ initialError, next }: LoginFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Mail className="w-8 h-8 text-gold-dark" strokeWidth={1.5} aria-hidden />
        <h2 className="font-display text-2xl text-ink">Check your inbox.</h2>
        <p className="text-sm text-ink-soft leading-relaxed">
          We sent a sign-in link to <span className="text-ink font-medium">{sentTo}</span>.
          The link expires in 60 minutes.
        </p>
        <p className="text-xs text-ink-muted leading-relaxed">
          Don&rsquo;t see it? Check spam, or wait a moment and request a new one.
        </p>
        <button
          type="button"
          className="text-xs text-ink-muted underline hover:text-gold-dark transition-colors"
          onClick={() => {
            setSentTo(null);
            setError(null);
          }}
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form
      action={(formData: FormData) => {
        const email = String(formData.get("email") ?? "").trim();
        setError(null);
        startTransition(async () => {
          const res = await requestMagicLink(formData);
          if (res.ok) {
            setSentTo(email);
          } else {
            setError(res.error ?? "Something went wrong. Please try again.");
          }
        });
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      {error && (
        <div
          role="alert"
          className="border-l-4 border-l-[color:var(--color-danger)] bg-paper-soft p-4 text-sm text-ink leading-relaxed rounded-sm"
        >
          {error}
        </div>
      )}
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        placeholder="researcher@lab.edu"
        disabled={pending}
      />
      {next && <input type="hidden" name="next" value={next} />}
      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send sign-in link"}
      </Button>
      <p className="text-xs text-ink-muted leading-relaxed">
        We&rsquo;ll send a one-time link valid for 60 minutes. No password is required.
      </p>
    </form>
  );
}
