import { useEffect, useState } from "react";

/**
 * The console in Hindi (docs/PREP-TRACKER.md, V2-12 CL58): the navigation,
 * every page's title and its line of explanation, and the top bar. What is
 * inside each page is still English; a word missing here shows in English
 * rather than as a key. Remembered on this device.
 */

export type ConsoleLanguage = "en" | "hi";
const KEY = "parikshaa.console.language";

const stored = (): ConsoleLanguage => {
  try {
    return localStorage.getItem(KEY) === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
};

/** The chosen language, a setter, and `t`: the Hindi for a phrase when chosen and known, else the phrase. */
export function useConsoleLanguage(): [ConsoleLanguage, (next: ConsoleLanguage) => void, (phrase: string) => string] {
  const [language, setLanguage] = useState<ConsoleLanguage>(stored);
  const [hindi, setHindi] = useState<Readonly<Record<string, string>> | null>(null);
  useEffect(() => {
    if (language === "hi" && hindi === null) void import("./hindi.ts").then((m) => setHindi(m.HINDI));
  }, [language, hindi]);
  useEffect(() => {
    document.documentElement.lang = language;
    try {
      if (language === "hi") localStorage.setItem(KEY, "hi");
      else localStorage.removeItem(KEY);
    } catch {
      // Remembering it is a convenience only.
    }
  }, [language]);
  const t = (phrase: string) => (language === "hi" ? (hindi?.[phrase] ?? phrase) : phrase);
  return [language, setLanguage, t];
}
