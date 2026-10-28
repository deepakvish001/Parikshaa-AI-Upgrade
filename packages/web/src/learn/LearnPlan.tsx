import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BedDouble, BookOpen, CalendarRange, Check, ChevronLeft, ChevronRight, Clock, Feather, Gauge, GraduationCap, NotebookPen, RotateCcw, Settings2, Snowflake } from "lucide-react";
import { Empty, Seg } from "@parikshaa/brand/kit";
import { Dialog } from "@parikshaa/brand/ui";
import { ApiError } from "../api.ts";
import { PREP_ROLES, type Level, type Plan, type PlanInput, type PlanTask, type PrepRole } from "../practice/client.ts";
import { daysBetween, istDay, longDay, taskScreen } from "./Aaj.tsx";
import { ScreenLink, useLearn } from "./context.tsx";
import { Failed, Loading, Offline, SignedOut, useCompanies, useHome, useLearnData, useLearnQuery, useMe, useOnline, usePlan, useTargets, useTracks, waitingForNetwork } from "./data.tsx";
import { Building2, CodeXml, Target } from "./icons.tsx";
import { screenById, type Tri } from "./screens.ts";
import { fill, LEARN_LANGS, type LearnLang } from "./text.ts";
import "./learn-plan.css";

/**
 * Onboarding and Mera plan (tracker row 140, K2-2; the mock's
 * `OnboardingBody`, docs/learn/mock-v3/app/src/screens/entry.tsx, and
 * `PlanBody`, today.tsx), on what the practice site's API already does:
 *
 * - onboarding asks what the plan needs (track, the job, companies, the
 *   deadline, minutes a day and weekends, the level, with the 8-question
 *   check), previews the plan (`POST /plan/preview`: its sprints, and whether
 *   it finishes in time, with the three ways when it does not) and starts it
 *   (`POST /plan`);
 * - Mera plan shows the running plan (`GET /plan`): sprints, the next seven
 *   days, tasks to tick, the learner's own tasks, the target companies, and
 *   changes what the API allows: settings (`PATCH /plan`), a day off
 *   (`POST /streak/freeze`), fewer minutes, stopping the plan.
 *
 * The mock's year of study, semester-exam weeks and the "re-plan a missed
 * day" choices have no backend yet (Kadam 3/4); missed work moves on by
 * itself (the API's reschedule), and the page says so.
 */

