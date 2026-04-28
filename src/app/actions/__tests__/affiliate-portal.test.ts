import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks. Mirror the affiliate.test.ts setup: cookie-scoped client (auth +
// owner-RLS reads), service-role client (admin reads + privileged writes),
// admin gate, next/headers (headers + cookies).
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-for": "203.0.113.42",
      "user-agent": "vitest",
    }),
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

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
const storageFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => ({
    from: serviceFrom,
    storage: { from: storageFrom },
    auth: { admin: { getUserById: adminGetUserById } },
  }),
}));

const isAdminMock = vi.fn(async () => true);
vi.mock("@/lib/admin/auth", () => ({
  isAdmin: () => isAdminMock(),
}));

vi.mock("@/lib/site", () => ({
  SITE_URL: "https://example.test",
}));

import {
  generateAffiliateInvite,
  consumeAffiliateInvite,
  signAffiliateAgreement,
  uploadAffiliateW9,
  listAffiliatesAdmin,
  getAffiliateW9SignedUrlAdmin,
  getAffiliateW9SignedUrlForMe,
} from "../affiliate-portal";
import { AGREEMENT_VERSION } from "@/lib/affiliate/agreement-1099-v1";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const TOKEN = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  cookieFrom.mockReset();
  cookieGetUser.mockReset();
  serviceFrom.mockReset();
  adminGetUserById.mockReset();
  storageFrom.mockReset();
  isAdminMock.mockReset().mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// generateAffiliateInvite
// ---------------------------------------------------------------------------

describe("generateAffiliateInvite", () => {
  it("rejects non-admin", async () => {
    isAdminMock.mockResolvedValueOnce(false);
    const res = await generateAffiliateInvite({});
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/authorized/i);
  });

  it("inserts row and returns absolute URL", async () => {
    let inserted: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation((table: string) => {
      expect(table).toBe("affiliate_invites");
      return {
        insert: (payload: Record<string, unknown>) => {
          inserted = payload;
          return {
            select: () => ({
              single: async () => ({ data: { token: TOKEN }, error: null }),
            }),
          };
        },
      };
    });
    const res = await generateAffiliateInvite({
      note: "Spring 2026",
      expiresInDays: 7,
    });
    expect(res.ok).toBe(true);
    expect(res.token).toBe(TOKEN);
    expect(res.url).toBe(`https://example.test/affiliate/invite/${TOKEN}`);
    expect(inserted).toMatchObject({ note: "Spring 2026", created_by_admin: true });
    expect(inserted!.expires_at).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// consumeAffiliateInvite
// ---------------------------------------------------------------------------

describe("consumeAffiliateInvite", () => {
  it("requires sign-in", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: null } });
    const res = await consumeAffiliateInvite(TOKEN);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/sign in/i);
  });

  it("rejects expired token", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    serviceFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              token: TOKEN,
              expires_at: new Date(Date.now() - 1000).toISOString(),
              consumed_at: null,
              consumed_by_user_id: null,
            },
            error: null,
          }),
        }),
      }),
    }));
    const res = await consumeAffiliateInvite(TOKEN);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/expired/i);
  });

  it("rejects already-consumed token from a different user", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    serviceFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              token: TOKEN,
              expires_at: null,
              consumed_at: new Date().toISOString(),
              consumed_by_user_id: OTHER_ID,
            },
            error: null,
          }),
        }),
      }),
    }));
    const res = await consumeAffiliateInvite(TOKEN);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/already been used/i);
  });

  it("performs atomic claim with .is(consumed_at, null)", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    let isFilterValue: unknown = "untouched";
    let updateArgs: Record<string, unknown> | null = null;
    let call = 0;
    serviceFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              token: TOKEN,
              expires_at: null,
              consumed_at: null,
              consumed_by_user_id: null,
            },
            error: null,
          }),
        }),
      }),
      update: (vals: Record<string, unknown>) => {
        updateArgs = vals;
        return {
          eq: () => ({
            is: (col: string, val: unknown) => {
              expect(col).toBe("consumed_at");
              isFilterValue = val;
              return {
                select: async () => {
                  call += 1;
                  return { data: [{ token: TOKEN }], error: null };
                },
              };
            },
          }),
        };
      },
    }));
    const res = await consumeAffiliateInvite(TOKEN);
    expect(res.ok).toBe(true);
    expect(isFilterValue).toBeNull();
    expect(updateArgs!.consumed_by_user_id).toBe(USER_ID);
    expect(call).toBe(1);
  });

  it("treats lost race (rowcount 0) as already consumed", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    serviceFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              token: TOKEN,
              expires_at: null,
              consumed_at: null,
              consumed_by_user_id: null,
            },
            error: null,
          }),
        }),
      }),
      update: () => ({
        eq: () => ({
          is: () => ({
            select: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    }));
    const res = await consumeAffiliateInvite(TOKEN);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/already been used/i);
  });
});

