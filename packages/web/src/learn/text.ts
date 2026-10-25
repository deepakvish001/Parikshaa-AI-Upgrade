import { useCallback, useMemo, useState } from "react";
import { usePreferences, type Language } from "../i18n.tsx";
import type { Tri } from "./screens.ts";

/**
 * Learn v2's words, in English, Hinglish and Hindi (DESIGN-SYSTEM §9: every
 * text `t(en, hinglish, hindi)`, Hinglish by default).
 *
 * They come with Learn's own chunk, as the prep pages' words do
 * (practice/prep-text.ts), so the exam pages never carry them. The language
 * is the app's own (i18n.tsx, `parikshaa.language`): choosing Hindi here
 * chooses it everywhere. The app has no Hinglish, so Learn keeps that one
 * choice itself: with the app in English, Learn shows Hinglish unless the
 * learner picked English in Learn's menu (`parikshaa.learn.hinglish` = "0").
 * The app's other nine languages have no Learn text yet; Learn shows English
 * for them.
 */

export type LearnLang = "en" | "hg" | "hi";

export const LEARN_LANGS: readonly { readonly id: LearnLang; readonly name: string; readonly lang: string }[] = [
  { id: "en", name: "English", lang: "en" },
  { id: "hg", name: "Hinglish", lang: "en-IN" },
  { id: "hi", name: "हिंदी", lang: "hi" },
];

export const HINGLISH_KEY = "parikshaa.learn.hinglish";

function stored(): string | null {
  try {
    return localStorage.getItem(HINGLISH_KEY);
  } catch {
    return null;
  }
}

/** Learn's language for the app's language and Learn's own Hinglish choice. */
export function learnLangOf(language: Language, hinglish: string | null): LearnLang {
  if (language === "hi") return "hi";
  if (language !== "en") return "en";
  return hinglish === "0" ? "en" : "hg";
}

export const pick = (lang: LearnLang, tri: Tri): string => (lang === "en" ? tri[0] : lang === "hg" ? tri[1] : tri[2]);

/** The language Learn shows, how to change it, and `t` for a Tri. */
export function useLearnLang() {
  const { language, setLanguage } = usePreferences();
  const [hinglish, setHinglish] = useState<string | null>(stored);
  const lang = learnLangOf(language, hinglish);
  const setLang = useCallback(
    (next: LearnLang) => {
      if (next === "hi") return setLanguage("hi");
      const value = next === "hg" ? "1" : "0";
      try {
        localStorage.setItem(HINGLISH_KEY, value);
      } catch {
        // Kept for this page only.
      }
      setHinglish(value);
      setLanguage("en");
    },
    [setLanguage],
  );
  const t = useCallback((tri: Tri) => pick(lang, tri), [lang]);
  return useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
}

/** The shell's own words. A screen's title and description are in screens.ts. */
export const T = {
  skip: ["Skip to content", "Seedha content par jao", "सीधे सामग्री पर जाएँ"],
  nav: ["Learn menu", "Learn menu", "लर्न मेन्यू"],
  home: ["Parikshaa Learn, today", "Parikshaa Learn, aaj", "परीक्षा लर्न, आज"],
  search: ["Search", "Khojo", "खोजें"],
  searchDialog: ["Search and go", "Khojo aur jao", "खोजें और जाएँ"],
  searchField: ["Search pages", "Pages khojo", "पेज खोजें"],
  searchHint: ["Type a page's name…", "Page ka naam likho…", "पेज का नाम लिखें…"],
  goTo: ["Go to", "Jaao", "जाएँ"],
  found: ["{n} pages", "{n} pages", "{n} पेज"],
  nothing: ["Nothing found", "Kuch nahi mila", "कुछ नहीं मिला"],
  collapse: ["Narrow side bar (Ctrl \\)", "Side bar chhota karo (Ctrl \\)", "साइड बार छोटा करें (Ctrl \\)"],
  expand: ["Wide side bar (Ctrl \\)", "Side bar bada karo (Ctrl \\)", "साइड बार बड़ा करें (Ctrl \\)"],
  askSahayak: ["Ask Sahayak", "Sahayak kholo", "सहायक खोलें"],
  sahayak: ["Sahayak", "Sahayak", "सहायक"],
  sahayakSoon: ["Sahayak, your AI tutor, opens here.", "Sahayak, aapka AI tutor, yahan khulega.", "सहायक, आपका AI ट्यूटर, यहाँ खुलेगा।"],
  close: ["Close", "Band karo", "बंद करें"],
  more: ["More", "Aur", "और"],
  options: ["More options", "Aur vikalp", "और विकल्प"],
  menu: ["Menu", "Menu", "मेन्यू"],
  language: ["Language", "Bhasha", "भाषा"],
  toLight: ["Paper (light)", "Kaagaz (light)", "काग़ज़ (लाइट)"],
  toDark: ["Black (dark)", "Kaala (dark)", "काला (डार्क)"],
  oldSite: ["Current practice site", "Abhi wali practice site", "मौजूदा प्रैक्टिस साइट"],
  account: ["Your account", "Aapka account", "आपका खाता"],
  accountSub: ["Sign-in comes in step 2", "Sign-in Kadam 2 me", "साइन-इन कदम 2 में"],
  breadcrumb: ["You are here", "Aap yahan ho", "आप यहाँ हैं"],
  step2: ["Step 2 connects this to real data.", "Kadam 2 me asli data se judega.", "कदम 2 में असली डेटा से जुड़ेगा।"],
  toToday: ["Go to Today", "Aaj par jao", "आज पर जाएँ"],
  notHereTitle: ["This page is not in Learn v2 yet", "Ye page Learn v2 me abhi nahi", "यह पेज अभी Learn v2 में नहीं"],
  notHereBody: ["Open it on the current practice site.", "Ise abhi wali practice site par kholo.", "इसे मौजूदा प्रैक्टिस साइट पर खोलें।"],
  openOld: ["Open on the current site", "Abhi wali site par kholo", "मौजूदा साइट पर खोलें"],
  tabToday: ["Today", "Aaj", "आज"],
  tabLearn: ["Learn", "Seekho", "सीखो"],
  tabPractice: ["Practice", "Abhyas", "अभ्यास"],
  phoneNav: ["Main tabs", "Mukhya tabs", "मुख्य टैब"],
  rail: ["Beside the page", "Page ke saath", "पेज के साथ"],
} as const satisfies Record<string, Tri>;
