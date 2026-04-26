// Route handler tests for GET /api/messaging/poll. Mocks
// createServerSupabase + NextRequest URL parsing so we can assert auth
// gating and the since-cursor query path without a live database.
import { describe, it, expect, vi, beforeEach } from "vitest";

const authGetUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createServerSupabase: vi.fn(async () => ({
    auth: { getUser: authGetUserMock },
    from: fromMock,
  })),
}));

import { GET } from "../route";

function buildReq(url: string): import("next/server").NextRequest {
  // Cast through unknown — NextRequest constructor isn't exposed but the
  // route only reads `req.nextUrl.searchParams`, which we satisfy via URL.
  const u = new URL(url);
  return {
    nextUrl: u,
  } as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
  authGetUserMock.mockReset();
  fromMock.mockReset();
});

describe("GET /api/messaging/poll", () => {
  it("returns 401 when no user session", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: null } });
    const res = await GET(buildReq("https://x.test/api/messaging/poll"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it("returns messages for the authenticated user (no since)", async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: "user-abc" } },
    });
    const order = vi.fn().mockResolvedValue({
      data: [{ id: "m1", customer_user_id: "user-abc", sender: "admin", body: "hi", created_at: "2026-04-25T10:00:00Z", read_at: null }],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const res = await GET(buildReq("https://x.test/api/messaging/poll"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.messages).toHaveLength(1);
    expect(fromMock).toHaveBeenCalledWith("messages");
    expect(eq).toHaveBeenCalledWith("customer_user_id", "user-abc");
  });

  it("applies the since-cursor when provided", async () => {
    authGetUserMock.mockResolvedValue({
      data: { user: { id: "user-abc" } },
    });
    const gt = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn().mockReturnValue({ gt });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const res = await GET(
      buildReq("https://x.test/api/messaging/poll?since=2026-04-25T10:00:00Z")
    );
    expect(res.status).toBe(200);
    expect(gt).toHaveBeenCalledWith("created_at", "2026-04-25T10:00:00Z");
  });

  it("returns 500 on supabase error", async () => {
    authGetUserMock.mockResolvedValue({ data: { user: { id: "u" } } });
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select });

    const res = await GET(buildReq("https://x.test/api/messaging/poll"));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("boom");
  });
});