// ---------------------------------------------------------------------------
// signAffiliateAgreement
// ---------------------------------------------------------------------------

describe("signAffiliateAgreement", () => {
  it("requires sign-in", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: null } });
    const res = await signAffiliateAgreement({ signed_name: "Jane Q" });
    expect(res.ok).toBe(false);
  });

  it("captures snapshot HTML + name + ip + ua + version", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    let inserted: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation(() => ({
      insert: (payload: Record<string, unknown>) => {
        inserted = payload;
        return {
          select: () => ({
            single: async () => ({ data: { id: "agid" }, error: null }),
          }),
        };
      },
    }));
    const res = await signAffiliateAgreement({ signed_name: "Jane Q. Researcher" });
    expect(res.ok).toBe(true);
    expect(inserted).toMatchObject({
      affiliate_user_id: USER_ID,
      signed_name: "Jane Q. Researcher",
      agreement_version: AGREEMENT_VERSION,
      ip: "203.0.113.42",
      user_agent: "vitest",
    });
    expect(typeof inserted!.agreement_html).toBe("string");
    expect((inserted!.agreement_html as string).length).toBeGreaterThan(500);
  });

  it("rejects too-short signed name", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    const res = await signAffiliateAgreement({ signed_name: "X" });
    expect(res.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// uploadAffiliateW9
// ---------------------------------------------------------------------------

function makePdfFile(name = "w9.pdf", size = 1024): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type: "application/pdf" });
}

describe("uploadAffiliateW9", () => {
  it("requires file", async () => {
    const fd = new FormData();
    const res = await uploadAffiliateW9(fd);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no file/i);
  });

  it("rejects non-PDF", async () => {
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(10)], "tax.png", { type: "image/png" }));
    const res = await uploadAffiliateW9(fd);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/pdf/i);
  });

  it("rejects > 5MB", async () => {
    const fd = new FormData();
    fd.append("file", makePdfFile("big.pdf", 6 * 1024 * 1024));
    const res = await uploadAffiliateW9(fd);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/5 MB/i);
  });

  it("rejects unauth user", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: null } });
    const fd = new FormData();
    fd.append("file", makePdfFile());
    const res = await uploadAffiliateW9(fd);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/sign in/i);
  });

  it("uploads to affiliate-w9/<uid>/<uuid>.pdf and inserts ledger row", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    let uploadedPath: string | null = null;
    storageFrom.mockImplementation((bucket: string) => {
      expect(bucket).toBe("affiliate-w9");
      return {
        upload: async (path: string) => {
          uploadedPath = path;
          return { error: null };
        },
      };
    });
    let inserted: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation((table: string) => {
      if (table !== "affiliate_w9") throw new Error("unexpected table " + table);
      return {
        update: () => ({
          eq: () => ({
            is: async () => ({ error: null }),
          }),
        }),
        insert: async (payload: Record<string, unknown>) => {
          inserted = payload;
          return { error: null };
        },
      };
    });
    const fd = new FormData();
    fd.append("file", makePdfFile("my-w9.pdf", 2048));
    const res = await uploadAffiliateW9(fd);
    expect(res.ok).toBe(true);
    expect(uploadedPath).toMatch(new RegExp(`^${USER_ID}/[0-9a-f-]+\\.pdf$`));
    expect(inserted).toMatchObject({
      affiliate_user_id: USER_ID,
      original_filename: "my-w9.pdf",
      byte_size: 2048,
      ip: "203.0.113.42",
    });
  });
});

