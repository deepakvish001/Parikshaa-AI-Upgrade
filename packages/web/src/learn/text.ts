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

/** Put values into a text's `{name}` places. */
export const fill = (text: string, values: Readonly<Record<string, string | number>>): string =>
  text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));

/** The words every screen's data shares: loading, failing, offline, signed out (DESIGN-SYSTEM §9, five states). */
export const D = {
  loading: ["Loading… a slow connection takes a few seconds.", "Load ho raha hai… dheema net ho to kuch second.", "लोड हो रहा है… धीमे नेट पर कुछ सेकंड।"],
  failedTitle: ["This did not load", "Ye load nahi hua", "यह लोड नहीं हुआ"],
  failedBody: ["Nothing of yours is lost. Try again in a moment.", "Aapka kuch nahi gaya. Thodi der me phir koshish karo.", "आपका कुछ नहीं गया। थोड़ी देर में फिर कोशिश करें।"],
  retry: ["Try again", "Phir koshish karo", "फिर कोशिश करें"],
  reference: ["Reference", "Reference", "संदर्भ"],
  offlineTitle: ["You are offline.", "Aap offline ho.", "आप ऑफ़लाइन हैं।"],
  offlineBody: ["What is on the page stays; it updates when the network is back.", "Jo dikh raha hai wo rahega; net aate hi naya ho jayega.", "जो दिख रहा है वह रहेगा; नेट आते ही नया हो जाएगा।"],
  offlineWait: ["This shows once the network is back.", "Net aate hi ye dikhega.", "नेट आते ही यह दिखेगा।"],
  signedOutTitle: ["Sign in to see your day", "Apna din dekhne ke liye sign in karo", "अपना दिन देखने के लिए साइन इन करें"],
  signedOutBody: ["One account for Learn and the current practice site: the same plan and progress in both.", "Learn aur purani practice site ka ek hi account: plan aur progress dono me wahi.", "Learn और मौजूदा प्रैक्टिस साइट का एक ही खाता: योजना और प्रगति दोनों में वही।"],
  signIn: ["Sign in", "Sign in karo", "साइन इन करें"],
  signOut: ["Sign out", "Sign out karo", "साइन आउट करें"],
  verified: ["Your email address is confirmed.", "Aapka email confirm ho gaya.", "आपका ईमेल पक्का हो गया।"],
  verifyFailed: ["This confirmation link is not valid. Ask for a new one below.", "Ye confirmation link sahi nahi. Neeche naya maango.", "यह पुष्टि लिंक सही नहीं। नीचे नया माँगें।"],
  googleFailed: ["Signing in with Google did not work. Try again, or use your email.", "Google se sign in nahi hua. Phir koshish karo, ya email se.", "Google से साइन इन नहीं हुआ। फिर कोशिश करें, या ईमेल से।"],
  verifyNeeded: ["Confirm your email to submit and comment: open the link we sent to {email}.", "Submit aur comment ke liye email confirm karo: {email} par bheja link kholo.", "जमा करने और टिप्पणी के लिए ईमेल पक्का करें: {email} पर भेजा लिंक खोलें।"],
  resend: ["Send the link again", "Link dobara bhejo", "लिंक दोबारा भेजें"],
  resent: ["Sent. Check your inbox and spam.", "Bhej diya. Inbox aur spam dekho.", "भेज दिया। इनबॉक्स और स्पैम देखें।"],
  dismiss: ["Dismiss", "Hatao", "हटाएँ"],
} as const satisfies Record<string, Tri>;

