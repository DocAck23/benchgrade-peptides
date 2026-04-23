"use client";

import { useTransition } from "react";
import { adminLogout } from "@/app/actions/admin";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => adminLogout())}
      disabled={pending}
      className="text-xs text-ink-muted hover:text-ink"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