// ---------------------------------------------------------------------------
// listAffiliatesAdmin
// ---------------------------------------------------------------------------

describe("listAffiliatesAdmin", () => {
  it("rejects non-admin", async () => {
    isAdminMock.mockResolvedValueOnce(false);
    const res = await listAffiliatesAdmin();
    expect(res.ok).toBe(false);
  });

  it("merges invite + agreement + w9 by user_id", async () => {
    serviceFrom.mockImplementation((table: string) => {
      if (table === "affiliate_invites") {
        return {
          select: () => ({
            not: async () => ({
              data: [
                { consumed_by_user_id: USER_ID, consumed_at: "2026-04-27T10:00:00Z" },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === "affiliate_agreements") {
        return {
          select: () => ({
            order: async () => ({
              data: [
                {
                  affiliate_user_id: USER_ID,
                  signed_at: "2026-04-27T11:00:00Z",
                  agreement_version: AGREEMENT_VERSION,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === "affiliate_w9") {
        return {
          select: () => ({
            is: () => ({
              order: async () => ({
                data: [
                  { affiliate_user_id: USER_ID, uploaded_at: "2026-04-27T12:00:00Z" },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error("unexpected table " + table);
    });
    adminGetUserById.mockResolvedValue({ data: { user: { email: "a@b.com" } } });

    const res = await listAffiliatesAdmin();
    expect(res.ok).toBe(true);
    expect(res.rows).toHaveLength(1);
    const row = res.rows![0]!;
    expect(row.user_id).toBe(USER_ID);
    expect(row.email).toBe("a@b.com");
    expect(row.agreement_signed_at).toBe("2026-04-27T11:00:00Z");
    expect(row.w9_uploaded_at).toBe("2026-04-27T12:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// signed URL boundaries
// ---------------------------------------------------------------------------

describe("getAffiliateW9SignedUrlAdmin", () => {
  it("rejects non-admin", async () => {
    isAdminMock.mockResolvedValueOnce(false);
    const res = await getAffiliateW9SignedUrlAdmin(USER_ID);
    expect(res.ok).toBe(false);
  });

  it("rejects invalid uuid", async () => {
    const res = await getAffiliateW9SignedUrlAdmin("not-a-uuid");
    expect(res.ok).toBe(false);
  });

  it("returns signed URL when row exists", async () => {
    serviceFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: { storage_path: `${USER_ID}/abc.pdf` },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }));
    storageFrom.mockReturnValue({
      createSignedUrl: async (path: string, ttl: number) => {
        expect(ttl).toBe(300);
        return { data: { signedUrl: `https://signed/${path}` }, error: null };
      },
    });
    const res = await getAffiliateW9SignedUrlAdmin(USER_ID);
    expect(res.ok).toBe(true);
    expect(res.url).toBe(`https://signed/${USER_ID}/abc.pdf`);
  });
});

describe("getAffiliateW9SignedUrlForMe", () => {
  it("rejects unauth", async () => {
    cookieGetUser.mockResolvedValue({ data: { user: null } });
    const res = await getAffiliateW9SignedUrlForMe();
    expect(res.ok).toBe(false);
  });

  it("only signs URL after RLS-scoped lookup returns the caller's row", async () => {
    // Cookie client is the RLS gate — the test stub returns the
    // caller's row (or none). We assert that the caller never reaches
    // signing if no row is returned.
    cookieGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    cookieFrom.mockImplementation(() => ({
      select: () => ({
        is: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }));
    const res = await getAffiliateW9SignedUrlForMe();
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no w9/i);
  });
});
