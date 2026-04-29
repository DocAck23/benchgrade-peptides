import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { LocalTime } from "@/components/admin/LocalTime";
import { isAdmin } from "@/lib/admin/auth";
import {
  getAffiliateDetailAdmin,
  getAffiliateW9SignedUrlAdmin,
} from "@/app/actions/affiliate-portal";

export const metadata: Metadata = {
  title: "Affiliate detail · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminAffiliateDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { userId } = await params;
  const res = await getAffiliateDetailAdmin(userId);
  if (!res.ok || !res.detail) notFound();
  const detail = res.detail;

  // Mint the signed URL server-side. 5-minute TTL — if the page is left
  // open longer the admin re-loads to get a fresh link.
  let w9Url: string | null = null;
  if (detail.w9) {
    const u = await getAffiliateW9SignedUrlAdmin(userId);
    w9Url = u.ok ? u.url ?? null : null;
  }

  return (
    <article className="max-w-5xl mx-auto px-6 lg:px-10 py-12 space-y-10">
      <header className="space-y-2">
        <div className="label-eyebrow text-ink-muted">Admin · Affiliate</div>
        <h1 className="font-display text-3xl text-ink">
          {detail.email ?? detail.user_id}
        </h1>
        <Link
          href="/admin/affiliates"
          className="text-sm text-teal hover:underline"
        >
          ← All affiliates
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="label-eyebrow text-ink-muted">1099 agreement</h2>
        {detail.agreement ? (
          <div className="border rule bg-paper">
            <div className="border-b rule bg-paper-soft px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Meta label="Signed name" value={detail.agreement.signed_name} />
              <Meta
                label="Signed at"
                value={<LocalTime iso={detail.agreement.signed_at} />}
              />
              <Meta label="Version" value={detail.agreement.agreement_version} />
              <Meta label="IP" value={detail.agreement.ip ?? "—"} />
            </div>
            <div
              className="prose-agreement px-6 py-6 text-sm text-ink"
              // Snapshot HTML is authored by us in agreement-1099-v1.ts —
              // not user input. Safe to render.
              dangerouslySetInnerHTML={{ __html: detail.agreement.agreement_html }}
            />
          </div>
        ) : (
          <div className="border rule bg-paper-soft p-6 text-sm text-ink-muted">
            Not signed yet.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="label-eyebrow text-ink-muted">W9</h2>
        {detail.w9 ? (
          <div className="border rule bg-paper px-5 py-4 flex items-center justify-between gap-4">
            <div className="text-sm">
              <div className="font-mono-data text-ink">
                {detail.w9.original_filename}
              </div>
              <div className="text-xs text-ink-muted mt-1">
                {(detail.w9.byte_size / 1024).toFixed(1)} KB · uploaded{" "}
                <LocalTime iso={detail.w9.uploaded_at} />
              </div>
            </div>
            {w9Url ? (
              <a
                href={w9Url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-5 bg-ink text-paper text-xs uppercase tracking-[0.1em] hover:bg-gold inline-flex items-center"
              >
                Download (5 min)
              </a>
            ) : (
              <span className="text-xs text-danger">URL unavailable</span>
            )}
          </div>
        ) : (
          <div className="border rule bg-paper-soft p-6 text-sm text-ink-muted">
            No W9 on file.
          </div>
        )}
      </section>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
        {label}
      </div>
      <div className="font-mono-data text-ink truncate">{value}</div>
    </div>
  );
}
