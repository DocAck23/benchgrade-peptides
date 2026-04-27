import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks. requestMagicLink touches next/headers, the supabase ssr client,
// and the rate-limit wrapper. We stub each at the module boundary so the
// action runs in pure userland and the tests can flip the rate-limit
// outcome without standing up real storage.
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-for": "127.0.0.1",
      "user-agent": "vitest",
    }),
}));

// requestMagicLink now mints the URL via the service-role admin
// client + dispatches a branded email through Resend, instead of
// calling Supabase's auto-send signInWithOtp. Mocks moved to
// `getSupabaseServer().auth.admin.generateLink`. The variable is
// still named `signInWithOtp` so the assertion blocks below read
// naturally — semantically it's "the auth-flow trigger we expect
// to be called once per valid request."
type GenLinkArgs = {
  type: string;
  email: string;
  options: { redirectTo: string };
};
type GenLinkResult = {
  data: { properties?: { action_link?: string } } | null;
  error: { message: string } | null;
};
const signInWithOtp = vi.fn<(args: GenLinkArgs) => Promise<GenLinkResult>>();

vi.mock("@/lib/supabase/client", () => ({
  // Cookie-scoped client kept for password / session paths; the
  // magic-link path no longer touches it.
  createServerSupabase: async () => ({ auth: {} }),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => ({
    auth: {
      admin: {
        generateLink: (args: GenLinkArgs) => signInWithOtp(args),
      },
    },
  }),
}));

vi.mock("@/lib/email/client", () => ({
  getResend: () => null,
  EMAIL_FROM: "Test <test@example.com>",
}));

vi.mock("@/lib/email/templates/magic-link", () => ({
  magicLinkEmail: (opts: { link: string }) => ({
    subject: "Sign in",
    html: `<a href="${opts.link}">Sign in</a>`,
    text: `Sign in: ${opts.link}`,
  }),
}));

type RlResult =
  | { allowed: true }
  | { allowed: false; error: string; retryAfter: number };
const enforceMagicLinkRateLimit = vi.fn<(ip: string) => Promise<RlResult>>();

vi.mock("@/lib/auth/rate-limit", () => ({
  enforceMagicLinkRateLimit: (ip: string) => enforceMagicLinkRateLimit(ip),
  MAGIC_LINK_RATE_LIMIT: { limit: 3, windowSeconds: 5 * 60 },
}));

import { requestMagicLink } from "../auth";

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

describe("requestMagicLink", () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
    signInWithOtp.mockResolvedValue({
      data: {
        properties: {
          action_link: "https://benchgradepeptides.com/auth/callback?token_hash=t",
        },
      },
      error: null,
    });
    enforceMagicLinkRateLimit.mockReset();
    enforceMagicLinkRateLimit.mockResolvedValue({ allowed: true });
  });

  it("U-AUTH-1: empty email → returns ok:false with email error", async () => {
    const res = await requestMagicLink(fd({ email: "" }));
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("U-AUTH-2: malformed email → validation error", async () => {
    const res = await requestMagicLink(fd({ email: "not-an-email" }));
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("U-AUTH-3: valid email → mints magic link via admin.generateLink with /auth/callback redirect and returns ok:true", async () => {
    const res = await requestMagicLink(fd({ email: "Researcher@Example.com " }));
    expect(res.ok).toBe(true);
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    const arg = signInWithOtp.mock.calls[0]?.[0];
    expect(arg).toBeDefined();
    expect(arg!.type).toBe("magiclink");
    expect(arg!.email).toBe("researcher@example.com"); // lowercased + trimmed
    expect(arg!.options.redirectTo).toMatch(/\/auth\/callback$/);
  });

  it("U-AUTH-4: rate-limited → returns ok:false with rate-limit error and never calls otp", async () => {
    enforceMagicLinkRateLimit.mockResolvedValueOnce({
      allowed: false,
      error: "Too many requests. Try again in a few minutes.",
      retryAfter: 300,
    });
    const res = await requestMagicLink(fd({ email: "researcher@example.com" }));
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/too many/i);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("does not leak email-existence: supabase auth error returns the same generic shape", async () => {
    signInWithOtp.mockResolvedValueOnce({
      data: null,
      error: { message: "user not found" },
    });
    const res = await requestMagicLink(fd({ email: "missing@example.com" }));
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    // No mention of "exist" / "found" / "registered" — generic copy only.
    expect(res.error).not.toMatch(/exist|found|register/i);
  });
});
