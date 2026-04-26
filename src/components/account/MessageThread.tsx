"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  composeMessageHtml,
  formatThreadTimestamp,
} from "@/lib/messaging/format";
import { markMessagesRead } from "@/app/actions/messaging";
import type { MessageRow } from "@/lib/supabase/types";

/**
 * <MessageThread/> — client component (Sprint 3 Wave B2).
 *
 * Renders the customer's persistent thread:
 *   - Server-rendered initial messages from props.
 *   - Polls /api/messaging/poll?since=<latest-iso> every `pollIntervalMs`
 *     (default 30s).
 *   - Auto-scrolls to the latest message when new ones arrive.
 *   - When an admin message scrolls into the viewport (IntersectionObserver),
 *     fires markMessagesRead([ids]) once per id.
 *   - aria-live="polite" announces new arrivals to screen readers.
 *   - Customer bubbles right-aligned (paper-soft); admin bubbles left-aligned
 *     (gold-on-paper) with gold avatar dot for authority signal.
 *   - Renders bodies through composeMessageHtml() (escapes + line→br).
 */

interface MessageThreadProps {
  /** customer's auth user id — included by the poll endpoint via cookie auth. */
  customerUserId: string;
  initialMessages: MessageRow[];
  pollIntervalMs?: number;
}

interface PollResponse {
  ok: boolean;
  messages?: MessageRow[];
  error?: string;
}

const DEFAULT_POLL_MS = 30_000;

function dedupeAppend(existing: MessageRow[], incoming: MessageRow[]): MessageRow[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((m) => m.id));
  const merged = existing.slice();
  for (const m of incoming) {
    if (!seen.has(m.id)) {
      merged.push(m);
      seen.add(m.id);
    }
  }
  // Stable sort by created_at ascending.
  merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return merged;
}

export function MessageThread({
  customerUserId,
  initialMessages,
  pollIntervalMs = DEFAULT_POLL_MS,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastCountRef = useRef<number>(initialMessages.length);
  const markedReadRef = useRef<Set<string>>(new Set());

  // ---- Poll loop ----
  const poll = useCallback(async () => {
    const since =
      messages.length > 0
        ? messages[messages.length - 1].created_at
        : "";
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    try {
      const res = await fetch(`/api/messaging/poll${qs}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as PollResponse;
      if (!json.ok || !json.messages || json.messages.length === 0) return;
      setMessages((prev) => dedupeAppend(prev, json.messages ?? []));
    } catch {
      // Silent — next tick will retry.
    }
  }, [messages]);

  useEffect(() => {
    if (pollIntervalMs <= 0) return;
    const id = window.setInterval(() => {
      void poll();
    }, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [poll, pollIntervalMs]);

  // ---- Auto-scroll on new messages ----
  useEffect(() => {
    if (messages.length > lastCountRef.current) {
      const el = scrollRef.current;
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    }
    lastCountRef.current = messages.length;
  }, [messages.length]);

  // ---- Mark-read on visible (admin messages only) ----
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const root = scrollRef.current ?? null;
    const observer = new IntersectionObserver(
      (entries) => {
        const newlyVisible: string[] = [];
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.messageId;
          if (!id) continue;
          if (markedReadRef.current.has(id)) continue;
          markedReadRef.current.add(id);
          newlyVisible.push(id);
        }
        if (newlyVisible.length > 0) {
          void markMessagesRead(newlyVisible).catch(() => {
            /* swallow — best-effort */
          });
        }
      },
      { root, threshold: 0.5 }
    );
    const nodes = (root ?? document).querySelectorAll<HTMLElement>(
      '[data-sender="admin"][data-read="false"]'
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div
        className="border rule bg-paper p-8 text-center"
        data-testid="message-thread-empty"
      >
        <p className="font-editorial italic text-lg text-ink-soft">
          Send a message to start the conversation.
        </p>
        <p className="text-sm text-ink-muted mt-2">
          We typically reply within one business day.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-label="Message thread"
      data-testid="message-thread"
      data-customer-user-id={customerUserId}
      className="max-h-[60vh] overflow-y-auto border rule bg-paper p-4 space-y-3"
    >
      {messages.map((m) => {
        const isAdmin = m.sender === "admin";
        return (
          <div
            key={m.id}
            data-message-id={m.id}
            data-sender={m.sender}
            data-read={m.read_at ? "true" : "false"}
            data-testid="message-bubble"
            className={
              isAdmin
                ? "flex items-start gap-3 justify-start"
                : "flex items-start gap-3 justify-end"
            }
          >
            {isAdmin && (
              <span
                aria-hidden
                className="shrink-0 h-8 w-8 rounded-full bg-gold border border-gold-dark flex items-center justify-center font-display uppercase text-[10px] tracking-[0.14em] text-wine"
              >
                BG
              </span>
            )}
            <div
              className={
                isAdmin
                  ? "max-w-[80%] border rule bg-paper-soft px-4 py-3"
                  : "max-w-[80%] border rule bg-paper-soft px-4 py-3 text-right"
              }
              style={
                isAdmin
                  ? { borderColor: "var(--color-gold, currentColor)" }
                  : undefined
              }
            >
              <p
                className="text-sm text-ink whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{
                  __html: composeMessageHtml(m.body),
                }}
              />
              <p className="font-mono-data text-[10px] text-ink-muted mt-2 uppercase tracking-wider">
                {isAdmin ? "Bench Grade · " : "You · "}
                {formatThreadTimestamp(m.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
