"use client";

import { useEffect, useState } from "react";

/**
 * Render an ISO-8601 timestamp formatted in the viewer's local
 * timezone. Server-rendered HTML uses `toLocaleString()` against the
 * runtime's locale (UTC on Vercel), which made every admin date in
 * the dashboard read as a "tomorrow" timestamp for any US-timezone
 * viewer. This component fixes that by deferring the format to the
 * client, where `Intl.DateTimeFormat()` (no options) honors the
 * browser's timezone.
 *
 * The first paint shows `fallback` (default: empty span same width
 * as a typical formatted string) so the layout doesn't shift when
 * the formatted value lands. `suppressHydrationWarning` prevents
 * React from complaining that the server and client text differ —
 * which is exactly what we want.
 */

interface LocalTimeProps {
  iso: string;
  /**
   * Format style. `datetime` shows date + time (default for admin
   * tables); `date` shows date only; `relative` shows "3 minutes ago"
   * for short-lived recency widgets.
   */
  format?: "datetime" | "date" | "relative";
  /**
   * Server-side placeholder. Defaults to a non-breaking space so the
   * cell has height before hydration.
   */
  fallback?: string;
  className?: string;
}

const dtFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return diffSec >= 0 ? "just now" : "in a moment";
  const minutes = Math.round(diffSec / 60);
  if (Math.abs(minutes) < 60)
    return diffSec >= 0 ? `${minutes}m ago` : `in ${-minutes}m`;
  const hours = Math.round(diffSec / 3600);
  if (Math.abs(hours) < 24)
    return diffSec >= 0 ? `${hours}h ago` : `in ${-hours}h`;
  const days = Math.round(diffSec / 86400);
  return diffSec >= 0 ? `${days}d ago` : `in ${-days}d`;
}

export function LocalTime({
  iso,
  format = "datetime",
  fallback = " ",
  className,
}: LocalTimeProps) {
  const [rendered, setRendered] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) {
      setRendered("—");
      return;
    }
    if (format === "relative") {
      setRendered(formatRelative(d));
      return;
    }
    if (format === "date") {
      setRendered(dateFormatter.format(d));
      return;
    }
    setRendered(dtFormatter.format(d));
  }, [iso, format]);

  return (
    <time
      dateTime={iso}
      className={className}
      suppressHydrationWarning
      title={iso}
    >
      {rendered ?? fallback}
    </time>
  );
}
