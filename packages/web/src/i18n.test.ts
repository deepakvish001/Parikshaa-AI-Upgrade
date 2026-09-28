import { beforeAll, describe, expect, it } from "vitest";
import { coverage, isLoaded, LANGUAGE_NAMES, loadLocale, type Language, type MessageKey, translate } from "./i18n.tsx";

/** ROADMAP §9: every language offered has an interface, and a missing string falls back to English rather than a key. */

const languages = Object.keys(LANGUAGE_NAMES) as Language[];

describe("loading a language", () => {
  it("brings English and Hindi with the page, and fetches the rest when chosen", async () => {
    expect(isLoaded("en") && isLoaded("hi")).toBe(true);
    expect(isLoaded("gu")).toBe(false);
    expect(translate("gu", "exam.submit")).toBe(translate("en", "exam.submit"));
    await loadLocale("gu");
    expect(translate("gu", "exam.submit")).not.toBe(translate("en", "exam.submit"));
  });
});

describe("interface languages", () => {
  beforeAll(async () => {
    for (const language of languages) await loadLocale(language);
  });

  it("covers nearly all of the interface in every language offered", () => {
    for (const language of languages) expect(coverage(language), language).toBeGreaterThan(0.9);
  });

  it("keeps each placeholder a translation needs", () => {
    for (const language of languages) {
      expect(translate(language, "exam.answeredOf", { answered: 7, total: 9 }), language).toMatch(/7[\s\S]*9|9[\s\S]*7/);
      expect(translate(language, "receipt.failed", { seq: 42, reason: "x" }), language).toContain("42");
    }
  });

  it("falls back to English for a string a language has not translated", () => {
    const untranslated: MessageKey = "notice.heading";
    expect(translate("ta", untranslated)).toBe(translate("en", untranslated));
    expect(translate("ta", "exam.submit")).not.toBe(translate("en", "exam.submit"));
  });
});
