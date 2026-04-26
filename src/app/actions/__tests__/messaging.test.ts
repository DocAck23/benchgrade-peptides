import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks. Customer-facing messaging actions use the cookie-scoped client (RLS
// is the authoritative ownership boundary). adminSendMessage uses the
// service-role client. We stub each at the module boundary so the action runs
// in pure userland and we can inspect every call.
// ---------------------------------------------------------------------------

const cookieFrom = vi.fn();
const cookieGetUser = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createServerSupabase: async () => ({
    from: cookieFrom,
    auth: { getUser: cookieGetUser },
  }),
}));

const serviceFrom = vi.fn();
const adminGetUserById = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => ({
    from: serviceFrom,
    auth: { admin: { getUserById: adminGetUserById } },
  }),
}));

const isAdminMock = vi.fn(async () => true);
vi.mock("@/lib/admin/auth", () => ({
  isAdmin: () => isAdminMock(),
}));

const sendMessageNotificationMock =
  vi.fn<(toEmail: string, ctx: unknown) => Promise<{ ok: boolean }>>();
vi.mock("@/lib/email/notifications/send-messaging-emails", () => ({
  sendMessageNotification: (toEmail: string, ctx: unknown) =>
    sendMessageNotificationMock(toEmail, ctx),
}));

import {
  sendCustomerMessage,
  listMyMessages,
  markMessagesRead,
} from "../messaging";
import { adminSendMessage, adminListAllThreads } from "../admin";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const MSG_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  cookieFrom.mockReset();
  cookieGetUser.mockReset();
  serviceFrom.mockReset();
  adminGetUserById.mockReset();
  sendMessageNotificationMock.mockReset();
  sendMessageNotificationMock.mockResolvedValue({ ok: true });
  isAdminMock.mockReset();
  isAdminMock.mockResolvedValue(true);
});

describe("sendCustomerMessage (I-MSG-1)", () => {
  it("inserts a customer-sender row and returns message_id", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    let insertPayload: Record<string, unknown> | null = null;
    cookieFrom.mockImplementation((table: string) => {
      expect(table).toBe("messages");
      return {
        insert: vi.fn((payload: Record<string, unknown>) => {
          insertPayload = payload;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { id: MSG_ID },
                error: null,
              })),
            })),
          };
        }),
      };
    });

    const res = await sendCustomerMessage("Hello team");
    expect(res.ok).toBe(true);
    expect(res.message_id).toBe(MSG_ID);
    expect(insertPayload!.sender).toBe("customer");
    expect(insertPayload!.customer_user_id).toBe(USER_ID);
    expect(insertPayload!.body).toBe("Hello team");
  });

  it("rejects empty body", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    const res = await sendCustomerMessage("");
    expect(res.ok).toBe(false);
    expect(cookieFrom).not.toHaveBeenCalled();
  });

  it("rejects body > 2000 chars", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    const res = await sendCustomerMessage("x".repeat(2001));
    expect(res.ok).toBe(false);
    expect(cookieFrom).not.toHaveBeenCalled();
  });

  it("returns 401-style error when not authenticated", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await sendCustomerMessage("hi");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/auth|sign/i);
  });
});

describe("listMyMessages (I-MSG-3 RLS-trust)", () => {
  it("queries messages filtered to current customer_user_id, ordered ASC", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    const orderFn = vi.fn(async () => ({
      data: [
        {
          id: MSG_ID,
          customer_user_id: USER_ID,
          sender: "customer",
          body: "hello",
          created_at: "2026-01-01T00:00:00Z",
          read_at: null,
        },
      ],
      error: null,
    }));
    cookieFrom.mockImplementation((table: string) => {
      expect(table).toBe("messages");
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: orderFn,
          })),
        })),
      };
    });

    const rows = await listMyMessages();
    expect(rows).toHaveLength(1);
    expect(rows[0].customer_user_id).toBe(USER_ID);
    expect(orderFn).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("returns [] when not authenticated", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const rows = await listMyMessages();
    expect(rows).toEqual([]);
    expect(cookieFrom).not.toHaveBeenCalled();
  });
});

