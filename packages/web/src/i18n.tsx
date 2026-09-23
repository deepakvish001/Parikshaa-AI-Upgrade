import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * The candidate's language and bandwidth preferences (ROADMAP §9).
 *
 * The interface is translated into Hindi; a question can additionally be
 * translated into any of the languages below, and a candidate reading one of
 * those sees its questions in it with the interface in English. Both choices
 * are kept on this device, like a reading-glasses setting: nothing about them
 * is sent to the server or recorded against the candidate.
 */

export type UiLocale = "en" | "hi";
export type Language = "en" | "hi" | "bn" | "ta" | "te" | "mr" | "gu" | "kn" | "ml" | "pa" | "or";

/** Each language by its own name, as a speaker looks for it. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  hi: "हिन्दी",
  bn: "বাংলা",
  ta: "தமிழ்",
  te: "తెలుగు",
  mr: "मराठी",
  gu: "ગુજરાતી",
  kn: "ಕನ್ನಡ",
  ml: "മലയാളം",
  pa: "ਪੰਜਾਬੀ",
  or: "ଓଡ଼ିଆ",
};

const en = {
  "prefs.region": "Reading preferences",
  "prefs.language": "Language",
  "prefs.lite": "Low-bandwidth mode",
  "prefs.liteHint": "Less data: no live typing of follow-ups, a plain code editor, fewer check-ins.",

  "exam.loading": "Loading your exam…",
  "exam.loadFailed": "Could not load this attempt. The access code may have expired.",
  "exam.answeredOf": "{answered} of {total} answered",
  "exam.timeUp": " · time is up",
  "exam.timeLeft": " · {time} left",
  "exam.state.in_progress": "Attempt in progress",
  "exam.state.created": "Attempt not started",
  "exam.state.submitted": "Attempt submitted",
  "exam.state.graded": "Attempt graded",
  "exam.state.void": "Attempt void",
  "exam.offline": "You are offline. Keep going — what you type is kept on this device and sent when the connection returns.",
  "exam.voidTitle": "This attempt was set aside",
  "exam.voidNote": "Your record below is unchanged and still checks out. If you disagree with this, it is what you take to your institution.",
  "exam.marks": "{n} marks",
  "exam.showOriginal": "Show the original (English)",
  "exam.showTranslated": "Show in {language}",
  "exam.saveAnswer": "Save answer",
  "exam.saveFinal": "Save final answer",
  "exam.saved": "Saved",
  "exam.keptOffline": "Kept on this device — will send when you're back online",
  "exam.draftSaved": "Draft saved",
  "exam.saving": "Saving…",
  "exam.submit": "Submit attempt",
  "exam.submitting": "Submitting…",
  "exam.submitNote": "You cannot change your answers after this.",

  "announce.region": "Announcements",
  "announce.from": "From the invigilators",
  "announce.gotIt": "Got it",

  "probe.region": "Follow-up question",
  "probe.eyebrow": "A follow-up on your answer",
  "probe.replyLabel": "Your reply to the follow-up",
  "probe.placeholder": "In your own words.",
  "probe.send": "Send reply",
  "probe.sending": "Sending…",
  "probe.takeTime": "Take the time you need.",
  "probe.failed": "Could not send that reply. Try again.",

  "gate.prompt": "Paste the access code your institution gave you for this exam.",
  "gate.code": "Access code",
  "gate.begin": "Begin",
  "gate.noSurveillance":
    "This exam uses no webcam, no screen capture and no keystroke monitoring. You will be asked a short follow-up question about one or two of your answers.",

  "invite.opening": "Opening your test…",
  "invite.earlyRegion": "Not open yet",
  "invite.opensOn": "Your test opens on",
  "invite.earlyNote": "Keep this page open and it will let you in at that time, or come back to the same link then. Nothing has started yet.",
  "invite.closedRegion": "Closed",
  "invite.closedOn": "This test closed on {when}.",
  "invite.closedNote": "If you think you should still be able to take it, contact whoever sent you the link.",
  "invite.invalidRegion": "Invalid link",
  "invite.invalid": "This link does not work.",
  "invite.invalidNote": "Ask whoever sent it for a new one. Links are personal and stop working if they are withdrawn.",
  "invite.haveCode": "I have an access code instead",
  "invite.unavailableRegion": "Cannot start yet",
  "invite.unavailable": "This test cannot start just now.",
  "invite.unavailableNote": "Nothing has started and no time has been used. Contact whoever sent you the link; they can fix this on their side.",
  "invite.offlineRegion": "No connection",
  "invite.offline": "Could not reach the server.",
  "invite.tryAgain": "Try again",

  "notice.heading": "Before you start: your data",
  "notice.responsible": " is responsible for the data collected while you take this test. Your time has not started yet.",
  "notice.why": "Why",
  "notice.collected": "What is collected",
  "notice.kept": "How long it is kept",
  "notice.keptFor": "{days} days after you finish. After that it is erased: your answers and your details can no longer be read by anyone.",
  "notice.rights": "Your rights",
  "notice.grievance": "Grievance officer",
  "notice.agree": "I have read this and agree to my data being used as it describes",
  "notice.start": "Agree and start the test",
  "notice.version": "Notice version {version}",

  "receipt.region": "Your record",
  "receipt.fingerprint":
    "This is the fingerprint of everything recorded during your attempt. Keep it. If the record is ever questioned, it proves which version you were shown.",
  "receipt.download": "Download receipt",
  "receipt.check": "Check this record",
  "receipt.checking": "Checking…",
  "receipt.entries": "{n} entries",
  "receipt.myData": "Download my data",
  "receipt.sealedNote":
    "What you wrote is sealed in this record, so that it can be erased without breaking it. “Download my data” gives you a readable copy of everything held about you.",
  "receipt.myDataFailed": "Could not fetch your data just now. Try again in a moment.",
  "receipt.verified": "Checked in this browser: {n} entries, unbroken. Every entry still matches what was written.",
  "receipt.failed": "This record does not check out: entry {seq} shows {reason}. Keep this file and raise it with your institution.",
  "receipt.opensLater": "The full record opens once your attempt is closed.",

  "code.run": "Run examples",
  "code.running": "Running…",
  "code.runNote": "Running is for you; only what you save is marked.",
  "code.runMine": "Run on my input",
  "code.myInput": "Your own input",
  "code.examples": "Examples",
  "code.input": "Input",
  "code.output": "Output",
} as const;

export type MessageKey = keyof typeof en;

const hi: Record<MessageKey, string> = {
  "prefs.region": "पढ़ने की सुविधाएँ",
  "prefs.language": "भाषा",
  "prefs.lite": "कम बैंडविड्थ मोड",
  "prefs.liteHint": "कम डेटा: अनुवर्ती प्रश्न एक साथ आते हैं, सादा कोड एडिटर, कम बार संपर्क।",

  "exam.loading": "आपकी परीक्षा लोड हो रही है…",
  "exam.loadFailed": "यह प्रयास लोड नहीं हो सका। हो सकता है आपके ऐक्सेस कोड की अवधि समाप्त हो गई हो।",
  "exam.answeredOf": "{total} में से {answered} के उत्तर दिए",
  "exam.timeUp": " · समय समाप्त",
  "exam.timeLeft": " · {time} बाकी",
  "exam.state.in_progress": "प्रयास जारी है",
  "exam.state.created": "प्रयास शुरू नहीं हुआ",
  "exam.state.submitted": "प्रयास जमा हो गया",
  "exam.state.graded": "प्रयास का मूल्यांकन हो गया",
  "exam.state.void": "प्रयास अलग रखा गया",
  "exam.offline": "आप ऑफ़लाइन हैं। लिखते रहिए — आप जो लिखते हैं वह इसी डिवाइस पर सुरक्षित रहता है और कनेक्शन लौटते ही भेज दिया जाएगा।",
  "exam.voidTitle": "यह प्रयास अलग रखा गया",
  "exam.voidNote": "नीचे आपका रिकॉर्ड बिना बदले है और अब भी सत्यापित होता है। अगर आप इससे असहमत हैं, तो यही रिकॉर्ड अपनी संस्था के पास ले जाएँ।",
  "exam.marks": "{n} अंक",
  "exam.showOriginal": "मूल (अंग्रेज़ी) में दिखाएँ",
  "exam.showTranslated": "{language} में दिखाएँ",
  "exam.saveAnswer": "उत्तर सहेजें",
  "exam.saveFinal": "अंतिम उत्तर सहेजें",
  "exam.saved": "सहेजा गया",
  "exam.keptOffline": "इस डिवाइस पर रखा गया — ऑनलाइन होते ही भेजा जाएगा",
  "exam.draftSaved": "ड्राफ़्ट सहेजा गया",
  "exam.saving": "सहेजा जा रहा है…",
  "exam.submit": "प्रयास जमा करें",
  "exam.submitting": "जमा हो रहा है…",
  "exam.submitNote": "इसके बाद आप अपने उत्तर नहीं बदल सकेंगे।",

  "announce.region": "घोषणाएँ",
  "announce.from": "निरीक्षकों की ओर से",
  "announce.gotIt": "ठीक है",

  "probe.region": "अनुवर्ती प्रश्न",
  "probe.eyebrow": "आपके उत्तर पर एक अनुवर्ती प्रश्न",
  "probe.replyLabel": "अनुवर्ती प्रश्न का आपका उत्तर",
  "probe.placeholder": "अपने शब्दों में।",
  "probe.send": "उत्तर भेजें",
  "probe.sending": "भेजा जा रहा है…",
  "probe.takeTime": "जितना समय चाहिए, लीजिए।",
  "probe.failed": "उत्तर नहीं भेजा जा सका। फिर से कोशिश करें।",

  "gate.prompt": "इस परीक्षा के लिए आपकी संस्था द्वारा दिया गया ऐक्सेस कोड यहाँ चिपकाएँ।",
  "gate.code": "ऐक्सेस कोड",
  "gate.begin": "शुरू करें",
  "gate.noSurveillance":
    "इस परीक्षा में न वेबकैम है, न स्क्रीन कैप्चर, न कीस्ट्रोक निगरानी। आपके एक या दो उत्तरों पर आपसे एक छोटा अनुवर्ती प्रश्न पूछा जाएगा।",

  "invite.opening": "आपकी परीक्षा खुल रही है…",
  "invite.earlyRegion": "अभी खुली नहीं है",
  "invite.opensOn": "आपकी परीक्षा खुलेगी",
  "invite.earlyNote": "यह पेज खुला रखें, उस समय यह आपको अपने आप अंदर ले जाएगा — या तब इसी लिंक पर लौटें। अभी कुछ शुरू नहीं हुआ है।",
  "invite.closedRegion": "बंद",
  "invite.closedOn": "यह परीक्षा {when} को बंद हो गई।",
  "invite.closedNote": "अगर आपको लगता है कि आपको अब भी यह परीक्षा देने दी जानी चाहिए, तो लिंक भेजने वाले से संपर्क करें।",
  "invite.invalidRegion": "अमान्य लिंक",
  "invite.invalid": "यह लिंक काम नहीं करता।",
  "invite.invalidNote": "जिसने भेजा है उनसे नया लिंक माँगें। लिंक व्यक्तिगत होते हैं और वापस लिए जाने पर काम करना बंद कर देते हैं।",
  "invite.haveCode": "मेरे पास ऐक्सेस कोड है",
  "invite.unavailableRegion": "अभी शुरू नहीं हो सकती",
  "invite.unavailable": "यह परीक्षा अभी शुरू नहीं हो सकती।",
  "invite.unavailableNote": "कुछ शुरू नहीं हुआ है और आपका कोई समय नहीं लगा है। लिंक भेजने वाले से संपर्क करें; वे इसे अपनी ओर से ठीक कर सकते हैं।",
  "invite.offlineRegion": "कनेक्शन नहीं",
  "invite.offline": "सर्वर तक नहीं पहुँच सके।",
  "invite.tryAgain": "फिर से कोशिश करें",

  "notice.heading": "शुरू करने से पहले: आपका डेटा",
  "notice.responsible": " इस परीक्षा के दौरान एकत्र किए गए डेटा के लिए ज़िम्मेदार है। आपका समय अभी शुरू नहीं हुआ है।",
  "notice.why": "क्यों",
  "notice.collected": "क्या एकत्र किया जाता है",
  "notice.kept": "यह कितने समय तक रखा जाता है",
  "notice.keptFor": "आपके समाप्त करने के {days} दिन बाद तक। उसके बाद इसे मिटा दिया जाता है: आपके उत्तर और आपका विवरण फिर कोई नहीं पढ़ सकता।",
  "notice.rights": "आपके अधिकार",
  "notice.grievance": "शिकायत अधिकारी",
  "notice.agree": "मैंने इसे पढ़ लिया है और मैं सहमत हूँ कि मेरे डेटा का उपयोग ऊपर बताए अनुसार हो",
  "notice.start": "सहमत हूँ, परीक्षा शुरू करें",
  "notice.version": "सूचना संस्करण {version}",

  "receipt.region": "आपका रिकॉर्ड",
  "receipt.fingerprint":
    "यह आपके प्रयास के दौरान दर्ज हर चीज़ की छाप (फ़िंगरप्रिंट) है। इसे संभालकर रखें। अगर कभी रिकॉर्ड पर सवाल उठे, तो यह साबित करता है कि आपको कौन-सा संस्करण दिखाया गया था।",
  "receipt.download": "रसीद डाउनलोड करें",
  "receipt.check": "इस रिकॉर्ड की जाँच करें",
  "receipt.checking": "जाँच हो रही है…",
  "receipt.entries": "{n} प्रविष्टियाँ",
  "receipt.myData": "मेरा डेटा डाउनलोड करें",
  "receipt.sealedNote":
    "आपने जो लिखा वह इस रिकॉर्ड में सीलबंद है, ताकि रिकॉर्ड तोड़े बिना उसे मिटाया जा सके। “मेरा डेटा डाउनलोड करें” से आपके बारे में रखी हर जानकारी की पढ़ने योग्य प्रति मिलती है।",
  "receipt.myDataFailed": "अभी आपका डेटा नहीं मिल सका। थोड़ी देर में फिर कोशिश करें।",
  "receipt.verified": "इस ब्राउज़र में जाँचा गया: {n} प्रविष्टियाँ, कोई कड़ी नहीं टूटी। हर प्रविष्टि अब भी वही है जो लिखी गई थी।",
  "receipt.failed": "यह रिकॉर्ड सही नहीं निकला: प्रविष्टि {seq} में {reason} है। यह फ़ाइल संभालकर रखें और अपनी संस्था के सामने उठाएँ।",
  "receipt.opensLater": "पूरा रिकॉर्ड आपका प्रयास बंद होने के बाद खुलता है।",

  "code.run": "उदाहरण चलाएँ",
  "code.running": "चल रहा है…",
  "code.runNote": "चलाना आपकी सुविधा के लिए है; अंक केवल सहेजे गए उत्तर पर मिलते हैं।",
  "code.runMine": "मेरे इनपुट पर चलाएँ",
  "code.myInput": "आपका अपना इनपुट",
  "code.examples": "उदाहरण",
  "code.input": "इनपुट",
  "code.output": "आउटपुट",
};

const MESSAGES: Record<UiLocale, Record<MessageKey, string>> = { en, hi };

/** The interface's language for a chosen language: Hindi, or English for the rest. */
export const uiLocaleOf = (language: Language): UiLocale => (language === "hi" ? "hi" : "en");