export const P = {
  // onboarding
  step: ["{i} of {n}", "{i} / {n}", "{i} / {n}"],
  skip: ["Skip for now", "Abhi skip", "अभी छोड़ें"],
  back: ["Back", "Peeche", "पीछे"],
  nextStep: ["Next", "Aage", "आगे"],
  write: ["Write my plan", "Mera plan likho", "मेरी योजना लिखें"],
  hasPlan: ["You have a plan ({track}). Answering again starts a new one and sets that one aside.", "Aapka plan chal raha hai ({track}). Dobara jawab doge to naya plan banega, purana alag rakha jaayega.", "आपकी योजना चल रही है ({track})। दोबारा जवाब देंगे तो नई बनेगी, पुरानी अलग रखी जाएगी।"],
  seePlan: ["See my plan", "Mera plan dekho", "मेरी योजना देखें"],
  signInFirst: ["Sign in to make your plan", "Plan banane ke liye sign in karo", "योजना बनाने के लिए साइन इन करें"],
  qTrack: ["What are you preparing?", "Kya taiyari karni hai?", "क्या तैयारी करनी है?"],
  eTrack: ["Your track", "Aapka track", "आपका ट्रैक"],
  hTrack: ["The plan follows the track's order, a module at a time.", "Plan track ke kram me chalta hai, ek module ek baar.", "योजना ट्रैक के क्रम में चलती है।"],
  items: ["{done} of {n} done", "{n} me se {done} ho gaye", "{n} में से {done} पूरे"],
  noTracks: ["This site has no tracks yet, so no plan can be made.", "Is site par abhi koi track nahi, isliye plan nahi ban sakta.", "इस साइट पर अभी कोई ट्रैक नहीं।"],
  qRole: ["Which job are you aiming for?", "Kis job ki taiyari?", "किस नौकरी की तैयारी?"],
  eRole: ["Your goal", "Aapka goal", "आपका लक्ष्य"],
  hRole: ["Its topics come first in every module. You can change it with a new plan.", "Har module me iske topics pehle aate hain. Naye plan se badal sakte ho.", "हर मॉड्यूल में इसके विषय पहले।"],
  roleNone: ["Not sure yet", "Abhi pata nahi", "अभी तय नहीं"],
  roleNoneSub: ["The track's own order", "Track ka apna kram", "ट्रैक का अपना क्रम"],
  sde: ["Software engineer (SDE)", "Software engineer (SDE)", "सॉफ़्टवेयर इंजीनियर (SDE)"],
  backend: ["Backend developer", "Backend developer", "बैकएंड डेवलपर"],
  frontend: ["Frontend developer", "Frontend developer", "फ़्रंटएंड डेवलपर"],
  data: ["Data analyst or engineer", "Data analyst ya engineer", "डेटा एनालिस्ट या इंजीनियर"],
  qCompanies: ["Which companies are you aiming for?", "Kin companies ka target hai?", "किन कंपनियों का लक्ष्य है?"],
  eCompanies: ["Companies", "Companies", "कंपनियाँ"],
  hCompanies: ["Optional. Problems they asked lately come in the last part of the plan.", "Zaroori nahi. Inke haal ke problems plan ke aakhri hisse me aate hain.", "ज़रूरी नहीं। इनके हाल के प्रश्न योजना के आख़िरी हिस्से में।"],
  asked: ["{n} problems asked lately", "Haal me {n} problems", "हाल में {n} प्रश्न"],
  qWhen: ["When do placements start for you?", "Placements kab shuru hain?", "प्लेसमेंट कब शुरू?"],
  eWhen: ["Your deadline", "Aapki deadline", "आपकी समय-सीमा"],
  hWhen: ["The plan is laid out to finish by this date.", "Plan is tareekh tak poora hone ke hisaab se banta hai.", "योजना इस तारीख़ तक पूरी होने के हिसाब से बनती है।"],
  in60: ["In about 2 months", "Lagbhag 2 mahine me", "लगभग 2 महीने में"],
  in90: ["In about 3 months", "Lagbhag 3 mahine me", "लगभग 3 महीने में"],
  in180: ["In about 6 months", "Lagbhag 6 mahine me", "लगभग 6 महीने में"],
  onDate: ["On a date I know", "Ek pakki tareekh", "एक पक्की तारीख़"],
  date: ["Deadline", "Deadline", "समय-सीमा"],
  qTime: ["How much time on a weekday?", "Weekday par kitna samay?", "सप्ताह के दिन कितना समय?"],
  eTime: ["Your time", "Aapka samay", "आपका समय"],
  hTime: ["Be honest: a plan you keep beats a plan you skip.", "Sach batao: nibhaya plan chhode plan se behtar.", "सच बताएँ: निभाई योजना छोड़ी योजना से बेहतर।"],
  h1: ["About 1 hour", "Lagbhag 1 ghanta", "लगभग 1 घंटा"],
  h2: ["About 2 hours", "Lagbhag 2 ghante", "लगभग 2 घंटे"],
  h3: ["About 3 hours", "Lagbhag 3 ghante", "लगभग 3 घंटे"],
  h4: ["4 hours or more", "4+ ghante", "4+ घंटे"],
  weekends: ["Weekends", "Weekend", "सप्ताहांत"],
  same: ["Same", "Utna hi", "उतना ही"],
  more: ["An hour more", "Ek ghanta zyada", "एक घंटा ज़्यादा"],
  sundayOff: ["Sunday off", "Ravivaar chhutti", "रविवार छुट्टी"],
  qLevel: ["Where do you start?", "Kahan se shuru?", "कहाँ से शुरू?"],
  eLevel: ["Your level", "Aapka level", "आपका स्तर"],
  hLevel: ["Not sure? Take the 8-question check: it suggests one.", "Pata nahi? 8 sawaal ka check do: wo bata dega.", "पता नहीं? 8 सवाल का चेक दें।"],
  beginner: ["New to it", "Bilkul naya", "बिल्कुल नया"],
  beginnerSub: ["Basics first, a little slower", "Pehle basics, thoda aaram se", "पहले बुनियाद"],
  intermediate: ["Comfortable with the basics", "Basics aate hain", "बुनियाद आती है"],
  intermediateSub: ["Arrays, strings, up to trees", "Arrays, strings, trees tak", "ऐरे, स्ट्रिंग, ट्री तक"],
  advanced: ["Strong", "Strong", "मज़बूत"],
  advancedSub: ["Faster, harder problems", "Tez, mushkil problems", "तेज़, कठिन प्रश्न"],
  takeCheck: ["Take the 8-question check", "8 sawaal ka check do", "8 सवाल का चेक दें"],
  checkTitle: ["Where you start: 8 questions", "Kahan se shuru: 8 sawaal", "कहाँ से शुरू: 8 सवाल"],
  checkMark: ["Check my answers", "Jawab jaancho", "जवाब जाँचें"],
  checkScore: ["{score} of {of} right: we suggest “{level}”, chosen below.", "{of} me se {score} sahi: sujhaav “{level}”, neeche chun liya.", "{of} में से {score} सही: सुझाव “{level}”।"],
  checkClose: ["Back to the levels", "Level par wapas", "स्तर पर वापस"],
  learnIn: ["Learn in", "Padhai ki bhasha", "पढ़ाई की भाषा"],
  planFor: ["Plan for {name}", "{name} ka plan", "{name} की योजना"],
  sTrack: ["Track", "Track", "ट्रैक"],
  sRole: ["Job", "Job", "नौकरी"],
  sCompanies: ["Companies", "Companies", "कंपनियाँ"],
  sWhen: ["Deadline", "Deadline", "समय-सीमा"],
  sTime: ["Time", "Samay", "समय"],
  sLevel: ["Start", "Shuru", "शुरुआत"],
  minDay: ["{m} min a day", "{m} min roz", "{m} मिनट रोज़"],
  writing: ["Writing your plan…", "Aapka plan likh rahe…", "योजना लिख रहे…"],
  readyBy: ["Ready by", "Taiyaar", "तैयार"],
  lateBy: ["Finishes after your deadline:", "Deadline ke baad khatam:", "समय-सीमा के बाद पूरी:"],
  noFit: ["At {m} min a day it ends after your deadline. Pick one:", "{m} min roz par ye deadline ke baad khatam hota. Ek chuno:", "{m} मिनट रोज़ पर यह समय-सीमा के बाद। एक चुनें:"],
  toFit: ["{m} min a day", "{m} min roz", "{m} मिनट रोज़"],
  later: ["Deadline {date}", "Deadline {date}", "समय-सीमा {date}"],
  fewer: ["Only the first {n} of {of}", "Sirf pehle {n} ({of} me se)", "केवल पहले {n} ({of} में से)"],
  fewerOn: ["The plan holds the first {n} items.", "Plan me pehle {n} items.", "योजना में पहले {n}।"],
  sprints: ["sprints", "sprints", "स्प्रिंट"],
  tasks: ["tasks", "kaam", "काम"],
  hours: ["hours in all", "ghante kul", "घंटे कुल"],
  perDay: ["min a day", "min roz", "मिनट रोज़"],
  start: ["Start my plan", "Plan shuru karo", "योजना शुरू करें"],
  change: ["Change answers", "Jawab badlo", "जवाब बदलें"],
  plus: ["This track needs Plus.", "Is track ke liye Plus chahiye.", "इस ट्रैक के लिए Plus चाहिए।"],
  getPlus: ["See Plus", "Plus dekho", "Plus देखें"],
  readyTitle: ["Your plan is ready", "Aapka plan taiyaar", "आपकी योजना तैयार"],
  readyBody: ["{sprints} sprints, about {m} min a day, finishing {date}.", "{sprints} sprints, roz lagbhag {m} min, {date} tak.", "{sprints} स्प्रिंट, रोज़ लगभग {m} मिनट, {date} तक।"],
  toToday: ["Start today's work", "Aaj ka kaam shuru", "आज का काम शुरू"],
  toPlan: ["See the whole plan", "Poora plan dekho", "पूरी योजना देखें"],
  // Mera plan
  myPlan: ["My plan", "Mera plan", "मेरी योजना"],
  noPlanTitle: ["No plan yet", "Abhi koi plan nahi", "अभी कोई योजना नहीं"],
  noPlanBody: ["Six questions, a minute or two, and each day has its work.", "6 sawaal, ek-do minute, phir har din ka kaam taiyaar.", "6 सवाल, एक-दो मिनट, फिर हर दिन का काम।"],
  makePlan: ["Make your plan", "Plan banao", "योजना बनाएँ"],
  built: ["{m} min on weekdays · {weekend} · deadline {date}", "Weekday {m} min · {weekend} · deadline {date}", "सप्ताह के दिन {m} मिनट · {weekend} · समय-सीमा {date}"],
  weekendSame: ["weekends the same", "weekend utna hi", "सप्ताहांत उतना ही"],
  weekendMin: ["{m} min on weekends", "weekend {m} min", "सप्ताहांत {m} मिनट"],
  offOn: ["off on {days}", "{days} chhutti", "{days} छुट्टी"],
  settings: ["Plan settings", "Plan settings", "योजना सेटिंग्स"],
  lighter: ["Make today lighter", "Aaj halka karo", "आज हल्का करें"],
  sSprint: ["Sprint", "Sprint", "स्प्रिंट"],
  sDone: ["Tasks done", "Kaam ho gaye", "पूरे काम"],
  sDays: ["Study days left", "Padhai ke din baaki", "पढ़ाई के दिन बाकी"],
  sFinish: ["Finish", "Khatam", "समाप्ति"],
  ahead: ["{n} days before the deadline", "Deadline se {n} din pehle", "समय-सीमा से {n} दिन पहले"],
  onTime: ["On the deadline", "Deadline par", "समय-सीमा पर"],
  behind: ["{n} days after the deadline", "Deadline se {n} din baad", "समय-सीमा से {n} दिन बाद"],
  sprintLine: ["Sprint {n}: {done} of {tasks} done", "Sprint {n}: {tasks} me se {done}", "स्प्रिंट {n}: {tasks} में से {done}"],
  today: ["Today", "Aaj", "आज"],
  days7: ["Seven days", "Saat din", "सात दिन"],
  prevWeek: ["The seven days before", "Pichhle saat din", "पिछले सात दिन"],
  nextWeek: ["The next seven days", "Agle saat din", "अगले सात दिन"],
  view: ["Show", "Dikhao", "दिखाएँ"],
  week: ["Week", "Hafta", "सप्ताह"],
  list: ["List", "List", "सूची"],
  rest: ["Rest day", "Chhutti", "छुट्टी"],
  nothing: ["Nothing planned", "Kuch nahi", "कुछ नहीं"],
  markDone: ["Done: {title}", "Ho gaya: {title}", "पूरा: {title}"],
  moved: ["{n} tasks moved on from missed days. Missed work moves forward by itself; the finish date shows where it lands.", "Chhoote dino se {n} kaam aage khiske. Chhoota kaam khud aage jaata hai; khatam ki tareekh batati hai kahan pahuncha.", "छूटे दिनों से {n} काम आगे खिसके। छूटा काम अपने आप आगे जाता है।"],
  dailyTime: ["Daily time", "Roz ka samay", "रोज़ का समय"],
  dailyHint: ["Change the minutes any time; the finish date moves with them.", "Minute kabhi bhi badlo; khatam ki tareekh saath khiskegi.", "मिनट कभी भी बदलें; तारीख़ साथ खिसकेगी।"],
  targets: ["Target companies", "Target companies", "लक्ष्य कंपनियाँ"],
  noTargets: ["None yet. Their recent problems come at the end of the plan.", "Abhi koi nahi. Inke haal ke problems plan ke aakhir me aate hain.", "अभी कोई नहीं।"],
  ready: ["{percent}% ready", "{percent}% taiyaar", "{percent}% तैयार"],
  editTargets: ["Change companies", "Companies badlo", "कंपनियाँ बदलें"],
  rules: ["How the plan decides", "Plan kaise tay karta hai", "योजना कैसे तय करती है"],
  rule1: ["Tasks follow the track's order; your job's topics come first in each module.", "Kaam track ke kram me; aapki job ke topics har module me pehle.", "काम ट्रैक के क्रम में; आपकी नौकरी के विषय पहले।"],
  rule2: ["Every 7th study day closes a sprint with revision.", "Har 7ve padhai ke din sprint revision ke saath khatam.", "हर 7वें दिन स्प्रिंट दोहराई के साथ पूरा।"],
  rule3: ["A fifth of each day stays free for revision and running over.", "Har din ka paanchva hissa revision aur der ke liye khaali.", "हर दिन का पाँचवाँ हिस्सा खाली।"],
  rule4: ["Missed work moves to the next free days when you open the app.", "App kholte hi chhoota kaam agle khaali dino par.", "ऐप खोलते ही छूटा काम अगले खाली दिनों पर।"],
  own: ["Add your own task", "Apna kaam jodo", "अपना काम जोड़ें"],
  ownTitle: ["Task", "Kaam", "काम"],
  ownPlaceholder: ["e.g. Update my resume", "jaise Resume update karna", "जैसे रिज़्यूमे अपडेट"],
  ownMinutes: ["Minutes", "Minute", "मिनट"],
  ownDay: ["Day", "Din", "दिन"],
  add: ["Add", "Jodo", "जोड़ें"],
  added: ["Added to your plan.", "Plan me jud gaya.", "योजना में जुड़ गया।"],
  newPlan: ["Start a new plan", "Naya plan banao", "नई योजना बनाएँ"],
  stop: ["Stop this plan", "Ye plan band karo", "यह योजना बंद करें"],
  stopAsk: ["Stop this plan? What you did stays in your progress; today's work and the plan's days go.", "Plan band karein? Jo kiya wo progress me rahega; aaj ka kaam aur plan ke din hat jaayenge.", "योजना बंद करें? जो किया वह प्रगति में रहेगा।"],
  keep: ["Keep it", "Rehne do", "रहने दें"],
  stopped: ["The plan is stopped.", "Plan band ho gaya.", "योजना बंद हो गई।"],
  // dialogs
  save: ["Save", "Save karo", "सहेजें"],
  cancel: ["Cancel", "Rehne do", "रद्द करें"],
  weekday: ["Minutes on a weekday", "Weekday par minute", "सप्ताह के दिन मिनट"],
  weekend: ["Minutes on Saturday and Sunday (empty: the same)", "Shanivaar-Ravivaar minute (khaali: utna hi)", "शनिवार-रविवार मिनट (खाली: उतना ही)"],
  offDays: ["Days off", "Chhutti ke din", "छुट्टी के दिन"],
  settingsHint: ["What is done stays done; the rest is laid out again from today.", "Jo ho gaya wo rahega; baaki aaj se dobara bichhega.", "जो हो गया वह रहेगा; बाकी आज से फिर बिछेगा।"],
  savedFinish: ["Saved. The plan now finishes {date}.", "Save ho gaya. Plan ab {date} ko khatam.", "सहेजा गया। योजना अब {date} को पूरी।"],
  lighterSub: ["Pick one. What is done stays done.", "Ek chuno. Jo ho gaya wo rahega.", "एक चुनें। जो हो गया वह रहेगा।"],
  lOff: ["Take today off", "Aaj chhutti lo", "आज छुट्टी लें"],
  lOffSub: ["The streak stays; today's open tasks move on. {n} days off left this month.", "Streak bachi rahegi; aaj ke baaki kaam aage. Is mahine {n} chhutti baaki.", "लगातार बनी रहेगी; आज के बाकी काम आगे। इस महीने {n} छुट्टी बाकी।"],
  lOffNone: ["No days off left this month.", "Is mahine chhutti nahi bachi.", "इस महीने छुट्टी नहीं बची।"],
  lOffTaken: ["Today is already off.", "Aaj pehle se chhutti hai.", "आज पहले से छुट्टी है।"],
  lLess: ["Fewer minutes a day from now", "Ab se roz kam minute", "अब से रोज़ कम मिनट"],
  lLessSub: ["The finish date moves later; you see it once saved.", "Khatam ki tareekh aage khiskegi; save hone par dikhegi.", "तारीख़ आगे खिसकेगी; सहेजने पर दिखेगी।"],
  keepAsIs: ["Keep as is", "Jaisa hai", "जैसा है"],
  update: ["Update plan", "Plan badlo", "योजना बदलें"],
  offDone: ["Today is off. Your streak is safe; {n} tasks moved on.", "Aaj chhutti. Streak bachi; {n} kaam aage khiske.", "आज छुट्टी। लगातार बची; {n} काम आगे।"],
  pick: ["Companies to aim for", "Target companies", "लक्ष्य कंपनियाँ"],
  done: ["Done", "Ho gaya", "हो गया"],
} as const satisfies Record<string, Tri>;

