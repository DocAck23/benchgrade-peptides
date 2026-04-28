import { describe, it, expect } from "vitest";
import { firstNameOf } from "../name";

describe("firstNameOf", () => {
  it("prefers explicit first_name when present", () => {
    expect(firstNameOf({ first_name: "Ahmed", name: "Old Composed Name" }))
      .toBe("Ahmed");
  });

  it("trims whitespace from first_name", () => {
    expect(firstNameOf({ first_name: "  Ahmed  " })).toBe("Ahmed");
  });

  it("falls back to first whitespace token of name (legacy orders)", () => {
    expect(firstNameOf({ name: "Ahmed Al-Hilali" })).toBe("Ahmed");
  });

  it("handles multi-token last names without losing the first", () => {
    expect(firstNameOf({ name: "Jane van der Berg" })).toBe("Jane");
  });

  it("returns null for empty inputs", () => {
    expect(firstNameOf({})).toBeNull();
    expect(firstNameOf({ name: "" })).toBeNull();
    expect(firstNameOf({ name: "   " })).toBeNull();
    expect(firstNameOf({ first_name: "" })).toBeNull();
  });

  it("handles null fields", () => {
    expect(firstNameOf({ first_name: null, name: null })).toBeNull();
    expect(firstNameOf({ first_name: null, name: "Ahmed Foo" })).toBe("Ahmed");
  });

  it("does not coerce honorifics — they stay attached", () => {
    // Intentional: 'Dr.' is the first whitespace token, so it wins.
    // Splitting on punctuation would over-engineer the heuristic.
    expect(firstNameOf({ name: "Dr. Sarah Chen" })).toBe("Dr.");
  });
});
