import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DataKeys } from "./sealing.js";

/** Blind indexes (docs/HIRE-V2.md §10, S20): matched without the value, and only with the key. */

const keys = new DataKeys(Buffer.alloc(32, 7));

describe("blind indexes", () => {
  it("give the same index for the same value, so rows can be matched", () => {
    const emails = keys.blind("hire-email");
    expect(emails.of("org-a", "asha@example.com")).toBe(emails.of("org-a", "asha@example.com"));
    expect(emails.of("org-a", "asha@example.com")).not.toBe(emails.of("org-a", "ravi@example.com"));
  });

  it("differ between organisations, so one cannot be joined to another", () => {
    const emails = keys.blind("hire-email");
    expect(emails.of("org-a", "asha@example.com")).not.toBe(emails.of("org-b", "asha@example.com"));
    // The scope and the value cannot run into each other.
    expect(emails.of("org-a", "b@x")).not.toBe(emails.of("org-ab", "@x"));
  });

  it("differ between kinds of value and between keys", () => {
    const index = keys.blind("hire-email").of("", "asha@example.com");
    expect(keys.blind("hire-phone").of("", "asha@example.com")).not.toBe(index);
    expect(new DataKeys(Buffer.alloc(32, 8)).blind("hire-email").of("", "asha@example.com")).not.toBe(index);
  });

  it("cannot be found by hashing a guess without the key", () => {
    const index = keys.blind("hire-email").of("", "asha@example.com");
    for (const guess of ["asha@example.com", "\u0000asha@example.com"]) {
      expect(createHash("sha256").update(guess).digest("base64url")).not.toBe(index);
    }
    expect(index).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
