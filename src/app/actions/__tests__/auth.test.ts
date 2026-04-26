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

type OtpArgs = { email: string; options: { emailRedirectTo: string } };
type OtpResult = { data: unknown; error: { message: string; name: string } | null };
const signInWithOtp = vi.fn<(args: OtpArgs) => Promise<OtpResult>>();

vi.mock("@/lib/supabase/client", () => ({
  createServerSupabase: async () => ({
    auth: {
      signInWithOtp: (args: OtpArgs) => signInWithOtp(args),
    },
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
    signInWithOtp.mockResolvedValue({ data: {}, error: null });
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

  it("U-AUTH-3: valid email → calls signInWithOtp with /auth/callback redirect and returns ok:true", async () => {
    const res = await requestMagicLink(fd({ email: "Researcher@Example.com " }));
    expect(res.ok).toBe(true);
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
    const arg = signInWithOtp.mock.calls[0]?.[0];
    expect(arg).toBeDefined();
    expect(arg!.email).toBe("researcher@example.com"); // lowercased + trimmed
    expect(arg!.options.emailRedirectTo).toMatch(/\/auth\/callback$/);
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
      error: { message: "user not found", name: "AuthError" },
    });
    const res = await requestMagicLink(fd({ email: "missing@example.com" }));
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    // No mention of "exist" / "found" / "registered" — generic copy only.
    expect(res.error).not.toMatch(/exist|found|register/i);
  });
});
