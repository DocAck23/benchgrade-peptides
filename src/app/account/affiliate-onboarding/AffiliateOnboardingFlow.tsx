"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  signAffiliateAgreement,
  uploadAffiliateW9,
} from "@/app/actions/affiliate-portal";

type Status = {
  agreement_signed: boolean;
  agreement_signed_name: string | null;
  agreement_signed_at: string | null;
  w9_uploaded: boolean;
  w9_filename: string | null;
};

export function AffiliateOnboardingFlow({
  initialStatus,
  agreementHtml,
}: {
  initialStatus: Status;
  agreementHtml: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);

  return (
    <div className="space-y-12">
      <Step
        number={1}
        title="Read the agreement"
        done={status.agreement_signed}
        active={!status.agreement_signed}
      >
        <div
          className="prose-agreement border rule bg-paper-soft p-6 text-sm text-ink max-h-[420px] overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: agreementHtml }}
        />
      </Step>

      <Step
        number={2}
        title="Sign"
        done={status.agreement_signed}
        active={!status.agreement_signed}
      >
        {status.agreement_signed ? (
          <SignedReceipt
            name={status.agreement_signed_name ?? ""}
            at={status.agreement_signed_at ?? ""}
          />
        ) : (
          <SignForm
            onSigned={(name, at) => {
              setStatus((s) => ({
                ...s,
                agreement_signed: true,
                agreement_signed_name: name,
                agreement_signed_at: at,
              }));
              router.refresh();
            }}
          />
        )}
      </Step>

      <Step
        number={3}
        title="Upload your W9"
        done={status.w9_uploaded}
        active={status.agreement_signed && !status.w9_uploaded}
        locked={!status.agreement_signed}
      >
        {status.w9_uploaded ? (
          <div className="border rule bg-paper p-5 text-sm">
            <div className="font-mono-data text-ink">{status.w9_filename}</div>
            <div className="mt-1 text-xs text-ink-muted">
              On file. You can re-upload below if you need to replace it.
            </div>
            <div className="mt-4">
              <UploadForm
                onUploaded={(filename) => {
                  setStatus((s) => ({
                    ...s,
                    w9_uploaded: true,
                    w9_filename: filename,
                  }));
                  router.refresh();
                }}
              />
            </div>
          </div>
        ) : status.agreement_signed ? (
          <UploadForm
            onUploaded={(filename) => {
              setStatus((s) => ({
                ...s,
                w9_uploaded: true,
                w9_filename: filename,
              }));
              router.refresh();
            }}
          />
        ) : (
          <p className="text-sm text-ink-muted">
            Sign the agreement first to unlock W9 upload.
          </p>
        )}
      </Step>

      {status.agreement_signed && status.w9_uploaded ? (
        <div className="border rule bg-teal/10 p-5 text-sm text-ink">
          Onboarding complete. Your dashboard is ready at{" "}
          <a href="/account/affiliate" className="text-teal underline">
            /account/affiliate
          </a>
          .
        </div>
      ) : null}
    </div>
  );
}

function Step({
  number,
  title,
  done,
  active,
  locked,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  active?: boolean;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header className="flex items-baseline gap-3">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-mono-data text-xs ${
            done
              ? "bg-teal text-paper"
              : active
                ? "bg-wine text-paper"
                : "bg-paper-soft text-ink-muted border rule"
          }`}
        >
          {done ? "✓" : number}
        </span>
        <h2 className="font-display uppercase text-[12px] tracking-[0.16em] text-ink">
          {title}
        </h2>
        {locked ? (
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
            Locked
          </span>
        ) : null}
      </header>
      <div className={locked ? "opacity-50" : ""}>{children}</div>
    </section>
  );
}

function SignForm({
  onSigned,
}: {
  onSigned: (name: string, at: string) => void;
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await signAffiliateAgreement({ signed_name: name });
          if (!res.ok) {
            setError(res.error ?? "Could not record signature.");
            return;
          }
          onSigned(name, new Date().toISOString());
        });
      }}
      className="border rule bg-paper p-5 space-y-4"
    >
      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
          Type your full legal name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={200}
          autoComplete="name"
          className="mt-1 w-full h-11 px-3 border rule bg-paper text-base font-editorial italic"
          placeholder="Jane Q. Researcher"
        />
      </label>
      <p className="text-xs text-ink-muted leading-relaxed">
        By clicking &ldquo;Sign,&rdquo; you agree your typed name has the
        same legal effect as a handwritten signature.
      </p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-danger">{error}</span>
        <button
          type="submit"
          disabled={pending || name.trim().length < 2}
          className="h-11 px-6 bg-wine text-paper font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep disabled:opacity-60"
        >
          {pending ? "Recording…" : "Sign"}
        </button>
      </div>
    </form>
  );
}

function SignedReceipt({ name, at }: { name: string; at: string }) {
  return (
    <div className="border rule bg-paper p-5 text-sm">
      <div className="text-ink">
        Signed by{" "}
        <span className="font-editorial italic text-ink">{name}</span>
      </div>
      <div className="text-xs text-ink-muted mt-1">
        {at ? new Date(at).toLocaleString() : ""}
      </div>
    </div>
  );
}

function UploadForm({
  onUploaded,
}: {
  onUploaded: (filename: string) => void;
}) {
  const [pending, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!file) {
          setError("Choose a PDF first.");
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          setError("File exceeds 5 MB.");
          return;
        }
        if (
          file.type !== "application/pdf" &&
          !file.name.toLowerCase().endsWith(".pdf")
        ) {
          setError("PDF only.");
          return;
        }
        const fd = new FormData();
        fd.append("file", file);
        start(async () => {
          const res = await uploadAffiliateW9(fd);
          if (!res.ok) {
            setError(res.error ?? "Upload failed.");
            return;
          }
          onUploaded(file.name);
          setFile(null);
        });
      }}
      className="border rule bg-paper p-5 space-y-4"
    >
      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
          W9 PDF (≤ 5 MB)
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm"
        />
      </label>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-danger">{error}</span>
        <button
          type="submit"
          disabled={pending || !file}
          className="h-11 px-6 bg-wine text-paper font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Upload W9"}
        </button>
      </div>
    </form>
  );
}
