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

  "section.region": "Sections",
  "section.done": "done",
  "section.current": "now",
  "section.upcoming": "to come",
  "section.timeLeft": "{time} left in this section",
  "section.timeUp": "The time for {title} is up. What you had saved is kept.",
  "section.next": "Finish {title} and go on",
  "section.confirm": "You cannot come back to {title} once you leave it.",
  "section.confirmYes": "Leave {title}",
  "section.stay": "Stay",
  "section.introEyebrow": "Next section",
  "section.questions": "{n} questions",
  "section.timed": "{minutes} minutes of its own, from when you press Start",
  "section.untimed": "No time of its own: the test's time applies",
  "section.lockNote": "Sections are taken in order. Once you leave one, it is locked.",
  "section.start": "Start {title}",
  "section.starting": "Starting…",
  "section.last": "This is the last section.",

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
    "If a test uses your camera, it says so before it starts, and exactly what it takes. You will be asked a short follow-up question about one or two of your answers.",

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

  "camera.heading": "This test uses your camera",
  "camera.intro": "Before it starts, here is exactly what it will take:",
  "camera.identity": "A photo of you, and one of your photo ID, before the first question.",
  "camera.snapshots": "A photo from your camera about every {minutes} min while you answer.",
  "camera.events": "Whether you leave this tab or full screen, and when you copy or paste.",
  "camera.promise": "Invigilators look at these. None of it marks you down by itself, and it is erased with the rest of your data.",
  "camera.allow": "Allow the camera",
  "camera.preview": "What your camera sees",
  "camera.start": "My camera works — start the test",
  "camera.denied": "The camera was blocked. Allow it for this site in your browser's address bar, then try again.",
  "camera.missing": "No camera could be opened. Check it is connected and not in use by another app.",
  "camera.unsupported": "This browser cannot use a camera here. Use a recent Chrome, Edge, Firefox or Safari.",
  "camera.on": "Camera on",
  "camera.offBanner": "Your camera has stopped. Turn it back on and reload this page — your answers are kept.",

  "identity.heading": "Confirm who you are",
  "identity.steps": "Steps",
  "identity.stepSelfie": "Your photo",
  "identity.stepId": "Your photo ID",
  "identity.stepSend": "Check and send",
  "identity.selfieHint": "Look at the camera, in good light, with nothing covering your face.",
  "identity.idHint": "Hold your photo ID (college ID, Aadhaar, PAN, licence) up to the camera, photo side facing it.",
  "identity.reviewHint": "Check both photos are clear. Retake either if not.",
  "identity.takeSelfie": "Take my photo",
  "identity.takeId": "Take a photo of my ID",
  "identity.retakeSelfie": "Retake my photo",
  "identity.retakeId": "Retake the ID photo",
  "identity.selfieAlt": "Your photo",
  "identity.idAlt": "Your photo ID",
  "identity.send": "Send and start answering",
  "identity.sending": "Sending…",
  "identity.note": "An invigilator compares the two photos. Only they, and not the grading, ever see them.",
  "identity.failed": "The photos could not be sent. Check your connection and try again.",
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

  "section.region": "खंड",
  "section.done": "पूरा",
  "section.current": "अभी",
  "section.upcoming": "आगे",
  "section.timeLeft": "इस खंड में {time} बाकी",
  "section.timeUp": "{title} का समय समाप्त हो गया। जो आपने सहेजा था वह रखा गया है।",
  "section.next": "{title} पूरा करें और आगे बढ़ें",
  "section.confirm": "{title} छोड़ने के बाद आप उस पर वापस नहीं आ सकेंगे।",
  "section.confirmYes": "{title} छोड़ें",
  "section.stay": "यहीं रहें",
  "section.introEyebrow": "अगला खंड",
  "section.questions": "{n} प्रश्न",
  "section.timed": "इसका अपना {minutes} मिनट का समय, Start दबाने से शुरू",
  "section.untimed": "इसका अलग समय नहीं है: परीक्षा का समय लागू है",
  "section.lockNote": "खंड क्रम से दिए जाते हैं। एक बार छोड़ने पर खंड बंद हो जाता है।",
  "section.start": "{title} शुरू करें",
  "section.starting": "शुरू हो रहा है…",
  "section.last": "यह अंतिम खंड है।",

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
    "अगर कोई परीक्षा आपके कैमरे का उपयोग करती है, तो शुरू होने से पहले बताती है, और ठीक-ठीक क्या लेती है। आपके एक या दो उत्तरों पर आपसे एक छोटा अनुवर्ती प्रश्न पूछा जाएगा।",

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

  "camera.heading": "यह परीक्षा आपके कैमरे का उपयोग करती है",
  "camera.intro": "शुरू होने से पहले, ठीक-ठीक बताया जा रहा है कि क्या लिया जाएगा:",
  "camera.identity": "पहले प्रश्न से पहले आपकी एक फ़ोटो, और आपके फ़ोटो पहचान-पत्र की एक फ़ोटो।",
  "camera.snapshots": "उत्तर देते समय लगभग हर {minutes} मिनट में आपके कैमरे से एक फ़ोटो।",
  "camera.events": "क्या आप यह टैब या फ़ुल स्क्रीन छोड़ते हैं, और कब कॉपी या पेस्ट करते हैं।",
  "camera.promise": "निरीक्षक इन्हें देखते हैं। इनमें से कोई भी चीज़ अपने आप आपके अंक नहीं काटती, और ये आपके बाकी डेटा के साथ मिटा दी जाती हैं।",
  "camera.allow": "कैमरा चालू करें",
  "camera.preview": "आपका कैमरा क्या देख रहा है",
  "camera.start": "मेरा कैमरा काम कर रहा है — परीक्षा शुरू करें",
  "camera.denied": "कैमरा रोक दिया गया। ब्राउज़र के एड्रेस बार में इस साइट के लिए कैमरा चालू करें, फिर दोबारा कोशिश करें।",
  "camera.missing": "कोई कैमरा नहीं खुल सका। देखें कि वह जुड़ा है और कोई दूसरा ऐप उसे इस्तेमाल नहीं कर रहा।",
  "camera.unsupported": "यह ब्राउज़र यहाँ कैमरा इस्तेमाल नहीं कर सकता। नया Chrome, Edge, Firefox या Safari इस्तेमाल करें।",
  "camera.on": "कैमरा चालू",
  "camera.offBanner": "आपका कैमरा बंद हो गया है। उसे फिर से चालू करें और यह पेज रीलोड करें — आपके उत्तर सुरक्षित हैं।",

  "identity.heading": "अपनी पहचान की पुष्टि करें",
  "identity.steps": "चरण",
  "identity.stepSelfie": "आपकी फ़ोटो",
  "identity.stepId": "आपका फ़ोटो पहचान-पत्र",
  "identity.stepSend": "जाँचें और भेजें",
  "identity.selfieHint": "अच्छी रोशनी में कैमरे की ओर देखें, चेहरा ढका न हो।",
  "identity.idHint": "अपना फ़ोटो पहचान-पत्र (कॉलेज आईडी, आधार, पैन, लाइसेंस) कैमरे के सामने रखें, फ़ोटो वाली तरफ़ कैमरे की ओर।",
  "identity.reviewHint": "देखें कि दोनों फ़ोटो साफ़ हैं। नहीं तो दोबारा लें।",
  "identity.takeSelfie": "मेरी फ़ोटो लें",
  "identity.takeId": "मेरे पहचान-पत्र की फ़ोटो लें",
  "identity.retakeSelfie": "मेरी फ़ोटो दोबारा लें",
  "identity.retakeId": "पहचान-पत्र की फ़ोटो दोबारा लें",
  "identity.selfieAlt": "आपकी फ़ोटो",
  "identity.idAlt": "आपका फ़ोटो पहचान-पत्र",
  "identity.send": "भेजें और उत्तर देना शुरू करें",
  "identity.sending": "भेजा जा रहा है…",
  "identity.note": "एक निरीक्षक दोनों फ़ोटो की तुलना करता है। इन्हें केवल वही देखते हैं, मूल्यांकन नहीं।",
  "identity.failed": "फ़ोटो नहीं भेजी जा सकीं। अपना कनेक्शन जाँचें और दोबारा कोशिश करें।",
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
