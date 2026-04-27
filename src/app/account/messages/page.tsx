import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";
import { listMyMessages } from "@/app/actions/messaging";
import { MessageThread } from "@/components/account/MessageThread";
import { MessageComposer } from "@/components/account/MessageComposer";

/**
 * Customer portal — Messages (Sprint 3 Wave C).
 *
 * Server component. Auth is enforced by the parent /account layout, but we
 * re-fetch the user here because we need the id to thread through to
 * <MessageThread/>. Initial messages are loaded via the `listMyMessages`
 * server action (Wave B1) which is RLS-scoped to the caller; the client
 * thread component then polls for live updates.
 */

export const metadata: Metadata = {
  title: "Messages · Bench Grade Peptides",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/messages" },
};

export default async function MessagesPage() {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect("/login?next=/account/messages");

  const initialMessages = await listMyMessages();

  return (
    <main className="max-w-3xl mx-auto py-12 lg:py-16 space-y-8">
      <header className="space-y-2">
        <p className="font-display uppercase text-[11px] tracking-[0.18em] text-gold-dark">
          MESSAGES
        </p>
        <h1
          className="font-editorial italic text-3xl lg:text-4xl text-ink leading-tight"
          style={{ fontFamily: "var(--font-editorial)" }}
        >
          How can we help?
        </h1>
        <p className="text-sm text-ink-soft max-w-prose">
          Order questions or lab notes — we typically reply within one
          business day.
        </p>
      </header>

      <MessageThread
        customerUserId={user.id}
        initialMessages={initialMessages}
      />

      <div className="sticky bottom-0 bg-paper-soft/95 backdrop-blur-sm pt-2 pb-4 -mx-2 px-2 md:static md:bg-transparent md:backdrop-blur-none md:p-0 md:m-0">
        <MessageComposer />
      </div>
    </main>
  );
}
