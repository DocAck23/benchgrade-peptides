"use client";

import { useState, useTransition } from "react";
import { adminLogin } from "@/app/actions/admin";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const res = await adminLogin(fd);
          if (!res.ok) setError(res.error ?? "Login failed.");
        });
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className="block text-xs text-ink-muted mb-1">Password</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="w-full border rule bg-paper px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:border-ink"
        />
      </label>
      {error && <div className="text-sm text-oxblood">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center w-full h-11 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-teal transition-colors disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
