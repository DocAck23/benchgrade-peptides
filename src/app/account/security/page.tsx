import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";
import { SetPasswordForm } from "@/components/account/SetPasswordForm";
import { MarketingPreferences } from "@/components/account/MarketingPreferences";
import { getMyMarketingState } from "@/app/actions/account";

export const metadata: Metadata = {
  title: "Security",
  description: "Set or change your account password.",
  robots: { index: false, follow: false },
};

export default async function SecurityPage() {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect("/login?next=/account/security");

  // Supabase doesn't expose a single "has password" flag — we infer from
  // app_metadata.providers (set when password is registered with the user).
  // A magic-link-only user has providers = ["email"] but no password set;
  // once they call updateUser({ password }) the user gets a password
  // credential associated. Best-effort proxy: treat last_sign_in_at via
  // password vs otp as the signal — Supabase records this in
  // user_metadata? Actually safer to just always show a "set / change"
  // UX without trying to detect prior state.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const firstName =
    typeof meta.first_name === "string" && meta.first_name.trim()
      ? meta.first_name.trim()
      : user.email?.split("@")[0] ?? "";

  return (
    <article className="space-y-10 max-w-2xl">
      <header>
        <div className="font-display uppercase text-[12px] tracking-[0.18em] text-ink-muted">
          Account · Security
        </div>
        <h1 className="mt-3 font-display text-3xl lg:text-4xl text-ink leading-tight">
          Set a password, {firstName}.
        </h1>
        <p className="mt-3 text-sm text-ink-soft leading-relaxed max-w-prose">
          Magic links work for sign-in, but if you&rsquo;d rather sign in with a password
          on shared or returning devices, set one here. Both flows stay live for
          your account — you can keep using magic links any time.
        </p>
      </header>

      <SetPasswordForm email={user.email ?? ""} />

      <MarketingPreferences
        email={user.email ?? ""}
        initialSubscribed={(await getMyMarketingState()).subscribed}
      />

      <section className="border rule bg-paper-soft p-5">
        <div className="label-eyebrow text-ink-muted mb-2">Tips</div>
        <ul className="text-xs text-ink-soft space-y-2 leading-relaxed list-disc pl-5">
          <li>
            Use a passphrase — three or four random words is much stronger than
            a short password with symbols.
          </li>
          <li>
            Don&rsquo;t reuse this password from another site. A password manager
            (1Password, Bitwarden, browser-built-in) makes per-site passwords easy.
          </li>
          <li>
            If you forget it, request a magic link from{" "}
            <a href="/login" className="text-gold-dark underline">
              /login
            </a>{" "}
            and reset it from this page once signed in.
          </li>
        </ul>
      </section>
    </article>
  );
}
