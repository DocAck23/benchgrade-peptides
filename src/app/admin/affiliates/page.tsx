import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { listAffiliatesAdmin } from "@/app/actions/affiliate-portal";
import { InviteGenerator } from "./InviteGenerator";

export const metadata: Metadata = {
  title: "Affiliates · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminAffiliatesPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const res = await listAffiliatesAdmin();
  const rows = res.ok ? res.rows ?? [] : [];

  return (
    <article className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <div className="label-eyebrow text-ink-muted mb-2">Admin</div>
          <h1 className="font-display text-4xl text-ink">Affiliates</h1>
          <p className="mt-2 text-sm text-ink-soft max-w-xl">
            Generate one-time invite links and review signed agreements + W9s.
          </p>
        </div>
        <a href="/admin" className="text-sm text-teal hover:underline">
          ← Back to orders
        </a>
      </div>

      <section className="mb-12">
        <h2 className="label-eyebrow text-ink-muted mb-3">New invite</h2>
        <InviteGenerator />
      </section>

      <section>
        <h2 className="label-eyebrow text-ink-muted mb-3">
          Onboarded · {rows.length}
        </h2>
        {res.ok === false ? (
          <div className="border rule bg-paper-soft p-6 text-sm text-danger">
            {res.error ?? "Failed to load."}
          </div>
        ) : rows.length === 0 ? (
          <div className="border rule bg-paper-soft p-6 text-sm text-ink-muted">
            No affiliates yet. Generate an invite above.
          </div>
        ) : (
          <div className="overflow-x-auto border rule bg-paper">
            <table className="w-full text-sm">
              <thead className="border-b rule bg-paper-soft">
                <tr>
                  <Th>Email</Th>
                  <Th>Invite</Th>
                  <Th>Agreement</Th>
                  <Th>W9</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody className="divide-y rule">
                {rows.map((r) => (
                  <tr key={r.user_id} className="hover:bg-paper-soft">
                    <Td>
                      <span className="font-mono-data text-ink">
                        {r.email ?? r.user_id.slice(0, 8) + "…"}
                      </span>
                    </Td>
                    <Td>
                      <Pill on={!!r.invite_consumed_at}>
                        {r.invite_consumed_at ? "consumed" : "—"}
                      </Pill>
                    </Td>
                    <Td>
                      <Pill on={!!r.agreement_signed_at}>
                        {r.agreement_signed_at ? "signed" : "pending"}
                      </Pill>
                    </Td>
                    <Td>
                      <Pill on={!!r.w9_uploaded_at}>
                        {r.w9_uploaded_at ? "uploaded" : "pending"}
                      </Pill>
                    </Td>
                    <Td>
                      <Link
                        href={`/admin/affiliates/${r.user_id}`}
                        className="text-xs text-teal hover:underline"
                      >
                        Open →
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 label-eyebrow text-ink-muted font-normal">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function Pill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] font-mono-data uppercase ${
        on ? "bg-teal/10 text-teal" : "bg-ink-muted/20 text-ink-muted"
      }`}
    >
      {children}
    </span>
  );
}
