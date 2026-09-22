import { afterEach, describe, expect, it } from "vitest";
import { loadLocalDrafts, purgeExpiredDrafts, saveLocalDraft } from "./drafts.ts";

afterEach(() => localStorage.clear());

describe("drafts kept on this device", () => {
  const HOUR = 3_600_000;

  it("survives a deadline that may since have been extended", () => {
    saveLocalDraft("a1", 1_000, "q1", { answer: "unsent", synced: false });

    purgeExpiredDrafts(1_000 + HOUR);

    expect(loadLocalDrafts("a1")).toEqual({ q1: { answer: "unsent", synced: false } });
  });

  it("is removed once no extension could still be open", () => {
    saveLocalDraft("a1", 1_000, "q1", { answer: "old", synced: false });
    saveLocalDraft("a2", 1_000 + 48 * HOUR, "q1", { answer: "current", synced: false });

    purgeExpiredDrafts(1_000 + 25 * HOUR);

    expect(loadLocalDrafts("a1")).toEqual({});
    expect(loadLocalDrafts("a2")).toEqual({ q1: { answer: "current", synced: false } });
  });
});