const ROLE_WORD: Record<PrepRole, Tri> = { sde: P.sde, backend: P.backend, frontend: P.frontend, data: P.data };
const LEVEL_WORD: Record<Level, Tri> = { beginner: P.beginner, intermediate: P.intermediate, advanced: P.advanced };
const LEVEL_SUB: Record<Level, Tri> = { beginner: P.beginnerSub, intermediate: P.intermediateSub, advanced: P.advancedSub };
const LEVELS: readonly Level[] = ["beginner", "intermediate", "advanced"];

const DAY_MS = 86_400_000;
/** A day `n` days from a YYYY-MM-DD. */
export const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const weekdayOf = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay();
const todayInIndia = (): string => istDay(new Date().toISOString());
const LOCALE: Record<LearnLang, string> = { en: "en-IN", hg: "en-IN", hi: "hi-IN" };
const dayMonth = (day: string, lang: LearnLang) => new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
const weekdayName = (weekday: number, lang: LearnLang, style: "short" | "long" = "short") =>
  new Intl.DateTimeFormat(LOCALE[lang], { weekday: style, timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 25 + weekday)));
/** Monday first, as a week is read in India; 0 is Sunday, as the API counts. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** A date in the learner's words, kept apart so the page's images can hold it still (`.ln-dated`). */
function Dated({ day, long = false }: { readonly day: string; readonly long?: boolean }) {
  const { lang } = useLearn();
  return <span className="ln-dated">{long ? longDay(day, lang) : dayMonth(day, lang)}</span>;
}

/* ================= onboarding ================= */

type WhenId = "d60" | "d90" | "d180" | "date";
type WeekendId = "same" | "more" | "sunday";
interface Answers {
  readonly track: string | null;
  readonly role: PrepRole | null | undefined;
  readonly when: WhenId | null;
  readonly date: string;
  readonly minutes: number | null;
  readonly weekend: WeekendId;
  readonly level: Level | null;
  readonly upTo?: number;
}
type Step = "track" | "role" | "companies" | "when" | "time" | "level";

/** The deadline an answer means: a preset counted from today in India, or the date given. */
export function deadlineOf(answers: Pick<Answers, "when" | "date">, today: string): string {
  const days = { d60: 60, d90: 90, d180: 180 } as const;
  return answers.when === "date" || answers.when === null ? answers.date : addDays(today, days[answers.when]);
}

/** What the API is asked to plan, from the answers. */
export function planInputOf(answers: Answers, today: string): PlanInput {
  const minutes = answers.minutes ?? 120;
  return {
    track: answers.track ?? "",
    level: answers.level ?? "intermediate",
    deadline: deadlineOf(answers, today),
    dailyMinutes: minutes,
    weekendMinutes: answers.weekend === "more" ? Math.min(720, minutes + 60) : null,
    offDays: answers.weekend === "sunday" ? [0] : [],
    role: answers.role ?? null,
    ...(answers.upTo === undefined ? {} : { upTo: answers.upTo }),
  };
}

function Option({ on, onPick, icon, title, sub }: { readonly on: boolean; readonly onPick: () => void; readonly icon?: ReactNode; readonly title: string; readonly sub?: string }) {
  return (
    <button type="button" className="lp-option" aria-pressed={on} onClick={onPick}>
      {icon === undefined ? <span className="lp-radio" aria-hidden="true" /> : <span className="lp-opt-ic">{icon}</span>}
      <span className="ln-grow">
        <b>{title}</b>
        {sub === undefined ? null : <span className="ln-faint">{sub}</span>}
      </span>
      {on ? <Check aria-hidden="true" className="lp-check" /> : null}
    </button>
  );
}

