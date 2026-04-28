// Pure-render tests for <MessageThread>. Stubs effects & hooks so the
// component is invoked as a function returning a tree we walk for shape:
// chronological order, customer/admin alignment, empty state, mark-read
// data-attrs.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { MessageRow } from "@/lib/supabase/types";

type AnyEl = ReactElement<Record<string, unknown>>;

function isElement(node: ReactNode): node is AnyEl {
  return typeof node === "object" && node !== null && "props" in (node as object);
}
function findAll(node: ReactNode, p: (el: AnyEl) => boolean): AnyEl[] {
  const hits: AnyEl[] = [];
  const walk = (n: ReactNode) => {
    if (!isElement(n)) return;
    if (p(n)) hits.push(n);
    const c = (n.props as { children?: ReactNode }).children;
    if (Array.isArray(c)) c.forEach((x) => walk(x as ReactNode));
    else if (c !== undefined) walk(c as ReactNode);
  };
  walk(node);
  return hits;
}
function textOf(node: ReactNode): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((c) => textOf(c as ReactNode)).join(" ");
  if (isElement(node)) {
    const c = (node.props as { children?: ReactNode }).children;
    return textOf(c as ReactNode);
  }
  return "";
}

let messagesState: MessageRow[] = [];

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: (initial: unknown) => {
      // Single useState in MessageThread: messages
      return [messagesState.length > 0 ? messagesState : (initial as MessageRow[]), vi.fn()];
    },
    useEffect: vi.fn(),
    useRef: () => ({ current: null }),
    useCallback: (fn: unknown) => fn,
  };
});

vi.mock("@/app/actions/messaging", () => ({
  sendCustomerMessage: vi.fn(async () => ({ ok: true })),
  markMessagesRead: vi.fn(async () => ({ ok: true, updated: 0 })),
  listMyMessages: vi.fn(async () => []),
}));

import { MessageThread } from "../MessageThread";

function msg(overrides: Partial<MessageRow>): MessageRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    customer_user_id: "cust-1",
    sender: "customer",
    body: "hello",
    order_id: null,
    created_at: "2026-04-25T10:00:00.000Z",
    read_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  messagesState = [];
});

describe("<MessageThread>", () => {
  it("renders empty state when there are no messages", () => {
    const tree = MessageThread({ customerUserId: "u-1", initialMessages: [] });
    expect(textOf(tree)).toContain("Send a message to start the conversation");
  });

  it("C-MSG-1: renders bubbles in chronological order with sender markers", () => {
    messagesState = [
      msg({ id: "m1", sender: "customer", body: "first", created_at: "2026-04-25T10:00:00Z" }),
      msg({ id: "m2", sender: "admin", body: "reply", created_at: "2026-04-25T11:00:00Z" }),
    ];
    const tree = MessageThread({
      customerUserId: "u-1",
      initialMessages: messagesState,
    });
    const bubbles = findAll(
      tree,
      (el) => (el.props as Record<string, unknown>)["data-testid"] === "message-bubble"
    );
    expect(bubbles.length).toBe(2);
    expect((bubbles[0].props as Record<string, unknown>)["data-sender"]).toBe("customer");
    expect((bubbles[1].props as Record<string, unknown>)["data-sender"]).toBe("admin");
    const paras = findAll(tree, (el) => el.type === "p");
    const bodyHtml = paras
      .map((p) => {
        const ds = (p.props as Record<string, unknown>).dangerouslySetInnerHTML as
          | { __html: string }
          | undefined;
        return ds?.__html ?? "";
      })
      .join("|");
    expect(bodyHtml).toContain("first");
    expect(bodyHtml).toContain("reply");
  });

  it("C-MSG-4: admin unread bubble carries data-read='false' (mark-read target)", () => {
    messagesState = [
      msg({ id: "m1", sender: "admin", body: "hi", read_at: null }),
    ];
    const tree = MessageThread({
      customerUserId: "u-1",
      initialMessages: messagesState,
    });
    const bubbles = findAll(
      tree,
      (el) => (el.props as Record<string, unknown>)["data-testid"] === "message-bubble"
    );
    expect((bubbles[0].props as Record<string, unknown>)["data-read"]).toBe("false");
    expect((bubbles[0].props as Record<string, unknown>)["data-message-id"]).toBe("m1");
  });

  it("escapes message body via composeMessageHtml (no raw <script>)", () => {
    messagesState = [msg({ id: "m1", body: "<script>x</script>" })];
    const tree = MessageThread({
      customerUserId: "u-1",
      initialMessages: messagesState,
    });
    // Look for the dangerouslySetInnerHTML rendered <p>.
    const paras = findAll(tree, (el) => el.type === "p");
    const html = paras
      .map((p) => {
        const ds = (p.props as Record<string, unknown>).dangerouslySetInnerHTML as
          | { __html: string }
          | undefined;
        return ds?.__html ?? "";
      })
      .join("\n");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
