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
 *
 * `?order_id=<uuid>` query: when present, validated against the caller's
 * own orders and threaded into <MessageComposer/> so the next message
 * carries the order tag (and the prompt prefills with `Re: BGP-XXXX —`).
 * Invalid or non-owned IDs are silently dropped — never echoed into the
 * page so the parameter can't be used as a phishing reflection vector.
 */

export const metadata: Metadata = {
  title: "Messages · Bench Grade Peptides",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/messages" },
};

const ORDER_ID_RE = /^[A-Za-z0-9_-]{1,40}$/u;

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string | string[] }>;
}) {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect("/login?next=/account/messages");

  const initialMessages = await listMyMessages();

  // Validate ?order_id: must match the slug shape AND belong to the
  // caller. Anything else is dropped to null so the composer falls
  // back to a generic compose state.
  const sp = await searchParams;
  const rawOrderId = Array.isArray(sp.order_id) ? sp.order_id[0] : sp.order_id;
  let scopedOrderId: string | null = null;
  let scopedOrderShort: string | null = null;
  if (rawOrderId && ORDER_ID_RE.test(rawOrderId)) {
    const { data } = await supa
      .from("orders")
      .select("order_id")
      .eq("order_id", rawOrderId)
      .eq("customer_user_id", user.id)
      .maybeSingle();
    if (data?.order_id) {
      scopedOrderId = data.order_id;
      scopedOrderShort = `BGP-${data.order_id.slice(0, 8).toUpperCase()}`;
    }
  }

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
        {scopedOrderShort && (
          <p
            className="text-xs text-ink border rule bg-paper-soft px-3 py-2 inline-block mt-2"
            data-testid="message-scope-banner"
          >
            About order <span className="font-mono-data">{scopedOrderShort}</span> — your message will be tagged for the team.
          </p>
        )}
      </header>

      <MessageThread
        customerUserId={user.id}
        initialMessages={initialMessages}
      />

      <div className="sticky bottom-0 bg-paper-soft/95 backdrop-blur-sm pt-2 pb-4 -mx-2 px-2 md:static md:bg-transparent md:backdrop-blur-none md:p-0 md:m-0">
        <MessageComposer
          orderId={scopedOrderId}
          initialBody={scopedOrderShort ? `Re: order ${scopedOrderShort} — ` : ""}
        />
      </div>
    </main>
  );
}