/** Companies to aim for: each saved as it is chosen (`PUT /companies/<c>/target`). */
function CompanyPicker({ labelledBy }: { readonly labelledBy: string }) {
  const { t, site } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  const companies = useCompanies();
  const targets = useTargets();
  const aim = useMutation({
    mutationFn: ({ slug, on }: { slug: string; on: boolean }) => client.setTarget(slug, on),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["practice", site, "targets"] }),
  });
  if (companies.isPending || targets.isPending) return <Loading shape="cards" />;
  if (companies.isError) return <Failed error={companies.error} onRetry={() => void companies.refetch()} headingLevel={3} />;
  const aimed = new Set((targets.data ?? []).map((x) => x.slug));
  return (
    <>
      <div className="lp-opts" role="group" aria-labelledby={labelledBy}>
        {companies.data.map((c) => (
          <Option
            key={c.slug}
            on={aimed.has(c.slug)}
            onPick={() => aim.mutate({ slug: c.slug, on: !aimed.has(c.slug) })}
            icon={<Building2 />}
            title={c.name}
            sub={fill(t(P.asked), { n: c.problems })}
          />
        ))}
      </div>
      {aim.isError ? <Failed error={aim.error} onRetry={() => aim.reset()} headingLevel={3} /> : null}
    </>
  );
}