export function translate(locale: UiLocale, key: MessageKey, vars: Record<string, string | number> = {}): string {
  return MESSAGES[locale][key].replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

const LANGUAGE_KEY = "parikshaa.language";
const LITE_KEY = "parikshaa.lite";

const local = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Remembered for this page only.
    }
  },
};

/** What the browser says about the connection, where it says anything (Chromium). */
function slowConnection(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return connection?.saveData === true || connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g";
}

function initialLanguage(): Language {
  const stored = local.get(LANGUAGE_KEY);
  if (stored !== null && stored in LANGUAGE_NAMES) return stored as Language;
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("hi") ? "hi" : "en";
}

function initialLite(): boolean {
  const stored = local.get(LITE_KEY);
  if (stored !== null) return stored === "1";
  return typeof navigator !== "undefined" && slowConnection();
}

export interface Preferences {
  readonly language: Language;
  readonly lite: boolean;
  readonly setLanguage: (language: Language) => void;
  readonly setLite: (lite: boolean) => void;
  readonly t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const defaults: Preferences = {
  language: "en",
  lite: false,
  setLanguage: () => undefined,
  setLite: () => undefined,
  t: (key, vars) => translate("en", key, vars),
};

const PreferencesContext = createContext<Preferences>(defaults);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [lite, setLiteState] = useState<boolean>(initialLite);

