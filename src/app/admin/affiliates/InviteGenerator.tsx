"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateAffiliateInvite } from "@/app/actions/affiliate-portal";

export function InviteGenerator() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [expires, setExpires] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUrl(null);
    setCopied(false);
    const days = expires ? Number.parseInt(expires, 10) : null;
    start(async () => {
      const res = await generateAffiliateInvite({
        note: note.trim() || null,
        expiresInDays: days && Number.isFinite(days) ? days : null,
      });
      if (!res.ok || !res.url) {
        setError(res.error ?? "Could not create invite.");
        return;
      }
      setUrl(res.url);
      setNote("");
      setExpires("");
      router.refresh();
    });
  };

  const onCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="border rule bg-paper p-5 grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      <label className="flex flex-col gap-1 md:col-span-2">
        <span className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
          Note (internal label)
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Spring 2026 cohort"
          maxLength={500}
          className="h-10 px-3 border rule bg-paper text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
          Expires in (days)
        </span>
        <input
          type="number"
          min={1}
          max={365}
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
          placeholder="∞"
          className="h-10 px-3 border rule bg-paper text-sm"
        />
      </label>
      <div className="md:col-span-3 flex items-center justify-between gap-4">
        <div className="text-sm">
          {error ? <span className="text-danger">{error}</span> : null}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-10 px-6 bg-wine text-paper font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep disabled:opacity-60"
        >
          {pending ? "Generating…" : "Generate invite"}
        </button>
      </div>
      {url ? (
        <div className="md:col-span-3 border rule bg-paper-soft p-4 flex items-center justify-between gap-4">
          <code className="text-xs font-mono-data text-ink truncate">{url}</code>
          <button
            type="button"
            onClick={onCopy}
            className="h-9 px-4 bg-ink text-paper text-xs uppercase tracking-[0.1em] hover:bg-gold shrink-0"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