describe("markMessagesRead (I-MSG-4, I-MSG-5)", () => {
  it("atomic UPDATE with sender='admin' AND read_at IS NULL filter, sets read_at only", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    let updatePayload: Record<string, unknown> | null = null;
    const select = vi.fn(async () => ({
      data: [{ id: MSG_ID }],
      error: null,
    }));
    const isFn = vi.fn(() => ({ select }));
    const eqFn = vi.fn(() => ({ is: isFn }));
    const inFn = vi.fn(() => ({ eq: eqFn }));
    cookieFrom.mockImplementation((table: string) => {
      expect(table).toBe("messages");
      return {
        update: vi.fn((payload: Record<string, unknown>) => {
          updatePayload = payload;
          return { in: inFn };
        }),
      };
    });

    const res = await markMessagesRead([MSG_ID]);
    expect(res.ok).toBe(true);
    expect(res.updated).toBe(1);
    // Only read_at set — no other field smuggled.
    expect(Object.keys(updatePayload!)).toEqual(["read_at"]);
    expect(typeof updatePayload!.read_at).toBe("string");
    // Atomic filters: id IN (...) AND sender='admin' AND read_at IS NULL.
    expect(inFn).toHaveBeenCalledWith("id", [MSG_ID]);
    expect(eqFn).toHaveBeenCalledWith("sender", "admin");
    expect(isFn).toHaveBeenCalledWith("read_at", null);
  });

  it("rejects > 50 ids", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    const ids = Array.from({ length: 51 }, () => MSG_ID);
    const res = await markMessagesRead(ids);
    expect(res.ok).toBe(false);
  });

  it("rejects non-UUID ids", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    const res = await markMessagesRead(["not-a-uuid"]);
    expect(res.ok).toBe(false);
  });
});

describe("adminSendMessage (I-MSG-2)", () => {
  it("inserts admin-sender row, fires email notification best-effort", async () => {
    let insertPayload: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation((table: string) => {
      expect(table).toBe("messages");
      return {
        insert: vi.fn((payload: Record<string, unknown>) => {
          insertPayload = payload;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: { id: MSG_ID },
                error: null,
              })),
            })),
          };
        }),
      };
    });
    adminGetUserById.mockResolvedValue({
      data: { user: { id: USER_ID, email: "researcher@example.com" } },
      error: null,
    });

    const res = await adminSendMessage(USER_ID, "Replying to your question.");
    expect(res.ok).toBe(true);
    expect(res.message_id).toBe(MSG_ID);
    expect(insertPayload!.sender).toBe("admin");
    expect(insertPayload!.customer_user_id).toBe(USER_ID);
    expect(sendMessageNotificationMock).toHaveBeenCalled();
  });

  it("non-admin caller refused", async () => {
    isAdminMock.mockResolvedValueOnce(false);
    const res = await adminSendMessage(USER_ID, "hi");
    expect(res.ok).toBe(false);
    expect(serviceFrom).not.toHaveBeenCalled();
  });

  it("rejects empty/oversize body", async () => {
    const r1 = await adminSendMessage(USER_ID, "");
    expect(r1.ok).toBe(false);
    const r2 = await adminSendMessage(USER_ID, "x".repeat(2001));
    expect(r2.ok).toBe(false);
    expect(serviceFrom).not.toHaveBeenCalled();
  });
});

describe("adminListAllThreads", () => {
  it("non-admin refused", async () => {
    isAdminMock.mockResolvedValueOnce(false);
    const res = await adminListAllThreads();
    expect(res).toEqual([]);
  });

  it("groups messages by customer_user_id and computes unread + preview", async () => {
    serviceFrom.mockImplementation((table: string) => {
      expect(table).toBe("messages");
      return {
        select: vi.fn(() => ({
          order: vi.fn(async () => ({
            data: [
              {
                id: "m1",
                customer_user_id: "u1",
                sender: "customer",
                body: "Question 1",
                created_at: "2026-01-02T00:00:00Z",
                read_at: null,
              },
              {
                id: "m2",
                customer_user_id: "u1",
                sender: "admin",
                body: "Reply 1",
                created_at: "2026-01-01T00:00:00Z",
                read_at: null,
              },
              {
                id: "m3",
                customer_user_id: "u2",
                sender: "customer",
                body: "Hi",
                created_at: "2026-01-03T00:00:00Z",
                read_at: "2026-01-03T01:00:00Z",
              },
            ],
            error: null,
          })),
        })),
      };
    });

    const threads = await adminListAllThreads();
    expect(threads).toHaveLength(2);
    const u1 = threads.find((t) => t.customer_user_id === "u1");
    expect(u1?.unread_count).toBe(1); // one unread customer message
    expect(u1?.latest_body_preview).toContain("Question 1");
  });
});
