"use client";

import { useState } from "react";

/**
 * Click-to-copy wrapper for the payment memo string. Used during
 * reconciliation — admin sees an inbound wire/Zelle/ACH and needs
 * to match it to an order via the BGP-XXXX memo the customer was
 * told to put in the transfer note.
 */
export function CopyMemo({ memo }: { memo: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(memo);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore — clipboard blocked */
        }
      }}
      className="inline-flex items-center gap-2 font-mono-data text-sm text-ink bg-paper-soft border rule px-3 py-1.5 hover:bg-paper transition-colors"
    >
      {memo}
      <span className="text-[10px] text-ink-muted uppercase tracking-wider">
        {copied ? "Copied ✓" : "Copy"}
      </span>
    </button>
  );
}
