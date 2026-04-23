import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Admin login",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <article className="max-w-sm mx-auto px-6 py-20">
      <div className="label-eyebrow text-ink-muted mb-2">Admin</div>
      <h1 className="font-display text-3xl text-ink mb-8">Sign in</h1>
      <LoginForm />
    </article>
  );
}
