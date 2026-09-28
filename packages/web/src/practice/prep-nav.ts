/**
 * The few prep words the practice pages show before the prep pages load: the
 * navigation and the notes tab. The rest are in `prep-text.ts`, which comes with
 * the prep pages' own chunk, so the problem set does not carry them.
 */
const en = { home: "Home", tracks: "Tracks", plan: "Plan", revise: "Revise", notes: "My notes" } as const;
const hi: Record<keyof typeof en, string> = { home: "होम", tracks: "ट्रैक", plan: "प्लान", revise: "दोहराएँ", notes: "मेरे नोट्स" };

export type NavWord = keyof typeof en;
export const navWord = (language: string, word: NavWord): string => (language === "hi" ? hi : en)[word];
