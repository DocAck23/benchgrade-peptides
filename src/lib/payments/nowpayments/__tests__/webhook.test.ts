import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  computeIpnSignature,
  verifyIpnSignature,
  mapPaymentStatusToOrderStatus,
} from "../webhook";

const SECRET = "test-ipn-secret-32-bytes-minimum-ok";

function signed(body: unknown): { raw: string; signature: string } {
  const raw = JSON.stringify(body);
  const signature = crypto
    .createHmac("sha512", SECRET)
    .update(sortedBody(body))
    .digest("hex");
  return { raw, signature };
}

/**
 * NOWPayments signs the JSON body after keys are sorted alphabetically
 * at every level. Our verifier must reproduce this exactly.
 */
function sortedBody(body: unknown): string {
  if (Array.isArray(body)) return `[${body.map(sortedBody).join(",")}]`;
  if (body && typeof body === "object") {
    const entries = Object.entries(body as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b)
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${sortedBody(v)}`).join(",")}}`;
  }
  return JSON.stringify(body);
}

describe("NOWPayments webhook — signature", () => {
  it("computeIpnSignature matches the reference HMAC", () => {
    const body = { foo: "bar", b: 1, a: [3, 2] };
    const expected = crypto
      .createHmac("sha512", SECRET)
      .update(sortedBody(body))
      .digest("hex");
    expect(computeIpnSignature(body, SECRET)).toBe(expected);
  });

  it("verifyIpnSignature accepts a valid signature", () => {
    const body = { payment_id: 1, payment_status: "confirmed" };
    const sig = computeIpnSignature(body, SECRET);
    expect(verifyIpnSignature(body, sig, SECRET)).toBe(true);
  });

  it("verifyIpnSignature rejects tampered body", () => {
    const body = { payment_id: 1, payment_status: "confirmed" };
    const sig = computeIpnSignature(body, SECRET);
    const tampered = { ...body, payment_status: "failed" };
    expect(verifyIpnSignature(tampered, sig, SECRET)).toBe(false);
  });

  it("verifyIpnSignature rejects a signature from the wrong secret", () => {
    const body = { payment_id: 1, payment_status: "confirmed" };
    const sig = computeIpnSignature(body, "other-secret");
    expect(verifyIpnSignature(body, sig, SECRET)).toBe(false);
  });

  it("verifyIpnSignature is timing-safe (same length: uses timingSafeEqual)", () => {
    const body = { payment_id: 1, payment_status: "confirmed" };
    const sig = computeIpnSignature(body, SECRET);
    // Mutate last char; still same length.
    const flipped = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
    expect(verifyIpnSignature(body, flipped, SECRET)).toBe(false);
  });

  it("verifyIpnSignature rejects different-length signature (short-circuits safely)", () => {
    const body = { payment_id: 1, payment_status: "confirmed" };
    expect(verifyIpnSignature(body, "deadbeef", SECRET)).toBe(false);
  });

  it("verifyIpnSignature rejects empty signature", () => {
    const body = { payment_id: 1 };
    expect(verifyIpnSignature(body, "", SECRET)).toBe(false);
  });

  // Fake-signer that uses raw (unsorted) body to prove our verifier is
  // sort-sensitive — without key sorting the spec is unreachable.
  it("signatures against raw (unsorted) body fail — we must sort", () => {
    const body = { b: 1, a: 2 };
    const naive = crypto
      .createHmac("sha512", SECRET)
      .update(JSON.stringify(body))
      .digest("hex");
    expect(verifyIpnSignature(body, naive, SECRET)).toBe(false);
    // And the signed-with-sorting signature passes:
    expect(verifyIpnSignature(body, signed(body).signature, SECRET)).toBe(true);
  });
});

describe("NOWPayments webhook — payment status mapping", () => {
  it("maps confirmed / finished / partially_paid to funded", () => {
    expect(mapPaymentStatusToOrderStatus("confirmed")).toBe("funded");
    expect(mapPaymentStatusToOrderStatus("finished")).toBe("funded");
    expect(mapPaymentStatusToOrderStatus("partially_paid")).toBe("funded");
  });

  it("maps waiting / confirming to null (no status change)", () => {
    expect(mapPaymentStatusToOrderStatus("waiting")).toBe(null);
    expect(mapPaymentStatusToOrderStatus("confirming")).toBe(null);
    expect(mapPaymentStatusToOrderStatus("sending")).toBe(null);
  });

  it("maps failed / expired to cancelled", () => {
    expect(mapPaymentStatusToOrderStatus("failed")).toBe("cancelled");
    expect(mapPaymentStatusToOrderStatus("expired")).toBe("cancelled");
  });

  it("maps refunded to refunded", () => {
    expect(mapPaymentStatusToOrderStatus("refunded")).toBe("refunded");
  });

  it("returns null for unknown status (idempotent no-op)", () => {
    expect(mapPaymentStatusToOrderStatus("greenfield_unknown")).toBe(null);
  });
});