/** Aaj's words (K2-1). `{name}` places are filled with `fill`. */
export const A = {
  dayOf: ["day {n} of {of}", "din {n}/{of}", "दिन {n}/{of}"],
  morning: ["Good morning, {name}.", "Suprabhat, {name}.", "सुप्रभात, {name}।"],
  afternoon: ["Good afternoon, {name}.", "Namaste, {name}.", "नमस्ते, {name}।"],
  evening: ["Good evening, {name}.", "Shubh sandhya, {name}.", "शुभ संध्या, {name}।"],
  left: ["{n} things left, about {m} min.", "{n} kaam baaki, lagbhag {m} min.", "{n} काम बाकी, लगभग {m} मिनट।"],
  leftOne: ["1 thing left, about {m} min.", "1 kaam baaki, lagbhag {m} min.", "1 काम बाकी, लगभग {m} मिनट।"],
  allDone: ["All of today's work is done.", "Aaj ka saara kaam ho gaya.", "आज का सारा काम हो गया।"],
  nothingToday: ["Nothing is planned for today.", "Aaj kuch planned nahi.", "आज कुछ तय नहीं।"],
  ahead: ["{n} days ahead", "{n} din aage", "{n} दिन आगे"],
  aheadOne: ["1 day ahead", "1 din aage", "1 दिन आगे"],
  onTrack: ["On track", "Sahi raaste par", "सही राह पर"],
  behind: ["{n} days behind", "{n} din peeche", "{n} दिन पीछे"],
  behindOne: ["1 day behind", "1 din peeche", "1 दिन पीछे"],
  dayOff: ["Day off today", "Aaj chhutti", "आज छुट्टी"],
  now: ["Now · task {i} of {n}", "Abhi · kaam {i} / {n}", "अभी · काम {i} / {n}"],
  min: ["{m} min", "{m} min", "{m} मिनट"],
  resume: ["Resume", "Jaari rakho", "जारी रखें"],
  start: ["Start", "Shuru karo", "शुरू करें"],
  askWhy: ["Ask why it fails", "Fail kyun? Poochho", "क्यों फेल? पूछें"],
  tests: ["{passed} of {total} tests", "{total} me se {passed} test", "{total} में से {passed} टेस्ट"],
  stWrong: ["Wrong answer", "Galat jawab", "गलत उत्तर"],
  stTime: ["Time limit", "Time limit", "समय सीमा पार"],
  stMemory: ["Memory limit", "Memory limit", "मेमोरी सीमा पार"],
  stRuntime: ["Runtime error", "Runtime error", "रनटाइम त्रुटि"],
  stCompile: ["Compile error", "Compile error", "कंपाइल त्रुटि"],
  stOther: ["Not accepted", "Accept nahi hua", "स्वीकार नहीं"],
  kLearn: ["Lesson", "Lesson", "पाठ"],
  kPractice: ["Problem", "Problem", "प्रश्न"],
  kRevise: ["Revision", "Revision", "दोहराई"],
  kCustom: ["Your own task", "Apna kaam", "अपना काम"],
  easy: ["Easy", "Aasaan", "आसान"],
  medium: ["Medium", "Medium", "मध्यम"],
  hard: ["Hard", "Mushkil", "कठिन"],
  moved: ["moved from {date}", "{date} se khiska", "{date} से खिसका"],
  todays: ["Today's tasks", "Aaj ke kaam", "आज के काम"],
  doneOf: ["{done} of {n} done", "{n} me se {done} ho gaye", "{n} में से {done} पूरे"],
  then: ["Then", "Phir", "फिर"],
  done: ["Done", "Ho gaya", "पूरा"],
  open: ["Open", "Kholo", "खोलें"],
  heavy: ["Heavy day? Make today lighter.", "Bhaari din? Aaj halka karo.", "भारी दिन? आज हल्का करें।"],
  lighter: ["Make lighter", "Halka karo", "हल्का करें"],
  doneTitle: ["Today's work is done", "Aaj ka kaam poora", "आज का काम पूरा"],
  doneBody: ["Revision or the problem of the day, if you want more.", "Aur karna ho to revision ya aaj ka problem.", "और करना हो तो दोहराई या आज का प्रश्न।"],
  noPlanTitle: ["No plan yet", "Abhi koi plan nahi", "अभी कोई योजना नहीं"],
  noPlanBody: ["Pick a track, a deadline and your minutes a day; Today then shows each day's work.", "Track, deadline aur roz ke minute chuno; phir Aaj har din ka kaam dikhayega.", "ट्रैक, समय-सीमा और रोज़ के मिनट चुनें; फिर आज हर दिन का काम दिखाएगा।"],
  makePlan: ["Make your plan", "Plan banao", "योजना बनाएँ"],
  week: ["This week", "Is hafte", "इस सप्ताह"],
  readyFor: ["Ready for {company}", "{company} ki taiyari", "{company} की तैयारी"],
  readyBody: ["{solved} of the {of} problems {company} asked lately are solved.", "{company} ke haal ke {of} me se {solved} problem solve.", "{company} के हाल के {of} में से {solved} प्रश्न हल।"],
  streak: ["day streak", "din ki streak", "दिन लगातार"],
  freezes: ["{n} days off left", "{n} chhutti baaki", "{n} छुट्टी बाकी"],
  comingUp: ["Coming up", "Aage", "आगे"],
  potd: ["Problem of the day", "Aaj ka problem", "आज का प्रश्न"],
  solve: ["Solve", "Solve karo", "हल करें"],
  solvedToday: ["solved today", "aaj solve hua", "आज हल हुआ"],
  cards: ["{n} revision cards due", "{n} revision cards baaki", "{n} दोहराई कार्ड बाकी"],
  cardsBody: ["Due today, a few minutes", "Aaj ke, kuch minute", "आज के, कुछ मिनट"],
  revise: ["Revise", "Revise karo", "दोहराएँ"],
  sprintTest: ["Sprint {n} test", "Sprint {n} test", "स्प्रिंट {n} टेस्ट"],
  sprintBody: ["{done} of {tasks} tasks done", "{tasks} me se {done} kaam ho gaye", "{tasks} में से {done} काम पूरे"],
  live: ["Live now", "Abhi chal raha", "अभी चल रहा"],
  openContest: ["Open", "Kholo", "खोलें"],
  nothingAhead: ["Nothing coming up yet.", "Abhi aage kuch nahi.", "अभी आगे कुछ नहीं।"],
  profile: ["Your profile", "Aapki profile", "आपकी प्रोफ़ाइल"],
  signInSub: ["Or make an account", "Ya account banao", "या खाता बनाएँ"],
} as const satisfies Record<string, Tri>;