/** The 8-question check (`GET`/`POST /placement`): its result chooses the level. */
function PlacementCheck({ onLevel, onClose }: { readonly onLevel: (level: Level) => void; readonly onClose: () => void }) {
  const { t } = useLearn();
  const { client } = useLearnData();
  const questions = useLearnQuery(["placement"], (c) => c.placement());
  const [choices, setChoices] = useState<Readonly<Record<string, number>>>({});
  const mark = useMutation({
    mutationFn: () => client.markPlacement(Object.entries(choices).map(([id, choice]) => ({ id, choice }))),
    onSuccess: (result) => onLevel(result.level),
  });
  if (questions.isPending) return <Loading shape="doc" />;
  if (questions.isError) return <Failed error={questions.error} onRetry={() => void questions.refetch()} headingLevel={3} />;
  const all = questions.data;
  return (
    <form
      className="lp-check-form"
      onSubmit={(event) => {
        event.preventDefault();
        mark.mutate();
      }}
    >
      <h2 className="ln-h3">{t(P.checkTitle)}</h2>
      {all.map((q, i) => (
        <fieldset key={q.id} className="lp-q">
          <legend>
            {i + 1}. {q.text}
          </legend>
          {q.options.map((option, n) => (
            <label key={option} className="lp-q-opt">
              <input type="radio" name={q.id} checked={choices[q.id] === n} onChange={() => setChoices({ ...choices, [q.id]: n })} required />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
      ))}
      {mark.isSuccess ? (
        <p className="ln-notice ln-notice-ok" role="status">
          {fill(t(P.checkScore), { score: mark.data.score, of: mark.data.of, level: t(LEVEL_WORD[mark.data.level]) })}
        </p>
      ) : null}
      {mark.isError ? <Failed error={mark.error} onRetry={() => mark.mutate()} headingLevel={3} /> : null}
      <div className="lp-row">
        <button type="button" className="ln-btn ln-btn-ghost" onClick={onClose}>
          <ArrowLeft aria-hidden="true" />
          {t(P.checkClose)}
        </button>
        {mark.isSuccess ? null : (
          <button type="submit" className="ln-btn ln-btn-pri" disabled={mark.isPending || Object.keys(choices).length < all.length}>
            {t(P.checkMark)}
          </button>
        )}
      </div>
    </form>
  );
}

export function Onboarding() {
  const { t, lang, setLang } = useLearn();
  const { signedIn } = useLearnData();
  if (!signedIn) {
    return (
      <div className="lp-onb-body">
        <SignedOut title={t(P.signInFirst)} />
      </div>
    );
  }
  return <Questions key={lang === "hi" ? "hi" : "latin"} lang={lang} setLang={setLang} />;
}

function Questions({ lang, setLang }: { readonly lang: LearnLang; readonly setLang: (lang: LearnLang) => void }) {
  const { t, site } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  const me = useMe();
  const plan = usePlan();
  const tracks = useTracks();
  const companies = useCompanies();
  const targets = useTargets();
  const today = todayInIndia();
  const [answers, setAnswers] = useState<Answers>({ track: null, role: undefined, when: null, date: addDays(today, 90), minutes: null, weekend: "same", level: null });
  const set = (patch: Partial<Answers>) => setAnswers(({ upTo: _, ...was }) => ({ ...was, ...patch }));
  const [checking, setChecking] = useState(false);
  const [at, setAt] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const qid = useId();
  const steps: readonly Step[] = ["track", "role", ...(companies.data !== undefined && companies.data.length > 0 ? (["companies"] as const) : []), "when", "time", "level"];
  const step = steps[Math.min(at, steps.length - 1)]!;
  // One track: chosen already.
  const track = answers.track ?? (tracks.data?.length === 1 ? tracks.data[0]!.slug : null);
  const full: Answers = { ...answers, track };
  const input = planInputOf(full, today);
  const preview = useLearnQuery(["plan-preview", input], (c) => c.previewPlan(input), { enabled: previewing });
  const start = useMutation({
    mutationFn: () => client.startPlan(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["practice", site] }),
  });
  const answered: Record<Step, boolean> = {
    track: track !== null,
    role: answers.role !== undefined,
    companies: true,
    when: answers.when !== null && (answers.when !== "date" || answers.date > addDays(today, 5)),
    time: answers.minutes !== null,
    level: answers.level !== null,
  };
  const name = me.data?.name.split(" ")[0] ?? "";
  const chosenTrack = tracks.data?.find((x) => x.slug === track);

  const summary: readonly [ReactNode, Tri, string | null][] = [
    [<BookOpen key="t" />, P.sTrack, chosenTrack?.title ?? null],
    [<Target key="r" />, P.sRole, answers.role === undefined ? null : answers.role === null ? t(P.roleNone) : t(ROLE_WORD[answers.role])],
    ...(steps.includes("companies") ? [[<Building2 key="c" />, P.sCompanies, (targets.data ?? []).map((x) => x.name).join(", ") || null] as [ReactNode, Tri, string | null]] : []),
    [<CalendarRange key="w" />, P.sWhen, answers.when === null ? null : dayMonth(deadlineOf(answers, today), lang)],
    [<Clock key="m" />, P.sTime, answers.minutes === null ? null : fill(t(P.minDay), { m: answers.minutes })],
    [<Gauge key="l" />, P.sLevel, answers.level === null ? null : t(LEVEL_WORD[answers.level])],
  ];

  // The questions wait for the site's companies: whether they are asked changes how many there are.
  if (companies.isPending) return <div className="lp-onb-body"><Loading /></div>;

  if (start.isSuccess) {
    const made: Plan = start.data;
    return (
      <div className="lp-onb-done">
        <section className="lp-ready" aria-labelledby={`${qid}-ready`}>
          <span className="ln-tick lp-ready-tick" aria-hidden="true">
            <Check />
          </span>
          <h1 className="lp-ready-h" id={`${qid}-ready`}>
            {t(P.readyTitle)}
          </h1>
          <p className="lp-help">
            {fill(t(P.readyBody), { sprints: made.sprints.length, m: made.dailyMinutes, date: "\u0000" })
              .split("\u0000")
              .flatMap((part, i) => (i === 0 ? [part] : [<Dated key={i} day={made.finishOn} />, part]))}
          </p>
          <div className="lp-row lp-center">
            <ScreenLink to="aaj" className="ln-btn ln-btn-pri ln-btn-lg">
              {t(P.toToday)}
              <ArrowRight aria-hidden="true" />
            </ScreenLink>
            <ScreenLink to="plan" className="ln-btn ln-btn-lg">
              {t(P.toPlan)}
            </ScreenLink>
          </div>
        </section>
      </div>
    );
  }

  if (previewing) {
    const needsPlus = preview.error instanceof ApiError && preview.error.code === "plus_required";
    // A refusal after an earlier preview shows the refusal, not the earlier plan.
    const shown = preview.isError ? undefined : preview.data;
    return (
      <div className="lp-onb-done">
        <section className="lp-ready" aria-labelledby={`${qid}-preview`} aria-busy={preview.isFetching}>
          {shown === undefined ? (
            <>
              <h1 className="lp-ready-h" id={`${qid}-preview`}>
                {t(P.writing)}
              </h1>
              {needsPlus ? (
                <div className="ln-notice ln-notice-info" role="status">
                  <span className="ln-grow">{t(P.plus)}</span>
                  <a className="ln-btn ln-btn-sm" href={`/practice/${site}/plus?learn_v2=0`}>
                    {t(P.getPlus)}
                  </a>
                </div>
              ) : preview.isError ? (
                <Failed error={preview.error} onRetry={() => void preview.refetch()} headingLevel={2} />
              ) : (
                <Loading shape="cards" />
              )}
            </>
          ) : (
            <>
              <p className="ln-eyebrow">{shown.track.title}</p>
              <h1 className="lp-ready-h" id={`${qid}-preview`}>
                {t(shown.fits ? P.readyBy : P.lateBy)} <mark className="lp-hl"><Dated day={shown.finishOn} /></mark>
              </h1>
              <dl className="lp-grid4">
                <div>
                  <dt>{t(P.sprints)}</dt>
                  <dd>{shown.sprints.length}</dd>
                </div>
                <div>
                  <dt>{t(P.tasks)}</dt>
                  <dd>{shown.tasks}</dd>
                </div>
                <div>
                  <dt>{t(P.hours)}</dt>
                  <dd>{Math.round(shown.totalMinutes / 60)}</dd>
                </div>
                <div>
                  <dt>{t(P.perDay)}</dt>
                  <dd>{input.dailyMinutes}</dd>
                </div>
              </dl>
              {shown.fits ? null : (
                <div className="lp-ways">
                  <p>{fill(t(P.noFit), { m: input.dailyMinutes })}</p>
                  <div className="lp-row">
                    {shown.dailyMinutesToFit === null ? null : (
                      <button type="button" className="ln-btn" onClick={() => set({ minutes: shown.dailyMinutesToFit })}>
                        {fill(t(P.toFit), { m: shown.dailyMinutesToFit })}
                      </button>
                    )}
                    <button type="button" className="ln-btn" onClick={() => set({ when: "date", date: shown.finishOn })}>
                      {fill(t(P.later), { date: dayMonth(shown.finishOn, lang) })}
                    </button>
                    {shown.itemsThatFit === null || shown.itemsThatFit.items === 0 ? null : (
                      <button type="button" className="ln-btn" onClick={() => setAnswers({ ...answers, upTo: shown.itemsThatFit!.items })}>
                        {fill(t(P.fewer), { n: shown.itemsThatFit.items, of: shown.itemsThatFit.of })}
                      </button>
                    )}
                  </div>
                  {answers.upTo === undefined ? null : <p role="status">{fill(t(P.fewerOn), { n: answers.upTo })}</p>}
                </div>
              )}
              {start.isError ? <Failed error={start.error} onRetry={() => start.mutate()} headingLevel={2} /> : null}
            </>
          )}
          <div className="lp-row lp-center">
            <button type="button" className="ln-btn ln-btn-ghost" onClick={() => setPreviewing(false)}>
              <ArrowLeft aria-hidden="true" />
              {t(P.change)}
            </button>
            {shown === undefined ? null : (
              <button type="button" className="ln-btn ln-btn-pri ln-btn-lg" disabled={start.isPending || preview.isFetching} onClick={() => start.mutate()}>
                {t(P.start)}
                <ArrowRight aria-hidden="true" />
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  const Q: Record<Step, { eyebrow: Tri; q: Tri; help: Tri; icon: ReactNode }> = {
    track: { eyebrow: P.eTrack, q: P.qTrack, help: P.hTrack, icon: <BookOpen aria-hidden="true" /> },
    role: { eyebrow: P.eRole, q: P.qRole, help: P.hRole, icon: <Target aria-hidden="true" /> },
    companies: { eyebrow: P.eCompanies, q: P.qCompanies, help: P.hCompanies, icon: <Building2 aria-hidden="true" /> },
    when: { eyebrow: P.eWhen, q: P.qWhen, help: P.hWhen, icon: <CalendarRange aria-hidden="true" /> },
    time: { eyebrow: P.eTime, q: P.qTime, help: P.hTime, icon: <Clock aria-hidden="true" /> },
    level: { eyebrow: P.eLevel, q: P.qLevel, help: P.hLevel, icon: <Gauge aria-hidden="true" /> },
  };
  const q = Q[step];
  const last = at >= steps.length - 1;
  const minutesOptions: readonly [number, Tri][] = [
    [60, P.h1],
    [120, P.h2],
    [180, P.h3],
    [240, P.h4],
  ];

  return (
    <div className="lp-onb-body">
      <div className="lp-onb-q">
        <div className="lp-prog">
          <span className="ln-faint">{fill(t(P.step), { i: at + 1, n: steps.length })}</span>
          <span className="lp-segs" aria-hidden="true">
            {steps.map((s, i) => (
              <i key={s} className={i < at ? "lp-ok" : i === at ? "lp-on" : undefined} />
            ))}
          </span>
          <span className="ln-grow" />
          <ScreenLink to="aaj" className="ln-btn ln-btn-ghost ln-btn-sm">
            {t(P.skip)}
          </ScreenLink>
        </div>
        {plan.data === undefined || plan.data === null ? null : (
          <div className="ln-notice ln-notice-info" role="status">
            <span className="ln-grow">{fill(t(P.hasPlan), { track: plan.data.track.title })}</span>
            <ScreenLink to="plan" className="ln-btn ln-btn-sm">
              {t(P.seePlan)}
            </ScreenLink>
          </div>
        )}
        <p className="ln-eyebrow lp-eyebrow">
          {q.icon}
          {t(q.eyebrow)}
        </p>
        <h1 className="lp-onb-h" id={`${qid}-q`}>
          {t(q.q)}
        </h1>
        <p className="lp-help">{t(q.help)}</p>

        {step === "track" ? (
          tracks.isPending ? (
            <Loading shape="cards" />
          ) : tracks.isError ? (
            <Failed error={tracks.error} onRetry={() => void tracks.refetch()} />
          ) : tracks.data.length === 0 ? (
            <Empty title={t(P.noTracks)} />
          ) : (
            <div className="lp-opts" role="group" aria-labelledby={`${qid}-q`}>
              {tracks.data.map((x) => (
                <Option key={x.slug} on={track === x.slug} onPick={() => set({ track: x.slug })} icon={<BookOpen />} title={x.title} sub={fill(t(P.items), { done: x.done, n: x.items })} />
              ))}
            </div>
          )
        ) : step === "role" ? (
          <div className="lp-opts" role="group" aria-labelledby={`${qid}-q`}>
            {PREP_ROLES.map((role) => (
              <Option key={role} on={answers.role === role} onPick={() => set({ role })} icon={role === "data" ? <GraduationCap /> : <CodeXml />} title={t(ROLE_WORD[role])} />
            ))}
            <Option on={answers.role === null} onPick={() => set({ role: null })} icon={<Target />} title={t(P.roleNone)} sub={t(P.roleNoneSub)} />
          </div>
        ) : step === "companies" ? (
          <CompanyPicker labelledBy={`${qid}-q`} />
        ) : step === "when" ? (
          <>
            <div className="lp-opts" role="group" aria-labelledby={`${qid}-q`}>
              {(
                [
                  ["d60", P.in60],
                  ["d90", P.in90],
                  ["d180", P.in180],
                  ["date", P.onDate],
                ] as const
              ).map(([id, word]) => (
                <Option key={id} on={answers.when === id} onPick={() => set({ when: id })} title={t(word)} />
              ))}
            </div>
            {answers.when === "date" ? (
              <label className="ln-field lp-narrow">
                <span>{t(P.date)}</span>
                <input className="ln-input" type="date" min={addDays(today, 6)} value={answers.date} onChange={(e) => set({ date: e.target.value })} required />
              </label>
            ) : null}
          </>
        ) : step === "time" ? (
          <>
            <div className="lp-opts" role="group" aria-labelledby={`${qid}-q`}>
              {minutesOptions.map(([m, word]) => (
                <Option key={m} on={answers.minutes === m} onPick={() => set({ minutes: m })} title={t(word)} />
              ))}
            </div>
            <div className="lp-row">
              <span className="ln-faint" id={`${qid}-wk`}>
                {t(P.weekends)}
              </span>
              <Seg
                label={t(P.weekends)}
                value={answers.weekend}
                onChange={(weekend) => set({ weekend })}
                items={[
                  { id: "same", label: t(P.same) },
                  { id: "more", label: t(P.more) },
                  { id: "sunday", label: t(P.sundayOff) },
                ]}
              />
            </div>
          </>
        ) : checking ? (
          <PlacementCheck onLevel={(level) => set({ level })} onClose={() => setChecking(false)} />
        ) : (
          <>
            <div className="lp-opts" role="group" aria-labelledby={`${qid}-q`}>
              {LEVELS.map((level) => (
                <Option key={level} on={answers.level === level} onPick={() => set({ level })} title={t(LEVEL_WORD[level])} sub={t(LEVEL_SUB[level])} />
              ))}
            </div>
            <div className="lp-row">
              <button type="button" className="ln-btn" onClick={() => setChecking(true)}>
                <Gauge aria-hidden="true" />
                {t(P.takeCheck)}
              </button>
              <span className="ln-grow" />
              <span className="ln-faint">{t(P.learnIn)}</span>
              <Seg label={t(P.learnIn)} value={lang} onChange={setLang} items={LEARN_LANGS.map((l) => ({ id: l.id, label: <span lang={l.lang}>{l.name}</span> }))} />
            </div>
          </>
        )}

        <div className="lp-nav">
          <button type="button" className="ln-btn ln-btn-ghost" onClick={() => setAt(Math.max(0, at - 1))} disabled={at === 0}>
            <ArrowLeft aria-hidden="true" />
            {t(P.back)}
          </button>
          <button type="button" className="ln-btn ln-btn-pri ln-btn-lg" disabled={!answered[step]} onClick={() => (last ? setPreviewing(true) : setAt(at + 1))}>
            {t(last ? P.write : P.nextStep)}
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <aside className="lp-side" aria-labelledby={`${qid}-side`}>
        <div className="lp-paper">
          <h2 className="lp-paper-title" id={`${qid}-side`}>
            {name === "" ? t(P.myPlan) : fill(t(P.planFor), { name })}
          </h2>
          <dl className="lp-sum">
            {summary.map(([icon, key, value]) => (
              <div key={key[0]} className={value === null ? undefined : "lp-on"}>
                <dt>
                  <span aria-hidden="true">{icon}</span>
                  {t(key)}
                </dt>
                <dd>{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </div>
  );
}

/* ================= Mera plan ================= */

function Frame({ children }: { readonly children: ReactNode }) {
  const { t } = useLearn();
  return (
    <div className="ln-stack">
      <h1 className="ln-page-h1">{t(screenById("plan")?.title ?? P.myPlan)}</h1>
      {children}
    </div>
  );
}

export function MeraPlan() {
  const { t } = useLearn();
  const { signedIn } = useLearnData();
  const plan = usePlan();
  const online = useOnline();
  if (!signedIn) {
    return (
      <Frame>
        <SignedOut title={t(P.signInFirst)} />
      </Frame>
    );
  }
  if (waitingForNetwork(plan)) {
    return (
      <Frame>
        <Offline waiting />
      </Frame>
    );
  }
  if (plan.isPending) {
    return (
      <Frame>
        <Loading shape="cards" />
      </Frame>
    );
  }
  if (plan.isError) {
    return (
      <Frame>
        <Failed error={plan.error} onRetry={() => void plan.refetch()} retrying={plan.isFetching} />
      </Frame>
    );
  }
  if (plan.data === null) {
    return (
      <Frame>
        <Empty
          icon={<CalendarRange />}
          title={t(P.noPlanTitle)}
          body={t(P.noPlanBody)}
          action={
            <ScreenLink to="onboarding" className="ln-btn ln-btn-pri">
              {t(P.makePlan)}
            </ScreenLink>
          }
        />
      </Frame>
    );
  }
  return <PlanPage plan={plan.data} offline={!online} />;
}

const KIND_ICON: Record<PlanTask["kind"], ReactNode> = {
  learn: <BookOpen aria-hidden="true" />,
  practice: <CodeXml aria-hidden="true" />,
  revise: <RotateCcw aria-hidden="true" />,
  custom: <NotebookPen aria-hidden="true" />,
};

/** The seven days from `from`: each with its tasks, and whether it is a day off. */
export function sevenDays(plan: Pick<Plan, "today" | "upcoming" | "completed" | "offDays">, from: string) {
  const all = [...plan.completed, ...plan.today, ...plan.upcoming];
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(from, i);
    const tasks = all.filter((task) => task.day === day);
    return { day, tasks, off: tasks.length === 0 && plan.offDays.includes(weekdayOf(day)) };
  });
}

function PlanPage({ plan, offline }: { readonly plan: Plan; readonly offline: boolean }) {
  const { t, lang, site, notify } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  const id = useId();
  const today = todayInIndia();
  const [dialog, setDialog] = useState<"settings" | "lighter" | "targets" | "stop" | null>(null);
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"week" | "list">("week");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["practice", site] });
  const toggle = useMutation({ mutationFn: (task: PlanTask) => client.setTaskDone(task.id, !task.done), onSettled: refresh });
  const stop = useMutation({
    mutationFn: () => client.stopPlan(),
    onSuccess: async () => {
      setDialog(null);
      await refresh();
      notify({ tone: "ok", text: t(P.stopped) });
    },
  });
  const targets = useTargets();
  const spare = daysBetween(plan.finishOn, plan.deadline);
  const weekend = plan.weekendMinutes === null ? t(P.weekendSame) : fill(t(P.weekendMin), { m: plan.weekendMinutes });
  const off = plan.offDays.length === 0 ? null : fill(t(P.offOn), { days: WEEK_ORDER.filter((d) => plan.offDays.includes(d)).map((d) => weekdayName(d, lang)).join(", ") });
  const from = addDays(today, offset * 7);
  const days = sevenDays(plan, from);
  const first = plan.sprints[0];
  const lastSprint = plan.sprints.at(-1);
  const span = first === undefined || lastSprint === undefined ? 0 : daysBetween(first.from, lastSprint.to) + 1;
  const mark = first === undefined || span === 0 ? null : Math.min(100, Math.max(0, ((daysBetween(first.from, today) + 0.5) / span) * 100));
  const most = Math.max(plan.dailyMinutes, plan.weekendMinutes ?? 0, 1);
  const upcomingLast = plan.upcoming.at(-1)?.day ?? plan.finishOn;
  const lastDay = upcomingLast > plan.finishOn ? upcomingLast : plan.finishOn;

  return (
    <div className="ln-stack">
      {offline ? <Offline /> : null}
      <header className="lp-head">
        <div className="ln-grow">
          <p className="ln-eyebrow">{t(P.myPlan)}</p>
          <h1 className="ln-page-h1">
            {plan.track.title}, {t(P.readyBy).toLowerCase()} <mark className="lp-hl"><Dated day={plan.finishOn} /></mark>
          </h1>
          <p className="lp-sub">
            {fill(t(P.built), { m: plan.dailyMinutes, weekend, date: "\u0000" })
              .split("\u0000")
              .flatMap((part, i) => (i === 0 ? [part] : [<Dated key={i} day={plan.deadline} />, part]))}
            {off === null ? null : ` · ${off}`}
            {plan.role === null ? null : ` · ${t(ROLE_WORD[plan.role])}`}
          </p>
        </div>
        <div className="lp-actions">
          <button type="button" className="ln-btn" onClick={() => setDialog("settings")} aria-haspopup="dialog">
            <Settings2 aria-hidden="true" />
            {t(P.settings)}
          </button>
          <button type="button" className="ln-btn" onClick={() => setDialog("lighter")} aria-haspopup="dialog">
            <Feather aria-hidden="true" />
            {t(P.lighter)}
          </button>
        </div>
      </header>

      <dl className="lp-stats">
        <div>
          <dt>{t(P.sSprint)}</dt>
          <dd>
            {plan.sprint} / {plan.sprints.length}
          </dd>
        </div>
        <div>
          <dt>{t(P.sDone)}</dt>
          <dd>
            {plan.done} / {plan.total}
          </dd>
        </div>
        <div>
          <dt>{t(P.sDays)}</dt>
          <dd>{plan.studyDaysLeft}</dd>
        </div>
        <div>
          <dt>{t(P.sFinish)}</dt>
          <dd>
            <Dated day={plan.finishOn} />
            <span className={`lp-pace ${spare < 0 ? "lp-late" : "lp-fine"}`}>{spare === 0 ? t(P.onTime) : fill(t(spare > 0 ? P.ahead : P.behind), { n: Math.abs(spare) })}</span>
          </dd>
        </div>
      </dl>

      <section className="ln-card" aria-labelledby={`${id}-sprints`}>
        <div className="ln-card-h">
          <h2 className="ln-h3" id={`${id}-sprints`}>
            {t(P.sprints).replace(/^./, (c) => c.toUpperCase())}
          </h2>
        </div>
        <div className="lp-sprints-wrap">
          <ol className="lp-sprints">
            {plan.sprints.map((s) => (
              <li key={s.sprint} className={s.sprint === plan.sprint ? "lp-now" : s.tasks > 0 && s.done === s.tasks ? "lp-full" : undefined} style={{ flexGrow: Math.max(1, s.tasks) }}>
                <span className="lp-bar" aria-hidden="true">
                  <i style={{ width: `${s.tasks === 0 ? 0 : Math.round((s.done / s.tasks) * 100)}%` }} />
                </span>
                <span className="ln-sr">{fill(t(P.sprintLine), { n: s.sprint, done: s.done, tasks: s.tasks })}</span>
                <b aria-hidden="true">S{s.sprint}</b>
                <span className="ln-faint">
                  <Dated day={s.from} />
                </span>
              </li>
            ))}
          </ol>
          {mark === null ? null : (
            <span className="lp-today" style={{ left: `${mark}%` }} aria-hidden="true">
              <span>{t(P.today)}</span>
            </span>
          )}
        </div>
      </section>

      <section className="ln-card" aria-labelledby={`${id}-week`}>
        <div className="ln-card-h lp-week-h">
          <button type="button" className="ln-icon-btn ln-sm" onClick={() => setOffset(offset - 1)} disabled={from <= (first?.from ?? today)} aria-label={t(P.prevWeek)} title={t(P.prevWeek)}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <h2 className="ln-h3" id={`${id}-week`}>
            <span className="ln-sr">{t(P.days7)}: </span>
            <Dated day={from} /> – <Dated day={addDays(from, 6)} />
          </h2>
          <button type="button" className="ln-icon-btn ln-sm" onClick={() => setOffset(offset + 1)} disabled={addDays(from, 7) > lastDay} aria-label={t(P.nextWeek)} title={t(P.nextWeek)}>
            <ChevronRight aria-hidden="true" />
          </button>
          <span className="ln-grow" />
          <Seg
            label={t(P.view)}
            value={view}
            onChange={setView}
            items={[
              { id: "week", label: t(P.week) },
              { id: "list", label: t(P.list) },
            ]}
          />
        </div>
        <ol className={`lp-week lp-${view}`}>
          {days.map(({ day, tasks, off: rest }) => (
            <li key={day} className={`lp-day${day === today ? " lp-is-today" : ""}${rest ? " lp-rest" : ""}`}>
              <div className="lp-day-h">
                <span className="ln-faint ln-dated">{weekdayName(weekdayOf(day), lang)}</span>
                <b className="ln-dated">{dayMonth(day, lang)}</b>
                {day === today ? <span className="ln-badge ln-tone-tick">{t(P.today)}</span> : null}
              </div>
              {rest ? (
                <p className="lp-day-rest">
                  <BedDouble aria-hidden="true" />
                  {t(P.rest)}
                </p>
              ) : tasks.length === 0 ? (
                <p className="ln-faint">{t(P.nothing)}</p>
              ) : (
                <ul className="lp-tasks">
                  {tasks.map((task) => (
                    <li key={task.id} className={task.done ? "lp-done" : undefined}>
                      <button
                        type="button"
                        className="lp-tick"
                        aria-pressed={task.done}
                        aria-label={fill(t(P.markDone), { title: task.title })}
                        disabled={toggle.isPending || offline}
                        onClick={() => toggle.mutate(task)}
                      >
                        {task.done ? <Check aria-hidden="true" /> : null}
                      </button>
                      <span className="lp-kind" aria-hidden="true">
                        {KIND_ICON[task.kind]}
                      </span>
                      {task.link === null ? <span className="ln-grow">{task.title}</span> : (
                        <ScreenLink to={taskScreen(task)} className="ln-grow lp-task-link">
                          {task.title}
                        </ScreenLink>
                      )}
                      <span className="ln-faint">{task.estMinutes}m</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
        {toggle.isError ? <Failed error={toggle.error} onRetry={() => toggle.reset()} headingLevel={3} /> : null}
        {plan.moved > 0 ? (
          <div className="ln-card-f">
            <Snowflake aria-hidden="true" />
            <span className="ln-grow">{fill(t(P.moved), { n: plan.moved })}</span>
          </div>
        ) : null}
      </section>

      <div className="lp-cards">
        <section className="ln-card ln-card-pad" aria-labelledby={`${id}-time`}>
          <h2 className="ln-h3" id={`${id}-time`}>
            {t(P.dailyTime)}
          </h2>
          <ol className="lp-bars">
            {WEEK_ORDER.map((d) => {
              const minutes = plan.offDays.includes(d) ? 0 : d === 0 || d === 6 ? (plan.weekendMinutes ?? plan.dailyMinutes) : plan.dailyMinutes;
              return (
                <li key={d}>
                  <i style={{ height: `${Math.round((minutes / most) * 100)}%` }} aria-hidden="true" />
                  <span className="ln-faint">
                    <span aria-hidden="true">{weekdayName(d, lang).slice(0, lang === "hi" ? 4 : 2)}</span>
                    <span className="ln-sr">
                      {weekdayName(d, lang, "long")}: {minutes}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="ln-faint">{t(P.dailyHint)}</p>
        </section>
        <section className="ln-card ln-card-pad" aria-labelledby={`${id}-targets`}>
          <h2 className="ln-h3" id={`${id}-targets`}>
            {t(P.targets)}
          </h2>
          {targets.data === undefined || targets.data.length === 0 ? (
            <p className="ln-faint">{t(P.noTargets)}</p>
          ) : (
            <ul className="lp-targets">
              {targets.data.map((x) => (
                <li key={x.slug}>
                  <Building2 aria-hidden="true" />
                  <span className="ln-grow">{x.name}</span>
                  <span className="ln-faint">{fill(t(P.ready), { percent: x.readiness.percent })}</span>
                </li>
              ))}
            </ul>
          )}
          <div>
            <button type="button" className="ln-btn ln-btn-sm" onClick={() => setDialog("targets")} aria-haspopup="dialog">
              {t(P.editTargets)}
            </button>
          </div>
        </section>
        <section className="ln-card ln-card-pad" aria-labelledby={`${id}-rules`}>
          <h2 className="ln-h3" id={`${id}-rules`}>
            {t(P.rules)}
          </h2>
          <ul className="lp-rules">
            <li>{t(P.rule1)}</li>
            <li>{t(P.rule2)}</li>
            <li>{t(P.rule3)}</li>
            <li>{t(P.rule4)}</li>
          </ul>
        </section>
      </div>

      <OwnTask today={today} />

      <div className="lp-row lp-end">
        <ScreenLink to="onboarding" className="ln-btn ln-btn-ghost">
          {t(P.newPlan)}
        </ScreenLink>
        <button type="button" className="ln-btn ln-btn-ghost lp-danger" onClick={() => setDialog("stop")} aria-haspopup="dialog">
          {t(P.stop)}
        </button>
      </div>

      {dialog === "settings" ? <SettingsDialog plan={plan} onClose={() => setDialog(null)} /> : null}
      {dialog === "lighter" ? <LighterDialog plan={plan} onClose={() => setDialog(null)} /> : null}
      {dialog === "targets" ? (
        <Dialog label={t(P.pick)} onClose={() => setDialog(null)} className="lp-dialog">
          <h2 className="ln-h3" id={`${id}-pick`}>
            {t(P.pick)}
          </h2>
          <CompanyPicker labelledBy={`${id}-pick`} />
          <div className="lp-row lp-end">
            <button type="button" className="ln-btn ln-btn-pri" onClick={() => setDialog(null)}>
              {t(P.done)}
            </button>
          </div>
        </Dialog>
      ) : null}
      {dialog === "stop" ? (
        <Dialog label={t(P.stop)} onClose={() => setDialog(null)} className="lp-dialog">
          <h2 className="ln-h3">{t(P.stop)}</h2>
          <p>{t(P.stopAsk)}</p>
          {stop.isError ? <Failed error={stop.error} onRetry={() => stop.mutate()} headingLevel={3} /> : null}
          <div className="lp-row lp-end">
            <button type="button" className="ln-btn ln-btn-ghost" onClick={() => setDialog(null)}>
              {t(P.keep)}
            </button>
            <button type="button" className="ln-btn ln-btn-pri lp-danger-btn" disabled={stop.isPending} onClick={() => stop.mutate()}>
              {t(P.stop)}
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

/** A task of the learner's own (`POST /plan/tasks`), on a day they choose. */
function OwnTask({ today }: { readonly today: string }) {
  const { t, site, notify } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  const id = useId();
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [day, setDay] = useState(today);
  const add = useMutation({
    mutationFn: () => client.addTask(title.trim(), minutes, day),
    onSuccess: async () => {
      setTitle("");
      await queryClient.invalidateQueries({ queryKey: ["practice", site] });
      notify({ tone: "ok", text: t(P.added) });
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim() !== "") add.mutate();
  };
  return (
    <section className="ln-card ln-card-pad" aria-labelledby={`${id}-own`}>
      <h2 className="ln-h3" id={`${id}-own`}>
        {t(P.own)}
      </h2>
      <form className="lp-own" onSubmit={submit}>
        <label className="ln-field ln-grow">
          <span>{t(P.ownTitle)}</span>
          <input className="ln-input" value={title} maxLength={200} required placeholder={t(P.ownPlaceholder)} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="ln-field">
          <span>{t(P.ownMinutes)}</span>
          <input className="ln-input" type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} required />
        </label>
        <label className="ln-field">
          <span>{t(P.ownDay)}</span>
          <input className="ln-input ln-dated" type="date" min={today} value={day} onChange={(e) => setDay(e.target.value)} required />
        </label>
        <button type="submit" className="ln-btn ln-btn-pri" disabled={add.isPending}>
          {t(P.add)}
        </button>
      </form>
      {add.isError ? <Failed error={add.error} onRetry={() => add.mutate()} headingLevel={3} /> : null}
    </section>
  );
}

/** The plan's settings (`PATCH /plan`): deadline, minutes, days off. */
function SettingsDialog({ plan, onClose }: { readonly plan: Plan; readonly onClose: () => void }) {
  const { t, lang, site, notify } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  const id = useId();
  const [form, setForm] = useState({ deadline: plan.deadline, dailyMinutes: plan.dailyMinutes, weekendMinutes: plan.weekendMinutes, offDays: plan.offDays });
  const save = useMutation({
    mutationFn: () => client.changePlan(form),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["practice", site] });
      onClose();
      notify({ tone: "ok", text: fill(t(P.savedFinish), { date: dayMonth(saved.finishOn, lang) }) });
    },
  });
  return (
    <Dialog label={t(P.settings)} onClose={onClose} className="lp-dialog">
      <form
        className="lp-form"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="ln-h3">{t(P.settings)}</h2>
        <p className="ln-faint">{t(P.settingsHint)}</p>
        <label className="ln-field">
          <span>{t(P.date)}</span>
          <input className="ln-input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} required />
        </label>
        <label className="ln-field">
          <span>{t(P.weekday)}</span>
          <input className="ln-input" type="number" min={15} max={720} step={15} value={form.dailyMinutes} onChange={(e) => setForm({ ...form, dailyMinutes: Number(e.target.value) })} required />
        </label>
        <label className="ln-field">
          <span>{t(P.weekend)}</span>
          <input
            className="ln-input"
            type="number"
            min={15}
            max={720}
            step={15}
            value={form.weekendMinutes ?? ""}
            onChange={(e) => setForm({ ...form, weekendMinutes: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </label>
        <fieldset className="lp-days">
          <legend id={`${id}-off`}>{t(P.offDays)}</legend>
          {WEEK_ORDER.map((d) => (
            <label key={d} className="lp-day-check">
              <input type="checkbox" checked={form.offDays.includes(d)} onChange={(e) => setForm({ ...form, offDays: e.target.checked ? [...form.offDays, d] : form.offDays.filter((x) => x !== d) })} />
              <span>{weekdayName(d, lang)}</span>
            </label>
          ))}
        </fieldset>
        {save.isError ? <Failed error={save.error} onRetry={() => save.mutate()} headingLevel={3} /> : null}
        <div className="lp-row lp-end">
          <button type="button" className="ln-btn ln-btn-ghost" onClick={onClose}>
            {t(P.cancel)}
          </button>
          <button type="submit" className="ln-btn ln-btn-pri" disabled={save.isPending}>
            {t(P.save)}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** "Make today lighter": a day off (`POST /streak/freeze`), or fewer minutes from now (`PATCH /plan`). */
function LighterDialog({ plan, onClose }: { readonly plan: Plan; readonly onClose: () => void }) {
  const { t, lang, site, notify } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  const home = useHome();
  const frozen = home.data?.frozenToday === true;
  const left = home.data?.freezesLeft ?? 0;
  const canRest = home.data !== undefined && !frozen && left > 0;
  const [picked, setPick] = useState<"off" | "less" | null>(null);
  // A day off unless none is left: decided once the day's numbers are in.
  const pick = picked ?? (canRest || home.data === undefined ? "off" : "less");
  const [minutes, setMinutes] = useState(Math.max(15, plan.dailyMinutes - 30));
  const update = useMutation({
    mutationFn: async (): Promise<string> => {
      if (pick === "off") return fill(t(P.offDone), { n: (await client.freezeToday()).moved });
      const saved = await client.changePlan({ dailyMinutes: minutes });
      return fill(t(P.savedFinish), { date: dayMonth(saved.finishOn, lang) });
    },
    onSuccess: async (text) => {
      await queryClient.invalidateQueries({ queryKey: ["practice", site] });
      onClose();
      notify({ tone: "ok", text });
    },
  });
  const chosen = pick === "off" ? canRest : minutes >= 15 && minutes < plan.dailyMinutes;
  return (
    <Dialog label={t(P.lighter)} onClose={onClose} className="lp-dialog">
      <h2 className="ln-h3">{t(P.lighter)}</h2>
      <p className="ln-faint">{t(P.lighterSub)}</p>
      <div className="lp-opts lp-one" role="group" aria-label={t(P.lighter)}>
        <Option
          on={pick === "off"}
          onPick={() => setPick("off")}
          icon={<BedDouble />}
          title={t(P.lOff)}
          sub={frozen ? t(P.lOffTaken) : left === 0 ? t(P.lOffNone) : fill(t(P.lOffSub), { n: left })}
        />
        <Option on={pick === "less"} onPick={() => setPick("less")} icon={<Clock />} title={t(P.lLess)} sub={t(P.lLessSub)} />
      </div>
      {pick === "less" ? (
        <label className="ln-field lp-narrow">
          <span>{t(P.weekday)}</span>
          <input className="ln-input" type="number" min={15} max={plan.dailyMinutes - 1} step={15} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </label>
      ) : null}
      {update.isError ? <Failed error={update.error} onRetry={() => update.mutate()} headingLevel={3} /> : null}
      <div className="lp-row lp-end">
        <button type="button" className="ln-btn ln-btn-ghost" onClick={onClose}>
          {t(P.keepAsIs)}
        </button>
        <button type="button" className="ln-btn ln-btn-pri" disabled={!chosen || update.isPending} onClick={() => update.mutate()}>
          {t(P.update)}
        </button>
      </div>
    </Dialog>
  );
}
