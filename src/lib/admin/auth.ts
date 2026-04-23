import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "bgp_admin";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function expectedTokenFor(password: string): string {
  return crypto.createHash("sha256").update(password, "utf8").digest("hex");
}

/**
 * True iff the admin cookie carries a hash matching ADMIN_PASSWORD.
 * Missing env var → never admin. We do not grant a bypass in dev.
 */
export async function isAdmin(): Promise<boolean> {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const jar = await cookies();
  const cookie = jar.get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  const expected = expectedTokenFor(pw);
  try {
    return crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function setAdminCookie(password: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  if (password !== expected) return false;
  const jar = await cookies();
  jar.set(COOKIE_NAME, expectedTokenFor(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return true;
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
