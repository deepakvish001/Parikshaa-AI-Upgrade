import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { bn } from "./locales/bn.ts";
import { gu } from "./locales/gu.ts";
import { kn } from "./locales/kn.ts";
import { ml } from "./locales/ml.ts";
import { mr } from "./locales/mr.ts";
import { or } from "./locales/or.ts";
import { pa } from "./locales/pa.ts";
import { ta } from "./locales/ta.ts";
import { te } from "./locales/te.ts";

/**
 * The candidate's language and bandwidth preferences (ROADMAP §9).
 *
 * The interface is in English, Hindi, and nine more of the Eighth Schedule's
 * languages; a question can be translated into the same languages. A string
 * a language's table does not have is shown in English — so a table can grow
 * without the page ever showing a key. The privacy notice's wording stays in
 * English or Hindi, the languages its text is reviewed in (see
 * `packages/api/src/privacy.ts`). Both choices are kept on this device, like
 * a reading-glasses setting: nothing about them is sent to the server or
 * recorded against the candidate.
 */

export type Language = "en" | "hi" | "bn" | "ta" | "te" | "mr" | "gu" | "kn" | "ml" | "pa" | "or";
export type UiLocale = Language;

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
  "brand.tagline": "Fair assessment, with a record you can check",
  "brand.foot": "Every answer is kept in a tamper-evident record. When you finish, you get a receipt to check it yourself.",
  "exam.timeUp": "Time is up",
  "exam.timeLeft": "{time} left",
  "exam.state.in_progress": "Attempt in progress",
  "exam.state.created": "Attempt not started",
  "exam.state.submitted": "Attempt submitted",
  "exam.state.graded": "Attempt graded",
  "exam.state.void": "Attempt void",
  "exam.offline": "You are offline. Keep going — what you type is kept on this device and sent when the connection returns.",
  "exam.voidTitle": "This attempt was set aside",
  "exam.voidNote": "Your record below is unchanged and still checks out. If you disagree with this, it is what you take to your institution.",
  "exam.marks": "{n} marks",
  "exam.mark": "1 mark",
  "exam.negative": "−{n} if wrong",
  "exam.chooseAll": "Choose every option that is right.",
  "exam.markReview": "Mark for review",
  "exam.marked": "Marked for review",
  "palette.region": "Questions",
  "palette.summary": "Done {answered}/{total} · For review {marked}",
  "palette.answered": "Answered",
  "palette.notAnswered": "Not answered",
  "palette.draft": "Typed, not saved",
  "palette.marked": "Marked for review",
  "palette.item": "Question {n}: {state}",
  "passage.eyebrow": "Passage",
  "passage.for": "Questions {from}–{to}",
  "passage.forOne": "Question {n}",
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
  "exam.questionOf": "Question {n} of {total}",
  "exam.prev": "Previous",
  "exam.next": "Next",
  "exam.saveNext": "Save & next",
  "exam.saveFinalNext": "Save final answer & next",
  "exam.markNext": "Mark for review & next",
  "exam.clear": "Clear response",
  "exam.timeLeftLabel": "Time left",
  "exam.kind.single": "Single correct",
  "exam.kind.multiple": "Multiple correct",
  "exam.kind.numeric": "Numerical answer",
  "exam.kind.short": "Written answer",
  "exam.kind.code": "Coding",
  "palette.notVisited": "Not visited",
  "palette.answeredMarked": "Answered & marked",
  "palette.counted": "(counted for evaluation)",
  "submit.title": "Submit your attempt?",
  "submit.confirm": "Yes, submit",
  "submit.back": "Keep working",
  "submit.markedNote": "Answers marked for review are submitted as they are.",
  "submit.unanswered": "{n} questions have no answer yet.",

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

  "code.run": "Run",
  "code.running": "Running…",
  "code.runNote": "Run tries your code on the examples, or on a case of your own. Submit saves it and checks it against every test.",
  "code.submit": "Submit",
  "code.submitFinal": "Submit final answer",
  "code.submitting": "Submitting…",
  "code.examples": "Examples",
  "code.example": "Example {n}",
  "code.input": "Input",
  "code.output": "Output",
  "code.expected": "Expected",
  "code.stdout": "Printed",
  "code.explanation": "Explanation",
  "code.inputFormat": "Input format",
  "code.outputFormat": "Output format",
  "code.constraints": "Constraints",
  "code.language": "Language",
  "code.workspace": "Coding workspace for question {n}",
  "code.problem": "Problem",
  "code.editor": "Code",
  "code.editorFor": "Code for question {n}",
  "code.testcase": "Testcase",
  "code.result": "Test result",
  "code.case": "Case {n}",
  "code.custom": "Custom",
  "code.customStdin": "Your own input, given to the program on standard input.",
  "code.customArgs": "One value per parameter, written as in the examples.",
  "code.nothingYet": "Run your code to see what it does here.",
  "code.fullscreen": "Full screen",
  "code.exitFullscreen": "Back to the paper",
  "code.reset": "Reset",
  "code.resetConfirm": "Replace your code with the starter code? This cannot be undone.",
  "code.dark": "Dark editor",
  "code.smaller": "Smaller text",
  "code.larger": "Larger text",
  "code.shortcuts": "Ctrl+Enter runs · Ctrl+' submits",
  "code.passedOf": "{passed}/{total} tests passed",
  "code.examplesPass": "{passed}/{total} examples pass",
  "code.hiddenLater": "Your answer is saved. Hidden tests are checked after the test ends.",
  "code.hiddenTest": "Hidden test {n}",
  "code.test": "Test {n}",
  "code.hiddenNote": "A hidden test: only whether it passed is shown.",
  "code.runtime": "Runtime",
  "code.memory": "Memory",
  "code.notTested": "Your answer is saved. It could not be tested just now, and will be when the test is graded.",
  "code.noTests": "Your answer is saved. It is marked against the question's criteria after the test.",
  "code.cannotRun": "Code cannot be run just now. Your answer is still saved; try again in a moment.",
  "code.runFailed": "That did not complete. Your answer is still saved.",
  "code.noOutput": "(nothing)",
  "code.compileError": "Compile error",
  "code.checkerSays": "Checker",
  "code.status.passed": "Accepted",
  "code.status.wrong_answer": "Wrong answer",
  "code.status.time_limit": "Time limit exceeded",
  "code.status.memory_limit": "Memory limit exceeded",
  "code.status.runtime_error": "Runtime error",
  "code.status.output_limit": "Output limit exceeded",
  "code.status.checker_error": "Could not be checked",
  "code.status.ran": "Ran",
  "code.status.compile_error": "Compile error",
  "practice.loading": "Loading…",
  "practice.noSite": "There is no practice site here",
  "practice.noSiteHint": "Check the address with your institution. A site that is closed is not shown.",
  "practice.nav": "Practice",
  "practice.problems": "Problems",
  "practice.contests": "Contests",
  "practice.leaderboard": "Leaderboard",
  "practice.signIn": "Sign in",
  "practice.withGoogle": "Continue with Google",
  "practice.or": "or",
  "practice.googleFailed": "Signing in with Google did not work. Try again, or use your email and password.",
  "practice.verifyBanner": "Confirm your email address: we sent a link to {email}.",
  "practice.verifyRequired": "Confirm your email address to submit and to join discussions: we sent a link to {email}.",
  "practice.resend": "Send the link again",
  "practice.resent": "Sent. Check your inbox, and the spam folder.",
  "practice.verified": "Your email address is confirmed. Thank you.",
  "practice.verifyFailed": "That confirmation link is not valid. Sign in and send a new one.",
  "practice.signUp": "Create account",
  "practice.signOut": "Sign out",
  "practice.signInToSee": "Sign in to see this, and to keep your progress.",
  "practice.signInToSubmit": "Sign in to run and submit your code.",
  "practice.tagline": "Practise at your own pace. Your progress is yours; nothing here is an exam.",
  "practice.joinHint": "Create a free account to track what you have solved.",
  "practice.search": "Search problems",
  "practice.difficulty": "Difficulty",
  "practice.difficulty.easy": "Easy",
  "practice.difficulty.medium": "Medium",
  "practice.difficulty.hard": "Hard",
  "practice.allDifficulties": "All difficulties",
  "practice.status": "Status",
  "practice.allStatuses": "All",
  "practice.todo": "To do",
  "practice.attempted": "Attempted",
  "practice.solved": "Solved",
  "practice.topics": "Topics",
  "practice.noProblems": "No problems have been published yet.",
  "practice.noMatch": "No problem matches these filters.",
  "practice.title": "Title",
  "practice.acceptance": "Acceptance",
  "practice.solvedBy": "Solved by",
  "practice.solvedByN": "solved by {n}",
  "practice.tab.description": "Description",
  "practice.tab.editorial": "Editorial",
  "practice.tab.submissions": "Submissions",
  "practice.tab.discussion": "Discussion",
  "practice.notStarted": "This contest has not started yet.",
  "practice.noProblem": "There is no such problem here.",
  "practice.backToProblems": "Back to the problems",
  "practice.solvedNow": "Solved! The editorial is open now.",
  "practice.solvedInContest": "Solved! It counts on the contest's scoreboard.",
  "practice.endsIn": "Ends in {time}",
  "practice.startsIn": "Starts in {time}",
  "practice.noEditorial": "There is no editorial for this problem yet.",
  "practice.editorialLocked": "The editorial opens once you solve the problem, or after three tries.",
  "practice.editorialContest": "The editorial stays closed while the contest runs.",
  "practice.noSubmissions": "You have not submitted anything yet.",
  "practice.inContest": "Contest",
  "practice.loadCode": "Open in the editor",
  "practice.discussionHint": "Ask about the problem, not for its answer. Staff can reply, and hide what gives it away.",
  "practice.yourComment": "Write a comment",
  "practice.commentFailed": "Your comment was not posted. Try again.",
  "practice.post": "Post",
  "practice.noComments": "No comments yet.",
  "practice.staff": "Staff",
  "practice.yourAnswer": "Your answer",
  "practice.correct": "Correct!",
  "practice.incorrect": "Not quite. Try again.",
  "practice.streakN": "{n}-day streak",
  "practice.activity": "Activity",
  "practice.dayTitle": "{day}: {n} submitted, {accepted} accepted",
  "practice.less": "Less",
  "practice.more": "More",
  "practice.solvedProblems": "Solved problems",
  "practice.rank": "Rank",
  "practice.currentStreak": "Current streak",
  "practice.longestStreak": "Longest streak",
  "practice.days": "{n} days",
  "practice.oneDay": "1 day",
  "practice.activeDays": "Active days",
  "practice.recent": "Recently solved",
  "practice.nothingSolved": "Nothing solved yet.",
  "practice.startSolving": "Pick a problem",
  "practice.deleteAccount": "Delete my account",
  "practice.deleteHint": "Your name and email are removed and you are signed out everywhere. Your submissions stay, with no name on them.",
  "practice.deleteConfirm": "Delete your account? This cannot be undone.",
  "practice.leaderboardHint": "Learners by the number of problems solved.",
  "practice.noLeaders": "Nobody has solved a problem yet. Be the first.",
  "practice.name": "Name",
  "practice.you": "You",
  "practice.running": "Running now",
  "practice.upcoming": "Upcoming",
  "practice.past": "Past",
  "practice.contestsHint": "Timed rounds: solve as many as you can; ties are broken by time taken, plus 20 minutes for each wrong try.",
  "practice.noContests": "No contests are scheduled.",
  "practice.minutes": "{n} min",
  "practice.problemsN": "{n} problems",
  "practice.noContest": "There is no such contest.",
  "practice.ended": "Ended",
  "practice.problemsAtStart": "The problems appear when the contest starts.",
  "practice.scoreboard": "Scoreboard",
  "practice.scoreboardHint": "Solved first, then penalty: minutes to each solve, plus 20 for each wrong try before it.",
  "practice.noEntries": "No submissions yet.",
  "practice.penalty": "Penalty",
  "practice.signInFailed": "That email and password do not match an account here.",
  "practice.emailTaken": "There is already an account with that email here. Sign in instead.",
  "practice.tryAgain": "That did not work. Try again.",
  "practice.createAccount": "Create your account",
  "practice.welcomeBack": "Welcome back",
  "practice.signUpHint": "An account on this site only: it keeps your submissions, streak and rank.",
  "practice.signInHint": "Sign in to pick up where you left off.",
  "practice.email": "Email",
  "practice.password": "Password",
  "practice.passwordHint": "At least 12 characters.",
  "practice.haveAccount": "Already have an account?",
  "practice.newHere": "New here?",

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
  "brand.tagline": "निष्पक्ष परीक्षा, ऐसे रिकॉर्ड के साथ जिसे आप जाँच सकें",
  "brand.foot": "हर उत्तर एक छेड़छाड़-रोधी रिकॉर्ड में रखा जाता है। परीक्षा के बाद आपको उसे स्वयं जाँचने की रसीद मिलती है।",
  "exam.timeUp": "समय समाप्त",
  "exam.timeLeft": "{time} बाकी",
  "exam.state.in_progress": "प्रयास जारी है",
  "exam.state.created": "प्रयास शुरू नहीं हुआ",
  "exam.state.submitted": "प्रयास जमा हो गया",
  "exam.state.graded": "प्रयास का मूल्यांकन हो गया",
  "exam.state.void": "प्रयास अलग रखा गया",
  "exam.offline": "आप ऑफ़लाइन हैं। लिखते रहिए — आप जो लिखते हैं वह इसी डिवाइस पर सुरक्षित रहता है और कनेक्शन लौटते ही भेज दिया जाएगा।",
  "exam.voidTitle": "यह प्रयास अलग रखा गया",
  "exam.voidNote": "नीचे आपका रिकॉर्ड बिना बदले है और अब भी सत्यापित होता है। अगर आप इससे असहमत हैं, तो यही रिकॉर्ड अपनी संस्था के पास ले जाएँ।",
  "exam.marks": "{n} अंक",
  "exam.mark": "1 अंक",
  "exam.negative": "गलत पर −{n}",
  "exam.chooseAll": "हर सही विकल्प चुनें।",
  "exam.markReview": "समीक्षा के लिए चिह्नित करें",
  "exam.marked": "समीक्षा के लिए चिह्नित",
  "palette.region": "प्रश्न",
  "palette.summary": "हल {answered}/{total} · समीक्षा हेतु {marked}",
  "palette.answered": "उत्तर दिया",
  "palette.notAnswered": "उत्तर नहीं दिया",
  "palette.draft": "लिखा, सहेजा नहीं",
  "palette.marked": "समीक्षा हेतु चिह्नित",
  "palette.item": "प्रश्न {n}: {state}",
  "passage.eyebrow": "अनुच्छेद",
  "passage.for": "प्रश्न {from}–{to}",
  "passage.forOne": "प्रश्न {n}",
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
  "exam.questionOf": "प्रश्न {n} / {total}",
  "exam.prev": "पिछला",
  "exam.next": "अगला",
  "exam.saveNext": "सहेजें और आगे",
  "exam.saveFinalNext": "अंतिम उत्तर सहेजें और आगे",
  "exam.markNext": "समीक्षा के लिए चिह्नित करें और आगे",
  "exam.clear": "उत्तर हटाएँ",
  "exam.timeLeftLabel": "शेष समय",
  "exam.kind.single": "एक सही विकल्प",
  "exam.kind.multiple": "एक से अधिक सही विकल्प",
  "exam.kind.numeric": "संख्यात्मक उत्तर",
  "exam.kind.short": "लिखित उत्तर",
  "exam.kind.code": "कोडिंग",
  "palette.notVisited": "नहीं देखा",
  "palette.answeredMarked": "उत्तर दिया और चिह्नित",
  "palette.counted": "(मूल्यांकन में गिना जाएगा)",
  "submit.title": "क्या आप अपना प्रयास जमा करना चाहते हैं?",
  "submit.confirm": "हाँ, जमा करें",
  "submit.back": "काम जारी रखें",
  "submit.markedNote": "समीक्षा के लिए चिह्नित उत्तर जैसे हैं वैसे ही जमा होंगे।",
  "submit.unanswered": "{n} प्रश्नों का अभी कोई उत्तर नहीं है।",

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

  "code.run": "चलाएँ",
  "code.running": "चल रहा है…",
  "code.runNote": "चलाएँ से आपका कोड उदाहरणों पर या आपके अपने केस पर चलता है। जमा करें से उत्तर सहेजा जाता है और हर टेस्ट पर जाँचा जाता है।",
  "code.submit": "जमा करें",
  "code.submitFinal": "अंतिम उत्तर जमा करें",
  "code.submitting": "जमा हो रहा है…",
  "code.examples": "उदाहरण",
  "code.example": "उदाहरण {n}",
  "code.input": "इनपुट",
  "code.output": "आउटपुट",
  "code.expected": "अपेक्षित",
  "code.stdout": "प्रिंट किया गया",
  "code.explanation": "व्याख्या",
  "code.inputFormat": "इनपुट का रूप",
  "code.outputFormat": "आउटपुट का रूप",
  "code.constraints": "सीमाएँ",
  "code.language": "भाषा",
  "code.workspace": "प्रश्न {n} का कोडिंग क्षेत्र",
  "code.problem": "प्रश्न",
  "code.editor": "कोड",
  "code.editorFor": "प्रश्न {n} का कोड",
  "code.testcase": "टेस्ट केस",
  "code.result": "परिणाम",
  "code.case": "केस {n}",
  "code.custom": "अपना केस",
  "code.customStdin": "आपका अपना इनपुट, जो प्रोग्राम को स्टैंडर्ड इनपुट पर मिलेगा।",
  "code.customArgs": "हर पैरामीटर का एक मान, उदाहरणों की तरह लिखें।",
  "code.nothingYet": "अपना कोड चलाएँ, उसका परिणाम यहाँ दिखेगा।",
  "code.fullscreen": "पूरी स्क्रीन",
  "code.exitFullscreen": "प्रश्नपत्र पर लौटें",
  "code.reset": "रीसेट",
  "code.resetConfirm": "आपका कोड हटाकर शुरुआती कोड रखें? यह वापस नहीं होगा।",
  "code.dark": "गहरा एडिटर",
  "code.smaller": "छोटा अक्षर",
  "code.larger": "बड़ा अक्षर",
  "code.shortcuts": "Ctrl+Enter से चलाएँ · Ctrl+' से जमा करें",
  "code.passedOf": "{total} में से {passed} टेस्ट पास",
  "code.examplesPass": "{total} में से {passed} उदाहरण पास",
  "code.hiddenLater": "आपका उत्तर सहेजा गया। छिपे टेस्ट परीक्षा के बाद जाँचे जाएँगे।",
  "code.hiddenTest": "छिपा टेस्ट {n}",
  "code.test": "टेस्ट {n}",
  "code.hiddenNote": "छिपा टेस्ट: केवल यह दिखता है कि वह पास हुआ या नहीं।",
  "code.runtime": "समय",
  "code.memory": "मेमोरी",
  "code.notTested": "आपका उत्तर सहेजा गया। अभी इसे जाँचा नहीं जा सका; अंक देते समय जाँचा जाएगा।",
  "code.noTests": "आपका उत्तर सहेजा गया। परीक्षा के बाद प्रश्न के मानदंडों पर अंक दिए जाएँगे।",
  "code.cannotRun": "अभी कोड नहीं चल सकता। आपका उत्तर सुरक्षित है; थोड़ी देर में फिर कोशिश करें।",
  "code.runFailed": "यह पूरा नहीं हुआ। आपका उत्तर सुरक्षित है।",
  "code.noOutput": "(कुछ नहीं)",
  "code.compileError": "कम्पाइल त्रुटि",
  "code.checkerSays": "जाँचकर्ता",
  "code.status.passed": "स्वीकृत",
  "code.status.wrong_answer": "गलत उत्तर",
  "code.status.time_limit": "समय सीमा पार",
  "code.status.memory_limit": "मेमोरी सीमा पार",
  "code.status.runtime_error": "रनटाइम त्रुटि",
  "code.status.output_limit": "आउटपुट सीमा पार",
  "code.status.checker_error": "जाँचा नहीं जा सका",
  "code.status.ran": "चला",
  "code.status.compile_error": "कंपाइल त्रुटि",
  "practice.loading": "लोड हो रहा है…",
  "practice.noSite": "यहाँ कोई अभ्यास साइट नहीं है",
  "practice.noSiteHint": "अपने संस्थान से पता जाँच लें। बंद साइट नहीं दिखाई जाती।",
  "practice.nav": "अभ्यास",
  "practice.problems": "प्रश्न",
  "practice.contests": "प्रतियोगिताएँ",
  "practice.leaderboard": "लीडरबोर्ड",
  "practice.signIn": "साइन इन",
  "practice.withGoogle": "Google से जारी रखें",
  "practice.or": "या",
  "practice.googleFailed": "Google से साइन इन नहीं हो सका। फिर कोशिश करें, या ईमेल और पासवर्ड से साइन इन करें।",
  "practice.verifyBanner": "अपना ईमेल पता पुष्ट करें: हमने {email} पर एक लिंक भेजा है।",
  "practice.verifyRequired": "उत्तर जमा करने और चर्चा में भाग लेने के लिए अपना ईमेल पुष्ट करें: हमने {email} पर एक लिंक भेजा है।",
  "practice.resend": "लिंक फिर से भेजें",
  "practice.resent": "भेज दिया। अपना इनबॉक्स और स्पैम फ़ोल्डर देखें।",
  "practice.verified": "आपका ईमेल पता पुष्ट हो गया। धन्यवाद।",
  "practice.verifyFailed": "यह पुष्टि लिंक मान्य नहीं है। साइन इन करके नया लिंक भेजें।",
  "practice.signUp": "खाता बनाएँ",
  "practice.signOut": "साइन आउट",
  "practice.signInToSee": "इसे देखने और अपनी प्रगति सहेजने के लिए साइन इन करें।",
  "practice.signInToSubmit": "कोड चलाने और जमा करने के लिए साइन इन करें।",
  "practice.tagline": "अपनी गति से अभ्यास करें। आपकी प्रगति आपकी है; यहाँ कुछ भी परीक्षा नहीं है।",
  "practice.joinHint": "हल किए प्रश्नों का हिसाब रखने के लिए मुफ़्त खाता बनाएँ।",
  "practice.search": "प्रश्न खोजें",
  "practice.difficulty": "कठिनाई",
  "practice.difficulty.easy": "आसान",
  "practice.difficulty.medium": "मध्यम",
  "practice.difficulty.hard": "कठिन",
  "practice.allDifficulties": "सभी कठिनाइयाँ",
  "practice.status": "स्थिति",
  "practice.allStatuses": "सभी",
  "practice.todo": "बाकी",
  "practice.attempted": "प्रयास किया",
  "practice.solved": "हल किया",
  "practice.topics": "विषय",
  "practice.noProblems": "अभी कोई प्रश्न प्रकाशित नहीं हुआ है।",
  "practice.noMatch": "इन फ़िल्टरों से कोई प्रश्न मेल नहीं खाता।",
  "practice.title": "शीर्षक",
  "practice.acceptance": "स्वीकृति",
  "practice.solvedBy": "हल करने वाले",
  "practice.solvedByN": "{n} ने हल किया",
  "practice.tab.description": "विवरण",
  "practice.tab.editorial": "हल की व्याख्या",
  "practice.tab.submissions": "जमा किए उत्तर",
  "practice.tab.discussion": "चर्चा",
  "practice.notStarted": "यह प्रतियोगिता अभी शुरू नहीं हुई है।",
  "practice.noProblem": "यहाँ ऐसा कोई प्रश्न नहीं है।",
  "practice.backToProblems": "प्रश्नों पर वापस",
  "practice.solvedNow": "हल हो गया! व्याख्या अब खुल गई है।",
  "practice.solvedInContest": "हल हो गया! यह प्रतियोगिता के स्कोरबोर्ड में गिना जाएगा।",
  "practice.endsIn": "{time} में समाप्त",
  "practice.startsIn": "{time} में शुरू",
  "practice.noEditorial": "इस प्रश्न की व्याख्या अभी नहीं है।",
  "practice.editorialLocked": "व्याख्या प्रश्न हल करने पर, या तीन प्रयासों के बाद खुलती है।",
  "practice.editorialContest": "प्रतियोगिता चलने तक व्याख्या बंद रहती है।",
  "practice.noSubmissions": "आपने अभी तक कुछ जमा नहीं किया है।",
  "practice.inContest": "प्रतियोगिता",
  "practice.loadCode": "एडिटर में खोलें",
  "practice.discussionHint": "प्रश्न के बारे में पूछें, उसका उत्तर नहीं। स्टाफ़ जवाब दे सकता है और उत्तर बताने वाली बातें छिपा सकता है।",
  "practice.yourComment": "टिप्पणी लिखें",
  "practice.commentFailed": "आपकी टिप्पणी पोस्ट नहीं हुई। फिर कोशिश करें।",
  "practice.post": "पोस्ट करें",
  "practice.noComments": "अभी कोई टिप्पणी नहीं।",
  "practice.staff": "स्टाफ़",
  "practice.yourAnswer": "आपका उत्तर",
  "practice.correct": "सही!",
  "practice.incorrect": "पूरा सही नहीं। फिर कोशिश करें।",
  "practice.streakN": "{n} दिन की लगातार प्रगति",
  "practice.activity": "गतिविधि",
  "practice.dayTitle": "{day}: {n} जमा, {accepted} स्वीकृत",
  "practice.less": "कम",
  "practice.more": "ज़्यादा",
  "practice.solvedProblems": "हल किए प्रश्न",
  "practice.rank": "रैंक",
  "practice.currentStreak": "मौजूदा सिलसिला",
  "practice.longestStreak": "सबसे लंबा सिलसिला",
  "practice.days": "{n} दिन",
  "practice.oneDay": "1 दिन",
  "practice.activeDays": "सक्रिय दिन",
  "practice.recent": "हाल में हल किए",
  "practice.nothingSolved": "अभी कुछ हल नहीं किया।",
  "practice.startSolving": "कोई प्रश्न चुनें",
  "practice.deleteAccount": "मेरा खाता हटाएँ",
  "practice.deleteHint": "आपका नाम और ईमेल हटा दिए जाते हैं और आप हर जगह से साइन आउट हो जाते हैं। आपके जमा उत्तर बिना नाम के रहते हैं।",
  "practice.deleteConfirm": "अपना खाता हटाएँ? इसे वापस नहीं किया जा सकता।",
  "practice.leaderboardHint": "हल किए प्रश्नों की संख्या के अनुसार शिक्षार्थी।",
  "practice.noLeaders": "अभी तक किसी ने कोई प्रश्न हल नहीं किया। पहले आप बनें।",
  "practice.name": "नाम",
  "practice.you": "आप",
  "practice.running": "अभी चल रही",
  "practice.upcoming": "आने वाली",
  "practice.past": "पिछली",
  "practice.contestsHint": "समयबद्ध दौर: जितने हो सकें हल करें; बराबरी पर लगा समय देखा जाता है, हर गलत प्रयास पर 20 मिनट जोड़कर।",
  "practice.noContests": "कोई प्रतियोगिता तय नहीं है।",
  "practice.minutes": "{n} मिनट",
  "practice.problemsN": "{n} प्रश्न",
  "practice.noContest": "ऐसी कोई प्रतियोगिता नहीं है।",
  "practice.ended": "समाप्त",
  "practice.problemsAtStart": "प्रश्न प्रतियोगिता शुरू होने पर दिखेंगे।",
  "practice.scoreboard": "स्कोरबोर्ड",
  "practice.scoreboardHint": "पहले हल किए प्रश्न, फिर पेनल्टी: हर हल तक के मिनट, और उससे पहले हर गलत प्रयास पर 20।",
  "practice.noEntries": "अभी कुछ जमा नहीं हुआ।",
  "practice.penalty": "पेनल्टी",
  "practice.signInFailed": "यह ईमेल और पासवर्ड यहाँ किसी खाते से मेल नहीं खाते।",
  "practice.emailTaken": "इस ईमेल से यहाँ पहले से खाता है। साइन इन करें।",
  "practice.tryAgain": "यह नहीं हुआ। फिर कोशिश करें।",
  "practice.createAccount": "अपना खाता बनाएँ",
  "practice.welcomeBack": "फिर से स्वागत है",
  "practice.signUpHint": "सिर्फ़ इस साइट का खाता: यह आपके उत्तर, सिलसिला और रैंक सहेजता है।",
  "practice.signInHint": "जहाँ छोड़ा था वहीं से शुरू करने के लिए साइन इन करें।",
  "practice.email": "ईमेल",
  "practice.password": "पासवर्ड",
  "practice.passwordHint": "कम से कम 12 अक्षर।",
  "practice.haveAccount": "पहले से खाता है?",
  "practice.newHere": "यहाँ नए हैं?",

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

/** A language's strings: any it lacks are shown in English. */
export type Messages = Partial<Record<MessageKey, string>>;

const MESSAGES: Record<UiLocale, Messages> = { en, hi, bn, ta, te, mr, gu, kn, ml, pa, or };

/** The interface's language for a chosen language: the same one, now that every language has a table. */
export const uiLocaleOf = (language: Language): UiLocale => language;

export function translate(locale: UiLocale, key: MessageKey, vars: Record<string, string | number> = {}): string {
  const text = MESSAGES[locale][key] ?? en[key];
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** How far each language's table covers the interface, 0–1: for the tests, and for anyone adding a language. */
export const coverage = (locale: UiLocale): number => Object.keys(MESSAGES[locale]).filter((k) => k in en).length / Object.keys(en).length;

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