  const setLanguage = useCallback((next: Language) => {
    local.set(LANGUAGE_KEY, next);
    setLanguageState(next);
  }, []);
  const setLite = useCallback((next: boolean) => {
    local.set(LITE_KEY, next ? "1" : "0");
    setLiteState(next);
  }, []);

  // Screen readers pronounce the page by this.
  const ui = uiLocaleOf(language);
  useEffect(() => {
    document.documentElement.lang = ui;
  }, [ui]);

  const value = useMemo<Preferences>(
    () => ({ language, lite, setLanguage, setLite, t: (key, vars) => translate(ui, key, vars) }),
    [language, lite, setLanguage, setLite, ui],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export const usePreferences = (): Preferences => useContext(PreferencesContext);

/**
 * The language picker and the low-bandwidth switch. `offered` adds the
 * languages this exam's questions are translated into to English and Hindi.
 */
export function PreferencesBar({ offered = [] }: { offered?: readonly Language[] }) {
  const { language, lite, setLanguage, setLite, t } = usePreferences();
  const choices = [...new Set<Language>(["en", "hi", ...offered, language])];
  return (
    <div className="prefs" role="group" aria-label={t("prefs.region")}>
      <span className="inline">
        <label htmlFor="pref-language">{t("prefs.language")}</label>
        <select id="pref-language" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
          {choices.map((l) => (
            <option key={l} value={l} lang={l}>
              {LANGUAGE_NAMES[l]}
            </option>
          ))}
        </select>
      </span>
      <label className="inline" title={t("prefs.liteHint")}>
        <input type="checkbox" checked={lite} onChange={(e) => setLite(e.target.checked)} /> {t("prefs.lite")}
      </label>
    </div>
  );
}
