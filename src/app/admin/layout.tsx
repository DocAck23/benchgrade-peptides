import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin } from "@/lib/admin/auth";
import { LogoutButton } from "./LogoutButton";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const SECTIONS: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/visitors", label: "Visitors" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/affiliates", label: "Affiliates" },
  { href: "/admin/reconciliation", label: "Reconciliation" },
  { href: "/admin/email-preview", label: "Email previews" },
  { href: "/admin/briefs", label: "Briefs" },
  { href: "/admin/launch-status", label: "Launch status" },
  { href: "/admin/launch-test-plan", label: "Test plan" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authed = await isAdmin();

  // Don't render the admin nav on the login page or for unauth'd
  // visitors. The login page is a top-level route under /admin/login;
  // each admin page already redirects to login when not authed, so
  // here we just render the children unwrapped.
  if (!authed) {
    return <>{children}</>;
  }

  return (
    <div className="bg-paper min-h-screen">
      <nav className="sticky top-0 z-40 border-b rule bg-paper/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-12 flex items-center justify-between gap-6">
          <div className="flex items-center gap-1 overflow-x-auto">
            <span className="text-xs label-eyebrow text-ink-muted mr-3 shrink-0">
              Admin
            </span>
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="text-xs px-3 h-8 inline-flex items-center text-ink-soft hover:text-ink hover:bg-paper-soft border-l rule first:border-l-0"
              >
                {s.label}
              </Link>
            ))}
          </div>
          <LogoutButton />
        </div>
      </nav>
      {children}
    </div>
  );
}
