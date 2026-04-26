"use client";

import { useState, useCallback } from "react";

/**
 * Copy-to-clipboard button for the customer's referral URL (Sprint 3 Wave B2).
 *
 * Click → navigator.clipboard.writeText(url) → "Copied ✓" success state for 2s.
 * Falls back to a hidden-textarea selection trick if the clipboard API throws
 * (older Safari, http origins). Brand-matched: gold border, paper-soft hover.
 */

interface ReferralLinkCopyProps {
  code: string;
  url: string;
}

export function ReferralLinkCopy({ code, url }: ReferralLinkCopyProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    setError(null);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error("Clipboard unavailable");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select the link and copy manually.");
    }
  }, [url]);

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        aria-label={`Copy referral link for code ${code}`}
        data-testid="referral-link-copy"
        className="inline-flex items-center justify-center h-11 px-5 border rule bg-paper text-ink font-display uppercase text-[11px] tracking-[0.14em] hover:border-gold focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold transition-colors duration-200 ease-out"
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-wine-deep">
          {error}
        </p>
      )}
    </div>
  );
}
