import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { listCouponsAdmin } from "@/app/actions/coupons-admin";
import { formatPrice } from "@/lib/utils";
import { CouponCreateForm } from "./CouponCreateForm";
import { CouponRowActions } from "./CouponRowActions";

export const metadata: Metadata = {
  title: "Coupons · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCouponsPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const res = await listCouponsAdmin();
  const rows = res.ok ? res.rows ?? [] : [];

  return (
    <article className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <div className="flex items-baseline justify-between mb-8">
        <div>
          <div className="label-eyebrow text-ink-muted mb-2">Admin</div>
          <h1 className="font-display text-4xl text-ink">Coupons</h1>
        </div>
        <a href="/admin" className="text-sm text-teal hover:underline">
          ← Back to orders
        </a>
      </div>

      <section className="mb-12">
        <h2 className="label-eyebrow text-ink-muted mb-3">Create new code</h2>
        <CouponCreateForm />
      </section>

      <section>
        <h2 className="label-eyebrow text-ink-muted mb-3">
          Active &amp; historical · {rows.length}
        </h2>
        {rows.length === 0 ? (
          <div className="border rule bg-paper-soft p-6 text-sm text-ink-muted">
            No coupons yet. Create one above.
          </div>
        ) : (
          <div className="overflow-x-auto border rule bg-paper">
            <table className="w-full text-sm">
              <thead className="border-b rule bg-paper-soft">
                <tr>
                  <Th>Code</Th>
                  <Th>Discount</Th>
                  <Th>Min</Th>
                  <Th>Window</Th>
                  <Th>Limits</Th>
                  <Th>Used</Th>
                  <Th>Total off</Th>
                  <Th>Note</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody className="divide-y rule">
                {rows.map((c) => {
                  const expired =
                    c.valid_until !== null && new Date(c.valid_until) < new Date();
                  const exhausted =
                    c.max_redemptions !== null &&
                    c.redemptions_used >= c.max_redemptions;
                  const status = expired
                    ? "expired"
                    : exhausted
                      ? "exhausted"
                      : "active";
                  return (
                    <tr key={c.code} className="hover:bg-paper-soft">
                      <Td>
                        <span className="font-mono-data text-ink uppercase">
                          {c.code}
                        </span>
                        <span
                          className={`ml-2 inline-block px-2 py-0.5 text-[10px] font-mono-data uppercase ${
                            status === "active"
                              ? "bg-teal/10 text-teal"
                              : "bg-ink-muted/20 text-ink-muted"
                          }`}
                        >
                          {status}
                        </span>
                      </Td>
                      <Td>
                        {c.percent_off !== null
                          ? `${c.percent_off}%`
                          : c.flat_off_cents !== null
                            ? formatPrice(c.flat_off_cents)
                            : "—"}
                      </Td>
                      <Td>
                        {c.min_subtotal_cents > 0
                          ? formatPrice(c.min_subtotal_cents)
                          : "—"}
                      </Td>
                      <Td>
                        <div className="text-xs text-ink-muted whitespace-nowrap">
                          {c.valid_from ? new Date(c.valid_from).toLocaleDateString() : "—"}
                          {" → "}
                          {c.valid_until
                            ? new Date(c.valid_until).toLocaleDateString()
                            : "∞"}
                        </div>
                      </Td>
                      <Td>
                        <div className="text-xs whitespace-nowrap">
                          {c.max_redemptions ?? "∞"} total · {c.max_per_email}/email
                        </div>
                      </Td>
                      <Td>
                        <span className="font-mono-data">{c.redemptions_used}</span>
                      </Td>
                      <Td>
                        <span className="font-mono-data">
                          −{formatPrice(c.total_discount_cents_applied)}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-xs text-ink-muted">
                          {c.note ?? "—"}
                        </span>
                      </Td>
                      <Td>
                        <CouponRowActions code={c.code} status={status} />
                      </Td>
                    </tr>
                  );
                })}
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
