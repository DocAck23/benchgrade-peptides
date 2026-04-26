// Pure-render tests for <MessageComposer>. Mocks react hooks +
// useRouter + the sendCustomerMessage server-action module, then invokes
// the component as a function and walks the tree.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement, ReactNode } from "react";

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

let bodyState = "";
let isSendingState = false;
const useStateMock = vi.fn();

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: (initial: unknown) => {
      const seq = (globalThis as unknown as { __seq: number }).__seq ?? 0;
      (globalThis as unknown as { __seq: number }).__seq = seq + 1;
      // Order in component: body, error, isSending
      if (seq % 3 === 0) return [bodyState, vi.fn()];
      if (seq % 3 === 1) return [null, vi.fn()];
      return [isSendingState, vi.fn()];
    },
    useTransition: () => [false, (cb: () => void) => cb()],
    useRef: () => ({ current: null }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/actions/messaging", () => ({
  sendCustomerMessage: vi.fn(async () => ({ ok: true, message_id: "x" })),
  markMessagesRead: vi.fn(async () => ({ ok: true, updated: 0 })),
  listMyMessages: vi.fn(async () => []),
}));

import { MessageComposer } from "../MessageComposer";

beforeEach(() => {
  (globalThis as unknown as { __seq: number }).__seq = 0;
  bodyState = "";
  isSendingState = false;
  useStateMock.mockClear();
});

describe("<MessageComposer>", () => {
  it("C-MSG-2: renders a textarea with aria-label='Message' and a Send button", () => {
    const tree = MessageComposer();
    const tas = findAll(tree, (el) => el.type === "textarea");
    expect(tas.length).toBe(1);
    expect((tas[0].props as Record<string, unknown>)["aria-label"]).toBe("Message");
    expect((tas[0].props as Record<string, unknown>).maxLength).toBe(2000);

    const buttons = findAll(tree, (el) => el.type === "button");
    expect(buttons.length).toBe(1);
    const sendBtn = buttons[0];
    expect(textOf(sendBtn)).toContain("Send");
    // Empty body → disabled.
    expect((sendBtn.props as Record<string, unknown>).disabled).toBe(true);
  });

  it("C-MSG-2: when body has content, send button enables", () => {
    bodyState = "hello";
    (globalThis as unknown as { __seq: number }).__seq = 0;
    const tree = MessageComposer();
    const buttons = findAll(tree, (el) => el.type === "button");
    expect((buttons[0].props as Record<string, unknown>).disabled).toBe(false);
  });

  it("C-MSG-2: while sending, button shows Sending… and is disabled", () => {
    bodyState = "hello";
    isSendingState = true;
    (globalThis as unknown as { __seq: number }).__seq = 0;
    const tree = MessageComposer();
    const buttons = findAll(tree, (el) => el.type === "button");
    expect(textOf(buttons[0])).toContain("Sending");
    expect((buttons[0].props as Record<string, unknown>).disabled).toBe(true);
  });
});
