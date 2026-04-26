"use client";

import { useState, useRef, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { sendCustomerMessage } from "@/app/actions/messaging";

/**
 * <MessageComposer/> — client component (Sprint 3 Wave B2).
 *
 * Single textarea + send button. 2000-char hard cap (enforced via
 * `maxLength`); counter shown at 1800+. Sends via the
 * `sendCustomerMessage` server action (Wave B1). On success: clears,
 * refocuses, calls router.refresh() so the server-rendered thread picks up
 * the new message immediately. Cmd/Ctrl+Enter submits.
 */

const MAX_CHARS = 2000;
const COUNTER_THRESHOLD = 1800;

export function MessageComposer() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSending, setIsSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const trimmed = body.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_CHARS && !isSending;

  async function submit() {
    if (!canSend) return;
    setError(null);
    setIsSending(true);
    try {
      const res = await sendCustomerMessage(trimmed);
      if (!res.ok) {
        setError(res.error ?? "Couldn't send. Try again in a moment.");
        return;
      }
      setBody("");
      startTransition(() => router.refresh());
      // refocus for the next message
      window.setTimeout(() => ref.current?.focus(), 0);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setIsSending(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void submit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  }

  const showCounter = body.length >= COUNTER_THRESHOLD;
  const remaining = MAX_CHARS - body.length;
  const sending = isSending || isPending;

  return (
    <form
      onSubmit={onSubmit}
      className="border rule bg-paper p-4 space-y-3"
      data-testid="message-composer"
    >
      {error && (
        <p
          role="alert"
          className="text-xs text-wine-deep border rule bg-paper-soft px-3 py-2"
          data-testid="composer-error"
        >
          {error}
        </p>
      )}

      <label htmlFor="message-composer-body" className="sr-only">
        Message
      </label>
      <textarea
        ref={ref}
        id="message-composer-body"
        aria-label="Message"
        placeholder="Write a message…"
        value={body}
        maxLength={MAX_CHARS}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        disabled={sending}
        className="block w-full resize-y bg-paper text-ink text-sm border rule p-3 focus:outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60"
        data-testid="composer-textarea"
      />

      <div className="flex items-center justify-between gap-3">
        <span
          className="text-[11px] font-mono-data text-ink-muted"
          aria-live="polite"
        >
          {showCounter ? `${remaining} characters left` : "Cmd+Enter to send"}
        </span>
        <button
          type="submit"
          disabled={!canSend}
          className="inline-flex items-center justify-center h-11 px-6 bg-wine text-paper border border-gold font-display uppercase text-[12px] tracking-[0.14em] hover:bg-wine-deep hover:border-gold-light transition-colors duration-200 ease-out disabled:opacity-60 disabled:cursor-not-allowed"
          data-testid="composer-send"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
