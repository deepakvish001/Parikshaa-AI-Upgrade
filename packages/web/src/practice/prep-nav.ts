/**
 * The few prep words the practice pages show before the prep pages load: the
 * navigation, the notes tab, and the list's pattern and company filters. The rest are in `prep-text.ts`, which comes with
 * the prep pages' own chunk, so the problem set does not carry them.
 */
const en = {
  home: "Home",
  tracks: "Tracks",
  plan: "Plan",
  revise: "Revise",
  notes: "My notes",
  tutor: "Sahayak",
  companies: "Companies",
  rating: "Rating",
  store: "Store",
  pattern: "Pattern",
  allPatterns: "All patterns",
  company: "Company",
  allCompanies: "All companies",
} as const;
const hi: Record<keyof typeof en, string> = {
  home: "होम",
  tracks: "ट्रैक",
  plan: "प्लान",
  revise: "दोहराएँ",
  notes: "मेरे नोट्स",
  tutor: "सहायक",
  companies: "कंपनियाँ",
  rating: "रेटिंग",
  store: "दुकान",
  pattern: "पैटर्न",
  allPatterns: "सभी पैटर्न",
  company: "कंपनी",
  allCompanies: "सभी कंपनियाँ",
};

export type NavWord = keyof typeof en;
export const navWord = (language: string, word: NavWord): string => (language === "hi" ? hi : en)[word];
