import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Empty, FocusBar, PaneHead, Panes, usePanes, type KitLink } from "@parikshaa/brand/kit";
import { Markdown } from "@parikshaa/brand/markdown";
import type { CandidateCodeQuestion, CandidateQuestion } from "@parikshaa/core/browser";
import { ApiError, type RunOutcome } from "../api.ts";
import { argumentsOf, LANGUAGE_NAMES, memory, readCodeAnswer, splitStem, starterIn } from "../components/code-meta.ts";
import { approachesOf, type Problem, type Submission, type TutorAnswer, type Verdict } from "../practice/client.ts";
import { ScreenLink, useLearn } from "./context.tsx";
import { Failed, Loading, Offline, useLearnData, useLearnQuery, useOnline, useProblem, useSubmissions, useTutor, waitingForNetwork } from "./data.tsx";
import { BookOpen, CodeXml, icon, Sparkles } from "./icons.tsx";
import { PROBLEM_SCREEN, type Tri } from "./screens.ts";
import { fill, T } from "./text.ts";
import "./learn-workspace.css";

/**
 * The problem workspace (tracker row 140, K2-5; the mock's `ProblemScreen`,
 * docs/learn/mock-v3/app/src/screens/problem.tsx), at the old site's address
 * `problems/<problem>`, on what the practice site's API already does:
 *
 * - `GET /problems/<problem>`: the statement (the brand's Markdown renderer,
 *   never HTML), input and output, constraints, worked examples, the
 *   languages and their starters, the learner's standing, and the editorial
 *   once the API opens it (solved, or three wrong submissions; never while a
 *   contest with it runs);
 * - `POST …/run`: the code on the examples or on an input of the learner's
 *   own, recorded nowhere; `POST …/submit`: judged on every test by the
 *   judge, the verdict back at once, with the first failing test's input and
 *   output where the test is visible (a hidden one shows its verdict alone);
 * - `GET …/submissions`: the learner's own, newest first, each with its code;
 * - the hints (`GET`/`POST …/tutor`, `…/tutor/hint`): the ones opened, and
 *   the next with its cost; the author's first hint is free;
 * - the learner's note on it (`GET`/`PUT /notes/problem/<problem>`, Markdown);
 * - the draft code stays on this device under the old site's key, so either
 *   site opens the same draft.
 *
 * Code runs only through the API's judge: nothing the learner writes runs in
 * the browser. A choice or number problem gets the same panes with an answer
 * in place of the editor. The kit's panes (Problem | Code | Sahayak) resize
 * with the keyboard and turn into tabs on a phone; Sahayak's own panel comes
 * with K2-6 ("Fail kyun? Poochho" opens its pane already). Not shown (no
 * backend yet): the mock's smallest failing test, faster-than percentages,
 * the task timer, likes, and "report a mistake".
 */

export const LW = {
  back: ["Back", "Wapas", "वापस"],
  problem: ["Problem", "Problem", "प्रश्न"],
  code: ["Code", "Code", "कोड"],
  answer: ["Answer", "Jawab", "उत्तर"],
  panesTabs: ["Workspace panes", "Workspace ke pane", "कार्यक्षेत्र के पैन"],
  show: ["Show {pane}", "{pane} dikhao", "{pane} दिखाएँ"],
  hide: ["Hide {pane}", "{pane} chhupao", "{pane} छिपाएँ"],
  resize: ["Resize {a} and {b}", "{a} aur {b} ka size badlo", "{a} और {b} का आकार बदलें"],
  paneToggles: ["Panes", "Pane", "पैन"],
  tabStatement: ["Problem", "Problem", "प्रश्न"],
  tabEditorial: ["Editorial", "Editorial", "हल"],
  tabSubmissions: ["Submissions", "Submissions", "सबमिशन"],
  tabNote: ["My note", "Mera note", "मेरा नोट"],
  noteNone: ["No note on this problem yet: the one line you would want before an interview.", "Is problem par abhi note nahi: wo ek line likho jo interview se pehle chahiye.", "इस प्रश्न पर अभी नोट नहीं: वह एक पंक्ति लिखें जो इंटरव्यू से पहले चाहिए।"],
  noteWrite: ["Write a note", "Note likho", "नोट लिखें"],
  noteEdit: ["Edit", "Badlo", "बदलें"],
  noteSave: ["Save", "Save karo", "सहेजें"],
  noteCancel: ["Cancel", "Rehne do", "रहने दें"],
  noteText: ["Your note, in Markdown", "Aapka note, Markdown me", "आपका नोट, Markdown में"],
  noteHint: ["Saved to Notes; revision shows it with this problem. An empty note is deleted.", "Notes me save hota hai; revision me is problem ke saath dikhta hai. Khaali note mit jaata hai.", "नोट्स में सहेजा जाता है; दोहराई में इस प्रश्न के साथ दिखता है। ख़ाली नोट मिट जाता है।"],
  noteSaved: ["Note saved.", "Note save ho gaya.", "नोट सहेजा गया।"],
  noteSignIn: ["Sign in to keep a note on this problem", "Is problem par note ke liye sign in karo", "इस प्रश्न पर नोट के लिए साइन इन करें"],
  easy: ["Easy", "Aasaan", "आसान"],
  medium: ["Medium", "Medium", "मध्यम"],
  hard: ["Hard", "Mushkil", "कठिन"],
  solvedBy: ["Solved by {n}", "{n} ne solve kiya", "{n} ने हल किया"],
  acceptance: ["{p}% of submissions accepted", "{p}% submissions accepted", "{p}% सबमिशन स्वीकृत"],
  stSolved: ["Solved", "Solve kiya", "हल किया"],
  stTried: ["Tried, not solved", "Koshish ki, solve nahi", "कोशिश की, हल नहीं"],
  inputFormat: ["Input", "Input", "इनपुट"],
  outputFormat: ["Output", "Output", "आउटपुट"],
  constraints: ["Constraints", "Constraints", "सीमाएँ"],
  example: ["Example {n}", "Example {n}", "उदाहरण {n}"],
  input: ["Input", "Input", "इनपुट"],
  output: ["Output", "Output", "आउटपुट"],
  why: ["Why", "Kyun", "क्यों"],
  hints: ["Hints", "Hints", "संकेत"],
  hintN: ["Hint {n}", "Hint {n}", "संकेत {n}"],
  openHint: ["Open hint {n}", "Hint {n} kholo", "संकेत {n} खोलें"],
  free: ["free", "free", "मुफ़्त"],
  credits: ["{n} credits", "{n} credits", "{n} क्रेडिट"],
  hintsNote: [
    "Each hint says a little more; the last is the worked solution. Opened hints stay here.",
    "Har hint thoda aur batata hai; aakhri me poora hal. Khole hue hint yahin rehte hain.",
    "हर संकेत थोड़ा और बताता है; आख़िरी में पूरा हल। खोले संकेत यहीं रहते हैं।",
  ],
  hintsDone: ["Every hint is open.", "Saare hint khul gaye.", "सारे संकेत खुल गए।"],
  hintLater: [
    "The last hint, the worked solution, opens after {n} wrong submissions.",
    "Aakhri hint (poora hal) {n} galat submit ke baad khulta hai.",
    "आख़िरी संकेत (पूरा हल) {n} ग़लत सबमिशन के बाद खुलता है।",
  ],
  hintSignIn: ["Sign in to open hints", "Hint kholne ke liye sign in karo", "संकेत खोलने के लिए साइन इन करें"],
  noCredits: ["Not enough credits for this hint.", "Is hint ke liye credits kam hain.", "इस संकेत के लिए क्रेडिट कम हैं।"],
  getCredits: ["Get credits on the current site", "Credits abhi wali site par lo", "क्रेडिट मौजूदा साइट पर लें"],
  tutorClosed: ["Hints are closed while a contest with this problem runs.", "Is problem wala contest chal raha hai; tab tak hint band.", "इस प्रश्न वाली प्रतियोगिता चल रही है; तब तक संकेत बंद।"],
  tutorOff: ["Hints are not available on this site.", "Is site par hint nahi milte.", "इस साइट पर संकेत नहीं मिलते।"],
  editorialLocked: [
    "The editorial opens once you solve this problem, or after {n} wrong submissions.",
    "Editorial solve karne par khulta hai, ya {n} galat submit ke baad.",
    "हल प्रश्न हल करने पर खुलता है, या {n} ग़लत सबमिशन के बाद।",
  ],
  editorialTries: ["Wrong submissions so far: {done} of {n}.", "Abhi tak galat submit: {n} me se {done}.", "अब तक ग़लत सबमिशन: {n} में से {done}।"],
  editorialContest: ["The editorial is closed while the contest runs.", "Contest chalte waqt editorial band hai.", "प्रतियोगिता के दौरान हल बंद है।"],
  noEditorial: ["This problem has no editorial yet.", "Is problem ka editorial abhi nahi.", "इस प्रश्न का हल अभी नहीं।"],
  approaches: ["Approaches", "Tareeke", "तरीके"],
  copy: ["Copy", "Copy", "कॉपी"],
  copied: ["Copied", "Copy ho gaya", "कॉपी हुआ"],
  noSubs: ["No submissions yet. Yours show here, newest first.", "Abhi koi submission nahi. Aapke yahan dikhenge, naya pehle.", "अभी कोई सबमिशन नहीं। आपके यहाँ दिखेंगे, नया पहले।"],
  subsSignIn: ["Sign in to see your submissions", "Apne submissions dekhne ke liye sign in karo", "अपने सबमिशन देखने के लिए साइन इन करें"],
  subN: ["Submission {n}", "Submission {n}", "सबमिशन {n}"],
  testsPassed: ["{passed}/{total} tests", "{passed}/{total} test", "{passed}/{total} टेस्ट"],
  loadCode: ["Put this code in the editor", "Ye code editor me daalo", "यह कोड एडिटर में डालें"],
  loadConfirm: ["Replace the code in the editor with this submission's?", "Editor ka code is submission ke code se badal dein?", "एडिटर का कोड इस सबमिशन के कोड से बदल दें?"],
  loaded: ["That submission's code is in the editor.", "Us submission ka code editor me aa gaya.", "उस सबमिशन का कोड एडिटर में आ गया।"],
  language: ["Language", "Bhasha", "भाषा"],
  reset: ["Back to the starter code", "Starter code par wapas", "स्टार्टर कोड पर वापस"],
  resetConfirm: ["Replace your code with the starter code?", "Apna code hata kar starter code lagayein?", "अपना कोड हटाकर स्टार्टर कोड लगाएँ?"],
  editor: ["Your code", "Aapka code", "आपका कोड"],
  saved: ["Draft saved on this device", "Draft is device par save", "ड्राफ़्ट इस डिवाइस पर सहेजा"],
  run: ["Run", "Chalao", "चलाएँ"],
  running: ["Running…", "Chal raha hai…", "चल रहा है…"],
  submit: ["Submit", "Submit", "जमा करें"],
  judging: ["Judging…", "Jaanch rahe hain…", "जाँच रहे हैं…"],
  shortcuts: ["Ctrl+Enter runs, Ctrl+' submits", "Ctrl+Enter chalata, Ctrl+' submit karta", "Ctrl+Enter चलाता, Ctrl+' जमा करता"],
  signInToRun: ["Sign in to run and submit", "Chalane aur submit ke liye sign in karo", "चलाने और जमा करने के लिए साइन इन करें"],
  offline: ["Offline: your code stays on this device; Run and Submit wait for the network.", "Offline: code is device par hai; Run aur Submit net ka intezaar karenge.", "ऑफ़लाइन: कोड इस डिवाइस पर है; चलाना और जमा करना नेट का इंतज़ार करेंगे।"],
  console: ["Tests and result", "Tests aur nateeja", "टेस्ट और परिणाम"],
  testcase: ["Testcase", "Testcase", "टेस्टकेस"],
  result: ["Result", "Nateeja", "परिणाम"],
  caseN: ["Case {n}", "Case {n}", "केस {n}"],
  custom: ["Your input", "Apna input", "अपना इनपुट"],
  customStdin: ["Input, as your program reads it", "Input, jaise program padhta hai", "इनपुट, जैसे प्रोग्राम पढ़ता है"],
  runNote: [
    "Run tries your code on the examples and records nothing. Submit judges it on every test.",
    "Run code ko examples par chalata hai, kuch record nahi hota. Submit har test par jaanchta hai.",
    "चलाएँ कोड को उदाहरणों पर चलाता है, कुछ दर्ज नहीं होता। जमा करें हर टेस्ट पर जाँचता है।",
  ],
  nothingYet: ["Run or submit to see the result here.", "Run ya Submit karo, nateeja yahan dikhega.", "चलाएँ या जमा करें, परिणाम यहाँ दिखेगा।"],
  passed: ["Accepted", "Accepted", "स्वीकृत"],
  wrong_answer: ["Wrong answer", "Galat jawab", "ग़लत उत्तर"],
  time_limit: ["Time limit exceeded", "Time limit paar", "समय सीमा पार"],
  memory_limit: ["Memory limit exceeded", "Memory limit paar", "मेमोरी सीमा पार"],
  runtime_error: ["Runtime error", "Runtime error", "रनटाइम त्रुटि"],
  output_limit: ["Output limit exceeded", "Output limit paar", "आउटपुट सीमा पार"],
  checker_error: ["Could not be checked", "Jaancha nahi ja saka", "जाँचा नहीं जा सका"],
  compile_error: ["Compile error", "Compile error", "कंपाइल त्रुटि"],
  ran: ["Ran", "Chal gaya", "चल गया"],
  verdictOther: ["Not accepted", "Accepted nahi", "स्वीकृत नहीं"],
  passedOf: ["{passed} of {total} tests pass", "{total} me se {passed} test pass", "{total} में से {passed} टेस्ट पास"],
  examplesPass: ["{passed} of {total} examples pass", "{total} me se {passed} examples pass", "{total} में से {passed} उदाहरण पास"],
  testN: ["Test {n}", "Test {n}", "टेस्ट {n}"],
  hiddenTestN: ["Test {n} (hidden)", "Test {n} (chhupa)", "टेस्ट {n} (छिपा)"],
  failingTest: ["The first failing test: test {n}", "Pehla fail test: test {n}", "पहला फ़ेल टेस्ट: टेस्ट {n}"],
  hiddenNote: [
    "This test is hidden: its input is not shown, so no answer can be fitted to it.",
    "Ye test chhupa hai: iska input nahi dikhta, taaki jawab us par fit na kiya ja sake.",
    "यह टेस्ट छिपा है: इसका इनपुट नहीं दिखता, ताकि उत्तर उस पर फ़िट न किया जा सके।",
  ],
  yours: ["Yours", "Aapka", "आपका"],
  expected: ["Expected", "Sahi", "सही"],
  printed: ["Printed", "Print kiya", "प्रिंट किया"],
  stderr: ["Errors", "Errors", "त्रुटियाँ"],
  checker: ["The checker says", "Checker kehta hai", "चेकर कहता है"],
  noOutput: ["(nothing)", "(kuch nahi)", "(कुछ नहीं)"],
  timeUsed: ["{ms} ms", "{ms} ms", "{ms} ms"],
  askWhy: ["Why does it fail? Ask", "Fail kyun? Poochho", "फ़ेल क्यों? पूछें"],
  readEditorial: ["Read the editorial", "Editorial padho", "हल पढ़ें"],
  coins: ["+{n} coins", "+{n} coins", "+{n} सिक्के"],
  firstSolve: ["Your first solve of this problem.", "Is problem ka aapka pehla solve.", "इस प्रश्न का आपका पहला हल।"],
  busy: ["The judge could not run this just now. Your code is safe here; try again in a minute.", "Judge abhi ise chala nahi paya. Code yahan safe hai; ek minute baad phir koshish karo.", "जज अभी इसे चला नहीं पाया। कोड यहाँ सुरक्षित है; एक मिनट बाद फिर कोशिश करें।"],
  queued: ["No network: the submission is kept on this device and goes when you are online.", "Net nahi: submission is device par rakha, online hote hi jayega.", "नेट नहीं: सबमिशन इस डिवाइस पर रखा है, ऑनलाइन होते ही जाएगा।"],
  yourAnswer: ["Your answer", "Aapka jawab", "आपका उत्तर"],
  correct: ["Correct", "Sahi", "सही"],
  incorrect: ["Not correct", "Sahi nahi", "सही नहीं"],
  notFoundTitle: ["No problem at this address", "Is pate par koi problem nahi", "इस पते पर कोई प्रश्न नहीं"],
  notFoundBody: ["It may have been moved or taken down. Abhyas has every problem.", "Shayad hata ya badal diya gaya. Abhyas me har problem hai.", "शायद हटा या बदल दिया गया। अभ्यास में हर प्रश्न है।"],
  toProblems: ["Open Abhyas", "Abhyas kholo", "अभ्यास खोलें"],
} as const satisfies Record<string, Tri>;

type Pane = "stmt" | "code" | "ai";
type Side = "statement" | "editorial" | "submissions" | "note";

const Play = icon("play", <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />);
const Send = icon(
  "send",
  <>
    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
    <path d="m21.854 2.147-10.94 10.939" />
  </>,
);
const RotateCcw = icon(
  "rotate-ccw",
  <>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </>,
);
const Lock = icon(
  "lock",
  <>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>,
);
const CircleCheck = icon(
  "circle-check",
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </>,
);
const CircleX = icon(
  "circle-x",
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </>,
);
const Lightbulb = icon(
  "lightbulb",
  <>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </>,
);
const X = icon(
  "x",
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
);
const FileText = icon(
  "file-text",
  <>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </>,
);

/**
 * The editor the practice site already uses (CodeMirror), in its own chunk,
 * loaded only when a code problem opens; a plain text box stands in until then.
 */
const CodeEditor = lazy(() => import("../components/CodeEditor.tsx").then((m) => ({ default: m.CodeEditor })));

const draftKey = (site: string, slug: string) => `parikshaa.practice.${site}.draft.${slug}`;
/** The draft as the old site keeps it: `{language, source}` as JSON for code, the answer itself otherwise. */
export function loadDraft(site: string, slug: string): string {
  try {
    return localStorage.getItem(draftKey(site, slug)) ?? "";
  } catch {
    return "";
  }
}
function saveDraft(site: string, slug: string, value: string): void {
  try {
    localStorage.setItem(draftKey(site, slug), value);
  } catch {
    // A private window: the draft lasts this page.
  }
}

/** A verdict's name: the judge's statuses, and a word for any it may add later. */
export const verdictWord = (status: string): Tri => (Object.hasOwn(LW, status) && /^[a-z_]+$/.test(status) ? (LW[status as keyof typeof LW] as Tri) : LW.verdictOther);

/** The statement without its first paragraph when that is the title, as the bank writes it ("Title\n\nWhat to do…"). */
export function statementBody(stem: string, title: string): string {
  const split = splitStem(stem);
  return split.title.trim().toLowerCase() === title.trim().toLowerCase() ? split.body : stem;
}

/** What the API's refusal means here, in the learner's words; null for anything else. */
function refusal(error: unknown): Tri | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === "no_credits") return LW.noCredits;
  if (error.code === "tutor_closed") return LW.tutorClosed;
  if (error.code === "unavailable" || error.status === 503) return LW.tutorOff;
  return null;
}

/* ---------------- the screen ---------------- */

export interface WorkspaceProps {
  readonly slug: string;
  /** The shell's ⋯ menu: language, theme, the current site, sign out. */
  readonly more: ReactNode;
  /** Where "back" goes: the screen the learner came from, else Abhyas. */
  readonly back: string;
  /** Sahayak's pane: the shell's state, so Ctrl+J, the button and "Fail kyun?" all open the same pane. */
  readonly ai: boolean;
  readonly setAi: (open: boolean) => void;
}

export function Workspace({ slug, more, back, ai, setAi }: WorkspaceProps) {
  const { t, href, go } = useLearn();
  const problem = useProblem(slug);
  const backLink: KitLink = {
    href: href(back),
    label: t(LW.back),
    onNavigate: (event) => {
      event.preventDefault();
      go(back);
    },
  };
  const bar = (title: string, sub?: string, right?: ReactNode) => <FocusBar back={backLink} title={title} {...(sub === undefined ? {} : { sub })} right={right} more={more} />;
  if (problem.data === undefined) {
    let body: ReactNode;
    if (waitingForNetwork(problem)) body = <Offline waiting />;
    else if (problem.isPending) body = <Loading shape="workspace" />;
    else if (problem.error instanceof ApiError && problem.error.status === 404) {
      body = (
        <Empty
          icon={<CodeXml />}
          title={t(LW.notFoundTitle)}
          body={t(LW.notFoundBody)}
          action={
            <ScreenLink to="practice" className="ln-btn ln-btn-pri">
              {t(LW.toProblems)}
            </ScreenLink>
          }
        />
      );
    } else body = <Failed error={problem.error} onRetry={() => void problem.refetch()} retrying={problem.isFetching} />;
    return (
      <div className="lw">
        {bar(t(PROBLEM_SCREEN.title))}
        <div className="lw-state">{body}</div>
      </div>
    );
  }
  return <Loaded problem={problem.data} bar={bar} ai={ai} setAi={setAi} />;
}

function Loaded({
  problem,
  bar,
  ai,
  setAi,
}: {
  readonly problem: Problem;
  readonly bar: (title: string, sub?: string, right?: ReactNode) => ReactNode;
  readonly ai: boolean;
  readonly setAi: (open: boolean) => void;
}) {
  const { t, site } = useLearn();
  const panes = usePanes<"stmt" | "code">({ stmt: true, code: true });
  const [phoneTab, setPhoneTab] = useState<Pane>("code");
  const [side, setSide] = useState<Side>("statement");
  const [value, setValue] = useState(() => loadDraft(site, problem.slug));
  const change = (next: string) => {
    setValue(next);
    saveDraft(site, problem.slug, next);
  };
  const open = { ...panes.open, ai };
  const toggle = (id: Pane) => (id === "ai" ? setAi(!ai) : panes.toggle(id));
  const openAi = () => {
    setAi(true);
    setPhoneTab("ai");
  };
  const code = problem.question.kind === "code";
  const labels: Record<Pane, string> = { stmt: t(LW.problem), code: t(code ? LW.code : LW.answer), ai: t(T.sahayak) };
  const icons: Record<Pane, ReactNode> = { stmt: <FileText />, code: <CodeXml />, ai: <Sparkles /> };
  const sub = [t(LW[problem.difficulty]), ...problem.tags.slice(0, 2)].join(" · ");
  const toggles = (
    <div className="lw-toggles" role="group" aria-label={t(LW.paneToggles)}>
      {(["stmt", "code", "ai"] as const).map((id) => (
        <button key={id} type="button" className={`ln-btn ln-btn-sm${id === "ai" ? " ln-btn-ai" : ""}${open[id] ? " ln-on" : ""}`} aria-pressed={open[id]} onClick={() => toggle(id)} {...(id === "ai" ? { "aria-keyshortcuts": "Control+J" } : {})}>
          {icons[id]}
          {labels[id]}
        </button>
      ))}
    </div>
  );
  return (
    <div className="lw">
      {bar(problem.title, sub, toggles)}
      <Panes<Pane>
        className="lw-panes"
        open={open}
        toggle={toggle}
        phoneTab={phoneTab}
        onPhoneTab={setPhoneTab}
        tabsLabel={t(LW.panesTabs)}
        railLabel={(pane) => fill(t(LW.show), { pane: pane.label })}
        resizeLabel={(a, b) => fill(t(LW.resize), { a: a.label, b: b.label })}
        panes={[
          {
            id: "stmt",
            label: labels.stmt,
            icon: icons.stmt,
            weight: 0.36,
            min: 300,
            content: <ProblemPane problem={problem} side={side} setSide={setSide} onClose={() => panes.toggle("stmt")} onLoad={change} />,
          },
          {
            id: "code",
            label: labels.code,
            icon: icons.code,
            weight: 0.42,
            min: 380,
            content: code ? (
              <CodePane problem={problem} question={problem.question as CandidateCodeQuestion} value={value} onChange={change} onClose={() => panes.toggle("code")} onAskWhy={openAi} onEditorial={() => setSide("editorial")} />
            ) : (
              <AnswerPane problem={problem} value={value} onChange={change} onClose={() => panes.toggle("code")} onAskWhy={openAi} onEditorial={() => setSide("editorial")} />
            ),
          },
          { id: "ai", label: labels.ai, icon: icons.ai, tone: "ai", weight: 0.3, min: 320, rail: false, content: <SahayakPane open={ai} onClose={() => setAi(false)} /> },
        ]}
      />
    </div>
  );
}

/* ---------------- the problem pane: statement, editorial, submissions ---------------- */

function ProblemPane({
  problem,
  side,
  setSide,
  onClose,
  onLoad,
}: {
  readonly problem: Problem;
  readonly side: Side;
  readonly setSide: (side: Side) => void;
  readonly onClose: () => void;
  readonly onLoad: (value: string) => void;
}) {
  const { t } = useLearn();
  const { signedIn } = useLearnData();
  const id = useId();
  const submissions = useSubmissions(signedIn ? problem.slug : null);
  const tabs: readonly [Side, Tri, ReactNode][] = [
    ["statement", LW.tabStatement, <FileText key="i" />],
    ["editorial", LW.tabEditorial, <BookOpen key="i" />],
    ["submissions", LW.tabSubmissions, null],
    ["note", LW.tabNote, null],
  ];
  const count = submissions.data?.length ?? 0;
  const onKey = (event: KeyboardEvent, index: number) => {
    const to = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length : null;
    if (to === null) return;
    event.preventDefault();
    setSide(tabs[to]![0]);
    document.getElementById(`${id}-tab-${tabs[to]![0]}`)?.focus();
  };
  return (
    <>
      <PaneHead onClose={onClose} closeLabel={fill(t(LW.hide), { pane: t(LW.problem) })}>
        <div className="lw-tabs" role="tablist" aria-label={t(LW.problem)}>
          {tabs.map(([name, label, glyph], index) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`${id}-tab-${name}`}
              aria-selected={side === name}
              aria-controls={`${id}-panel`}
              tabIndex={side === name ? 0 : -1}
              className={side === name ? "lw-tab lw-on" : "lw-tab"}
              onClick={() => setSide(name)}
              onKeyDown={(event) => onKey(event, index)}
            >
              {glyph}
              {t(label)}
              {name === "submissions" && count > 0 ? <span className="lw-count">{count}</span> : null}
            </button>
          ))}
        </div>
      </PaneHead>
      <div className="lw-body" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${side}`} tabIndex={0}>
        {side === "statement" ? (
          <Statement problem={problem} />
        ) : side === "editorial" ? (
          <Editorial problem={problem} failures={(submissions.data ?? []).filter((s) => s.status !== "passed").length} />
        ) : side === "submissions" ? (
          <Submissions problem={problem} onLoad={onLoad} />
        ) : (
          <ProblemNote slug={problem.slug} />
        )}
      </div>
    </>
  );
}

function Statement({ problem }: { readonly problem: Problem }) {
  const { t } = useLearn();
  const q = problem.question;
  const copy = { label: t(LW.copy), done: t(LW.copied) };
  const percent = problem.acceptance === null ? null : Math.round(problem.acceptance * 100);
  return (
    <div className="lw-stmt">
      <h2 className="lw-stmt-h">{problem.title}</h2>
      <div className="lw-meta">
        <span className={`ln-badge lw-lvl lw-lvl-${problem.difficulty}`}>{t(LW[problem.difficulty])}</span>
        {problem.status === "solved" ? (
          <span className="ln-badge ln-tone-tick">
            <CircleCheck aria-hidden="true" />
            {t(LW.stSolved)}
          </span>
        ) : problem.status === "attempted" ? (
          <span className="ln-badge">{t(LW.stTried)}</span>
        ) : null}
        {problem.tags.map((tag) => (
          <span key={tag} className="ln-badge lw-tag">
            {tag}
          </span>
        ))}
        <span className="ln-faint lw-small">
          {fill(t(LW.solvedBy), { n: problem.solvedBy })}
          {percent === null ? null : ` · ${fill(t(LW.acceptance), { p: percent })}`}
        </span>
      </div>
      <div className="ln-md">
        <Markdown source={statementBody(q.stem, problem.title)} copy={copy} />
      </div>
      {q.kind === "code" ? <CodeSections question={q} /> : null}
      <Hints problem={problem} />
    </div>
  );
}

function CodeSections({ question }: { readonly question: CandidateCodeQuestion }) {
  const { t } = useLearn();
  const parts: readonly [Tri, string | null][] = [
    [LW.inputFormat, question.inputFormat],
    [LW.outputFormat, question.outputFormat],
    [LW.constraints, question.constraints],
  ];
  return (
    <>
      {parts.map(([label, text]) =>
        text === null || text.trim() === "" ? null : (
          <section key={label[0]} className="lw-part">
            <h3 className="lw-part-h">{t(label)}</h3>
            <div className="ln-md">
              <Markdown source={text} />
            </div>
          </section>
        ),
      )}
      {question.samples.map((sample, i) => (
        <section key={i} className="lw-part">
          <h3 className="lw-part-h">{fill(t(LW.example), { n: i + 1 })}</h3>
          <dl className="lw-ex">
            <dt>{t(LW.input)}</dt>
            <dd>
              <Input question={question} input={sample.input} />
            </dd>
            <dt>{t(LW.output)}</dt>
            <dd>
              <pre tabIndex={0}>{sample.output}</pre>
            </dd>
            {sample.explanation === null || sample.explanation.trim() === "" ? null : (
              <>
                <dt>{t(LW.why)}</dt>
                <dd className="ln-md">
                  <Markdown source={sample.explanation} />
                </dd>
              </>
            )}
          </dl>
        </section>
      ))}
    </>
  );
}

/** An input as the learner reads it: a function's arguments by name, else the program's input as it is. */
function Input({ question, input }: { readonly question: CandidateCodeQuestion; readonly input: string }) {
  if (question.function === null) return <pre tabIndex={0}>{input}</pre>;
  const values = argumentsOf(input);
  return (
    <div className="lw-args">
      {question.function.params.map((p, i) => (
        <div key={p.name}>
          <span className="lw-arg">{p.name} =</span> <code>{values[i] ?? ""}</code>
        </div>
      ))}
    </div>
  );
}

function Hints({ problem }: { readonly problem: Problem }) {
  const { t, site, lang } = useLearn();
  const { signedIn, client } = useLearnData();
  const online = useOnline();
  const queryClient = useQueryClient();
  const id = useId();
  const tutor = useTutor(problem.slug, signedIn && problem.contest === null);
  const hint = useMutation({
    mutationFn: (): Promise<TutorAnswer> => {
      const draft = readCodeAnswer(loadDraft(site, problem.slug), problem.question.kind === "code" ? (problem.question as CandidateCodeQuestion) : CODELESS);
      return client.hint(problem.slug, lang === "hi" ? "hi" : "en", problem.question.kind === "code" && draft.source.trim() !== "" ? draft : undefined);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["practice", site, "prep"] }),
  });
  if (problem.contest !== null) return null;
  const head = (
    <h3 className="lw-part-h" id={`${id}-h`}>
      <Lightbulb aria-hidden="true" />
      {t(LW.hints)}
    </h3>
  );
  if (!signedIn) {
    return (
      <section className="lw-hints" aria-labelledby={`${id}-h`}>
        {head}
        <p className="ln-faint lw-small">
          <ScreenLink to={`signin?next=${encodeURIComponent(`problems/${problem.slug}`)}`}>{t(LW.hintSignIn)}</ScreenLink>
        </p>
      </section>
    );
  }
  if (tutor.isPending || tutor.isError) {
    return (
      <section className="lw-hints" aria-labelledby={`${id}-h`}>
        {head}
        {tutor.isError ? <Failed error={tutor.error} onRetry={() => void tutor.refetch()} retrying={tutor.isFetching} headingLevel={3} /> : <Loading shape="list" />}
      </section>
    );
  }
  const opened = tutor.data.entries.filter((e) => e.mode === "hint");
  const next = tutor.data.nextHint;
  const why = hint.isError ? refusal(hint.error) : null;
  return (
    <section className="lw-hints" aria-labelledby={`${id}-h`}>
      {head}
      <p className="ln-faint lw-small">{t(LW.hintsNote)}</p>
      <ol className="lw-hint-list">
        {opened.map((entry) => (
          <li key={entry.id} className="lw-hint lw-open">
            <b className="lw-hint-h">{fill(t(LW.hintN), { n: entry.hintLevel ?? 0 })}</b>
            <div className="ln-md">
              <Markdown source={entry.answer} />
            </div>
          </li>
        ))}
      </ol>
      {next === null ? (
        <p className="ln-faint lw-small">{t(LW.hintsDone)}</p>
      ) : !next.available ? (
        <p className="ln-faint lw-small">
          <Lock aria-hidden="true" /> {fill(t(LW.hintLater), { n: 3 })}
        </p>
      ) : (
        <button type="button" className="ln-btn ln-btn-sm lw-hint-next" disabled={hint.isPending || !online} onClick={() => hint.mutate()}>
          <Lightbulb aria-hidden="true" />
          {fill(t(LW.openHint), { n: next.level })}{" "}
          <span className="ln-faint">· {next.credits === 0 ? t(LW.free) : fill(t(LW.credits), { n: next.credits })}</span>
        </button>
      )}
      {!hint.isError ? null : why === null ? (
        <Failed error={hint.error} onRetry={() => hint.mutate()} headingLevel={3} />
      ) : (
        <p className="ln-notice ln-notice-error" role="alert">
          <span className="ln-grow">{t(why)}</span>
          {why === LW.noCredits ? (
            <a className="ln-btn ln-btn-sm" href={`/practice/${encodeURIComponent(site)}/plus?learn_v2=0`}>
              {t(LW.getCredits)}
            </a>
          ) : null}
        </p>
      )}
    </section>
  );
}

/** For reading a choice problem's draft as code: it has none. */
const CODELESS = { language: "", starter: "", starters: {} } as unknown as CandidateCodeQuestion;

function Editorial({ problem, failures }: { readonly problem: Problem; readonly failures: number }) {
  const { t } = useLearn();
  const copy = { label: t(LW.copy), done: t(LW.copied) };
  const [shown, setShown] = useState(0);
  const split = useMemo(() => (problem.editorial === null ? null : approachesOf(problem.editorial)), [problem.editorial]);
  if (problem.editorial === null) {
    if (!problem.editorialLocked) return <Empty icon={<BookOpen />} title={t(LW.noEditorial)} headingLevel={3} />;
    return (
      <div className="lw-locked">
        <Lock aria-hidden="true" />
        <p>{problem.contest !== null ? t(LW.editorialContest) : fill(t(LW.editorialLocked), { n: 3 })}</p>
        {problem.contest !== null ? null : <p className="ln-faint lw-small">{fill(t(LW.editorialTries), { done: Math.min(failures, 3), n: 3 })}</p>}
      </div>
    );
  }
  if (split === null) {
    return (
      <div className="ln-md lw-ed">
        <Markdown source={problem.editorial} copy={copy} />
      </div>
    );
  }
  const at = Math.min(shown, split.approaches.length - 1);
  const approach = split.approaches[at]!;
  return (
    <div className="lw-ed">
      {split.intro === "" ? null : (
        <div className="ln-md">
          <Markdown source={split.intro} copy={copy} />
        </div>
      )}
      <div className="lw-seg" role="group" aria-label={t(LW.approaches)}>
        {split.approaches.map((a, i) => (
          <button key={`${i}-${a.title}`} type="button" aria-pressed={i === at} className={i === at ? "lw-on" : undefined} onClick={() => setShown(i)}>
            {a.title}
          </button>
        ))}
      </div>
      <section className="ln-md" aria-label={approach.title}>
        <Markdown source={approach.body} copy={copy} />
      </section>
    </div>
  );
}

function Submissions({ problem, onLoad }: { readonly problem: Problem; readonly onLoad: (value: string) => void }) {
  const { t, lang, notify } = useLearn();
  const { signedIn } = useLearnData();
  const list = useSubmissions(signedIn ? problem.slug : null);
  const [open, setOpen] = useState<string | null>(null);
  if (!signedIn) {
    return (
      <p className="lw-pad">
        <ScreenLink to={`signin?next=${encodeURIComponent(`problems/${problem.slug}`)}`} className="ln-btn ln-btn-pri">
          {t(LW.subsSignIn)}
        </ScreenLink>
      </p>
    );
  }
  if (waitingForNetwork(list)) return <Offline waiting />;
  if (list.isPending) return <Loading shape="list" />;
  if (list.isError) return <Failed error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} headingLevel={3} />;
  if (list.data.length === 0) return <Empty icon={<Send />} title={t(LW.noSubs)} headingLevel={3} />;
  const when = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const code = problem.question.kind === "code";
  return (
    <ol className="lw-subs">
      {list.data.map((s: Submission, i) => {
        const n = list.data.length - i;
        const ok = s.status === "passed";
        return (
          <li key={s.id} className={ok ? "lw-sub lw-ok" : "lw-sub lw-bad"}>
            <button type="button" className="lw-sub-row" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
              {ok ? <CircleCheck aria-hidden="true" className="lw-ic-ok" /> : <CircleX aria-hidden="true" className="lw-ic-bad" />}
              <span className="lw-sub-main">
                <b>{t(verdictWord(s.status))}</b>
                <span className="ln-faint lw-small">
                  {fill(t(LW.subN), { n })}
                  {s.total > 0 ? ` · ${fill(t(LW.testsPassed), { passed: s.passed, total: s.total })}` : ""}
                  {s.language === null ? "" : ` · ${LANGUAGE_NAMES[s.language] ?? s.language}`}
                  {s.timeMs === null ? "" : ` · ${s.timeMs} ms`}
                  {memory(s.memoryKb) === null ? "" : ` · ${memory(s.memoryKb)}`}
                </span>
              </span>
              <time className="ln-faint lw-small ln-dated" dateTime={s.createdAt}>
                {when.format(new Date(s.createdAt))}
              </time>
            </button>
            {open === s.id ? (
              <div className="lw-sub-code">
                <pre tabIndex={0} aria-label={fill(t(LW.subN), { n })}>
                  {s.answer}
                </pre>
                <button
                  type="button"
                  className="ln-btn ln-btn-sm"
                  onClick={() => {
                    if (!window.confirm(t(LW.loadConfirm))) return;
                    onLoad(code ? JSON.stringify({ language: s.language ?? (problem.question as CandidateCodeQuestion).language, source: s.answer }) : s.answer);
                    notify({ tone: "ok", text: t(LW.loaded) });
                  }}
                >
                  <RotateCcw aria-hidden="true" />
                  {t(LW.loadCode)}
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** The learner's note on the problem (`GET`/`PUT /notes/problem/<problem>`, Markdown), as on a lesson; revision shows it. */
function ProblemNote({ slug }: { readonly slug: string }) {
  const { t, site, notify } = useLearn();
  const { signedIn, client } = useLearnData();
  const online = useOnline();
  const queryClient = useQueryClient();
  const id = useId();
  const note = useLearnQuery(["note", "problem", slug], (c) => c.note("problem", slug), { enabled: signedIn });
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) box.current?.focus();
  }, [editing]);
  const save = useMutation({
    mutationFn: () => client.saveNote("problem", slug, body),
    onSuccess: async () => {
      setEditing(false);
      notify({ tone: "ok", text: t(LW.noteSaved) });
      await queryClient.invalidateQueries({ queryKey: ["practice", site] });
    },
  });
  if (!signedIn) {
    return (
      <p className="lw-pad">
        <ScreenLink to={`signin?next=${encodeURIComponent(`problems/${slug}`)}`} className="ln-btn ln-btn-pri">
          {t(LW.noteSignIn)}
        </ScreenLink>
      </p>
    );
  }
  if (note.isPending) return <Loading shape="doc" />;
  if (note.isError) return <Failed error={note.error} onRetry={() => void note.refetch()} retrying={note.isFetching} headingLevel={3} />;
  const saved = note.data.body;
  return (
    <div className="lw-note">
      {editing ? (
        <form
          className="lw-note-form"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label className="ln-field">
            <span>{t(LW.noteText)}</span>
            <textarea ref={box} className="ln-input" rows={8} maxLength={50_000} value={body} onChange={(event) => setBody(event.target.value)} aria-describedby={`${id}-hint`} />
          </label>
          <p className="ln-faint lw-small" id={`${id}-hint`}>
            {t(LW.noteHint)}
          </p>
          {save.isError ? <Failed error={save.error} onRetry={() => save.mutate()} headingLevel={3} /> : null}
          <div className="lw-v-acts">
            <button type="submit" className="ln-btn ln-btn-pri ln-btn-sm" disabled={save.isPending || !online}>
              {t(LW.noteSave)}
            </button>
            <button type="button" className="ln-btn ln-btn-ghost ln-btn-sm" onClick={() => setEditing(false)}>
              {t(LW.noteCancel)}
            </button>
          </div>
        </form>
      ) : (
        <>
          {saved === "" ? (
            <p className="ln-faint">{t(LW.noteNone)}</p>
          ) : (
            <div className="ln-md">
              <Markdown source={saved} />
            </div>
          )}
          <button
            type="button"
            className="ln-btn ln-btn-sm"
            onClick={() => {
              setBody(saved);
              setEditing(true);
            }}
          >
            {t(saved === "" ? LW.noteWrite : LW.noteEdit)}
          </button>
        </>
      )}
    </div>
  );
}

/* ---------------- the code pane: editor, tests, result ---------------- */

type Shown = { readonly kind: "run"; readonly outcome: RunOutcome; readonly custom: boolean } | { readonly kind: "submit"; readonly verdict: Verdict };

/** What a failed run or submit says: kept for later offline, the judge busy, or the shared error. */
function trouble(error: unknown): Tri | null {
  if (error instanceof ApiError && error.code === "queued_offline") return LW.queued;
  if (error instanceof ApiError && (error.status === 503 || error.code === "runner_unavailable" || error.code === "judge_busy")) return LW.busy;
  return null;
}

function CodePane({
  problem,
  question,
  value,
  onChange,
  onClose,
  onAskWhy,
  onEditorial,
}: {
  readonly problem: Problem;
  readonly question: CandidateCodeQuestion;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onClose: () => void;
  readonly onAskWhy: () => void;
  readonly onEditorial: () => void;
}) {
  const { t, theme, site } = useLearn();
  const { signedIn, client } = useLearnData();
  const online = useOnline();
  const queryClient = useQueryClient();
  const id = useId();
  const { language, source } = readCodeAnswer(value, question);
  const [tab, setTab] = useState<"testcase" | "result">("testcase");
  const [picked, setPicked] = useState<number | "custom">(question.samples.length > 0 ? 0 : "custom");
  const [custom, setCustom] = useState(question.samples[0]?.input ?? "");
  const [shown, setShown] = useState<Shown | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const write = (next: { language: string; source: string }) => onChange(JSON.stringify(next));

  const run = useMutation({
    mutationFn: () => client.run(problem.slug, language, source, picked === "custom" ? custom : undefined),
    onMutate: () => setTab("result"),
    onSuccess: (outcome) => setShown({ kind: "run", outcome, custom: picked === "custom" }),
  });
  const submit = useMutation({
    mutationFn: () => client.submit(problem.slug, source, language),
    onMutate: () => setTab("result"),
    onSuccess: async (verdict) => {
      setShown({ kind: "submit", verdict });
      await queryClient.invalidateQueries({ queryKey: ["practice", site] });
    },
  });
  const busy = run.isPending || submit.isPending;
  const failed = run.isError ? run.error : submit.isError ? submit.error : null;
  const canAct = signedIn && online && !busy && source.trim() !== "";
  const doRun = () => {
    if (!canAct) return;
    submit.reset();
    run.mutate();
  };
  const doSubmit = () => {
    if (!canAct) return;
    run.reset();
    submit.mutate();
  };
  useEffect(() => {
    if (shown !== null) resultRef.current?.focus({ preventScroll: true });
  }, [shown]);

  const switchLanguage = (next: string) => {
    // Untouched starter code follows the language; anything the learner wrote stays.
    const untouched = source.trim() === "" || source === starterIn(question, language);
    write({ language: next, source: untouched ? starterIn(question, next) : source });
  };
  const reset = () => {
    if (window.confirm(t(LW.resetConfirm))) write({ language, source: starterIn(question, language) });
  };

  const plain = (
    <textarea className="lw-plain" aria-label={t(LW.editor)} spellCheck={false} value={source} onChange={(event) => write({ language, source: event.target.value })} />
  );
  const tabs = [
    ["testcase", LW.testcase],
    ["result", LW.result],
  ] as const;
  const trouble_ = failed === null ? null : trouble(failed);
  return (
    <>
      <PaneHead onClose={onClose} closeLabel={fill(t(LW.hide), { pane: t(LW.code) })}>
        <span className="lw-file">
          <CodeXml aria-hidden="true" />
          {t(LW.code)}
        </span>
        <span className="ln-grow" />
        {question.languages.length > 1 ? (
          <select className="lw-select" aria-label={t(LW.language)} value={language} onChange={(event) => switchLanguage(event.target.value)}>
            {question.languages.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_NAMES[l] ?? l}
              </option>
            ))}
          </select>
        ) : (
          <span className="ln-faint lw-small">{LANGUAGE_NAMES[language] ?? language}</span>
        )}
        <button type="button" className="ln-icon-btn ln-sm" onClick={reset} aria-label={t(LW.reset)} title={t(LW.reset)}>
          <RotateCcw aria-hidden="true" />
        </button>
      </PaneHead>
      <div className="lw-editor">
        <Suspense fallback={plain}>
          <CodeEditor value={source} language={language} label={t(LW.editor)} disabled={false} onChange={(next) => write({ language, source: next })} dark={theme === "dark"} completion onRunShortcut={doRun} onSubmitShortcut={doSubmit} />
        </Suspense>
      </div>
      <section className="lw-console" aria-label={t(LW.console)}>
        <div className="lw-console-tabs" role="tablist" aria-label={t(LW.console)}>
          {tabs.map(([name, label]) => (
            <button key={name} type="button" role="tab" id={`${id}-${name}`} aria-selected={tab === name} aria-controls={`${id}-console`} className={tab === name ? "lw-tab lw-on" : "lw-tab"} onClick={() => setTab(name)}>
              {t(label)}
            </button>
          ))}
        </div>
        <div className="lw-console-body" role="tabpanel" id={`${id}-console`} aria-labelledby={`${id}-${tab}`} tabIndex={0} ref={resultRef}>
          {tab === "testcase" ? (
            <>
              <div className="lw-chips">
                {question.samples.map((_s, i) => (
                  <button key={i} type="button" className="lw-chip" aria-pressed={picked === i} onClick={() => setPicked(i)}>
                    {fill(t(LW.caseN), { n: i + 1 })}
                  </button>
                ))}
                <button type="button" className="lw-chip" aria-pressed={picked === "custom"} onClick={() => setPicked("custom")}>
                  {t(LW.custom)}
                </button>
              </div>
              {picked === "custom" ? (
                <label className="ln-field">
                  <span>{t(LW.customStdin)}</span>
                  <textarea className="ln-input lw-mono" rows={4} spellCheck={false} value={custom} onChange={(event) => setCustom(event.target.value)} />
                </label>
              ) : (
                <Input question={question} input={question.samples[picked]?.input ?? ""} />
              )}
              <p className="ln-faint lw-small">{t(LW.runNote)}</p>
            </>
          ) : busy ? (
            <p className="ln-faint" role="status">
              {run.isPending ? t(LW.running) : t(LW.judging)}
            </p>
          ) : failed !== null ? (
            trouble_ === null ? (
              <Failed error={failed} onRetry={() => (run.isError ? run.mutate() : submit.mutate())} headingLevel={3} />
            ) : (
              <p className="ln-notice ln-notice-info" role="status">
                {t(trouble_)}
              </p>
            )
          ) : shown === null ? (
            <p className="ln-faint">{t(LW.nothingYet)}</p>
          ) : shown.kind === "run" ? (
            <RunView question={question} outcome={shown.outcome} custom={shown.custom} />
          ) : (
            <VerdictView question={question} verdict={shown.verdict} onAskWhy={onAskWhy} onEditorial={onEditorial} />
          )}
        </div>
      </section>
      <div className="lw-status">
        {online ? (
          <span className="ln-faint lw-small">{t(LW.saved)}</span>
        ) : (
          <span className="lw-small lw-off" role="status">
            {t(LW.offline)}
          </span>
        )}
        <span className="ln-grow" />
        {signedIn ? (
          <>
            <span className="ln-faint lw-small lw-keys">{t(LW.shortcuts)}</span>
            <button type="button" className="ln-btn ln-btn-sm" disabled={!canAct} onClick={doRun} aria-keyshortcuts="Control+Enter">
              <Play aria-hidden="true" />
              {run.isPending ? t(LW.running) : t(LW.run)}
            </button>
            <button type="button" className="ln-btn ln-btn-sm ln-btn-pri" disabled={!canAct} onClick={doSubmit} aria-keyshortcuts="Control+'">
              <Send aria-hidden="true" />
              {submit.isPending ? t(LW.judging) : t(LW.submit)}
            </button>
          </>
        ) : (
          <ScreenLink to={`signin?next=${encodeURIComponent(`problems/${problem.slug}`)}`} className="ln-btn ln-btn-sm ln-btn-pri">
            {t(LW.signInToRun)}
          </ScreenLink>
        )}
      </div>
    </>
  );
}

function Block({ label, text }: { readonly label: string; readonly text: string }) {
  const { t } = useLearn();
  return (
    <div className="lw-block">
      <span className="ln-eyebrow">{label}</span>
      <pre tabIndex={0} aria-label={label}>
        {text === "" ? t(LW.noOutput) : text}
      </pre>
    </div>
  );
}

/** What Run did: each example's outcome, or the learner's own input. */
function RunView({ question, outcome, custom }: { readonly question: CandidateCodeQuestion; readonly outcome: RunOutcome; readonly custom: boolean }) {
  const { t } = useLearn();
  const [at, setAt] = useState(0);
  if (!outcome.compiled) {
    return (
      <div className="lw-verdict" data-status="compile_error">
        <p className="lw-v-title lw-bad">
          <CircleX aria-hidden="true" />
          {t(LW.compile_error)}
        </p>
        <Block label={t(LW.stderr)} text={outcome.compileOutput} />
      </div>
    );
  }
  const results = outcome.results;
  const passed = results.filter((r) => r.status === "passed").length;
  const first = results.find((r) => r.status !== "passed" && r.status !== "ran")?.status;
  const r = results[Math.min(at, results.length - 1)];
  const fn = question.function !== null;
  return (
    <div className="lw-verdict" data-status={custom ? "ran" : (first ?? "passed")}>
      <p className={`lw-v-title ${first === undefined ? "lw-ok" : "lw-bad"}`}>
        {first === undefined ? <CircleCheck aria-hidden="true" /> : <CircleX aria-hidden="true" />}
        {custom ? t(LW.ran) : t(verdictWord(first ?? "passed"))}
        {custom ? null : <span className="ln-faint lw-small"> · {fill(t(LW.examplesPass), { passed, total: results.length })}</span>}
      </p>
      {results.length > 1 ? (
        <div className="lw-chips">
          {results.map((x, i) => (
            <button key={i} type="button" className={`lw-chip ${x.status === "passed" || x.status === "ran" ? "lw-ok" : "lw-bad"}`} aria-pressed={i === at} onClick={() => setAt(i)}>
              {x.status === "passed" ? <CircleCheck aria-hidden="true" /> : x.status === "ran" ? null : <CircleX aria-hidden="true" />}
              {fill(t(LW.caseN), { n: i + 1 })}
              <span className="ln-sr"> ({t(verdictWord(x.status))})</span>
            </button>
          ))}
        </div>
      ) : null}
      {r === undefined ? null : (
        <div className="lw-case">
          <div className="lw-block">
            <span className="ln-eyebrow">{t(LW.input)}</span>
            <Input question={question} input={r.input} />
          </div>
          <Block label={t(LW.yours)} text={fn ? (r.result ?? "null") : r.stdout} />
          {r.expectedOutput === null ? null : <Block label={t(LW.expected)} text={r.expectedOutput} />}
          {fn && r.stdout !== "" ? <Block label={t(LW.printed)} text={r.stdout} /> : null}
          {r.stderr === "" ? null : <Block label={t(LW.stderr)} text={r.stderr} />}
          {r.checkerMessage === null || r.checkerMessage === undefined ? null : <Block label={t(LW.checker)} text={r.checkerMessage} />}
          <p className="ln-faint lw-small lw-time">{fill(t(LW.timeUsed), { ms: r.timeMs })}{memory(r.memoryKb) === null ? "" : ` · ${memory(r.memoryKb)}`}</p>
        </div>
      )}
    </div>
  );
}

/** What Submit found: the verdict, how many tests pass, a bar of every test, and the first failing one where it may be shown. */
function VerdictView({ question, verdict, onAskWhy, onEditorial }: { readonly question: CandidateCodeQuestion; readonly verdict: Verdict; readonly onAskWhy: () => void; readonly onEditorial: () => void }) {
  const { t } = useLearn();
  const ok = verdict.status === "passed";
  const fn = question.function !== null;
  const failing = verdict.cases.find((c) => c.status !== "passed");
  const slowest = Math.max(0, ...verdict.cases.map((c) => c.timeMs));
  return (
    <div className="lw-verdict" data-status={verdict.status}>
      <div className="lw-v-head">
        <p className={`lw-v-title ${ok ? "lw-ok" : "lw-bad"}`}>
          {ok ? <CircleCheck aria-hidden="true" /> : <CircleX aria-hidden="true" />}
          {t(verdictWord(verdict.status))}
        </p>
        {verdict.reward === undefined || verdict.reward.coins <= 0 ? null : <span className="ln-badge lw-coins">{fill(t(LW.coins), { n: verdict.reward.coins })}</span>}
      </div>
      {verdict.status === "compile_error" ? (
        <Block label={t(LW.stderr)} text={verdict.compileOutput ?? ""} />
      ) : (
        <>
          <p className="lw-small">
            {fill(t(LW.passedOf), { passed: verdict.passed, total: verdict.total })}
            <span className="ln-faint lw-time"> · {fill(t(LW.timeUsed), { ms: verdict.timeMs ?? slowest })}{memory(verdict.memoryKb) === null ? "" : ` · ${memory(verdict.memoryKb)}`}</span>
          </p>
          {verdict.cases.length === 0 ? null : (
            <ol className="lw-testbar" aria-label={fill(t(LW.passedOf), { passed: verdict.passed, total: verdict.total })}>
              {verdict.cases.map((c) => (
                <li key={c.number} className={c.status === "passed" ? "lw-ok" : "lw-bad"} title={`${fill(t(c.visible ? LW.testN : LW.hiddenTestN), { n: c.number })}: ${t(verdictWord(c.status))}`}>
                  <span className="ln-sr">
                    {fill(t(c.visible ? LW.testN : LW.hiddenTestN), { n: c.number })}: {t(verdictWord(c.status))}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {ok && verdict.firstSolve ? <p className="ln-notice ln-notice-ok">{t(LW.firstSolve)}</p> : null}
          {failing === undefined ? null : (
            <section className="lw-fail" aria-label={fill(t(LW.failingTest), { n: failing.number })}>
              <p className="ln-eyebrow">{fill(t(LW.failingTest), { n: failing.number })}</p>
              {failing.visible ? (
                <>
                  <div className="lw-block">
                    <span className="ln-eyebrow">{t(LW.input)}</span>
                    <Input question={question} input={failing.input ?? ""} />
                  </div>
                  <Block label={t(LW.yours)} text={fn ? (failing.result ?? "null") : (failing.stdout ?? "")} />
                  <Block label={t(LW.expected)} text={failing.expectedOutput ?? ""} />
                  {failing.stderr === null || failing.stderr === "" ? null : <Block label={t(LW.stderr)} text={failing.stderr} />}
                </>
              ) : (
                <p className="ln-faint lw-small">
                  <Lock aria-hidden="true" /> {t(LW.hiddenNote)}
                </p>
              )}
            </section>
          )}
        </>
      )}
      <div className="lw-v-acts">
        {ok ? null : (
          <button type="button" className="ln-btn ln-btn-sm ln-btn-ai" onClick={onAskWhy}>
            <Sparkles aria-hidden="true" />
            {t(LW.askWhy)}
          </button>
        )}
        <button type="button" className="ln-btn ln-btn-sm" onClick={onEditorial}>
          <BookOpen aria-hidden="true" />
          {t(LW.readEditorial)}
        </button>
      </div>
    </div>
  );
}

/* ---------------- a choice or number problem's answer ---------------- */

function AnswerPane({
  problem,
  value,
  onChange,
  onClose,
  onAskWhy,
  onEditorial,
}: {
  readonly problem: Problem;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onClose: () => void;
  readonly onAskWhy: () => void;
  readonly onEditorial: () => void;
}) {
  const { t, site } = useLearn();
  const { signedIn, client } = useLearnData();
  const online = useOnline();
  const queryClient = useQueryClient();
  const id = useId();
  const q: CandidateQuestion = problem.question;
  const outcome = useRef<HTMLDivElement>(null);
  const submit = useMutation({
    mutationFn: () => client.submit(problem.slug, value),
    onSuccess: async () => {
      outcome.current?.focus({ preventScroll: true });
      await queryClient.invalidateQueries({ queryKey: ["practice", site] });
    },
  });
  const why = submit.isError ? trouble(submit.error) : null;
  return (
    <>
      <PaneHead onClose={onClose} closeLabel={fill(t(LW.hide), { pane: t(LW.answer) })}>
        <span className="lw-file">{t(LW.yourAnswer)}</span>
      </PaneHead>
      <div className="lw-body lw-answer" tabIndex={0} aria-labelledby={`${id}-h`}>
        <h2 className="ln-h3" id={`${id}-h`}>
          {t(LW.yourAnswer)}
        </h2>
        {q.kind === "mcq" ? (
          <fieldset className="lw-options">
            <legend className="ln-sr">{t(LW.yourAnswer)}</legend>
            {q.options.map((option, i) => {
              const chosen = q.multiple ? value.split(",").includes(String(i)) : value === String(i);
              return (
                <label key={`${i}-${option}`} className={`lw-option${chosen ? " lw-on" : ""}`}>
                  <input
                    type={q.multiple ? "checkbox" : "radio"}
                    name={`${id}-opt`}
                    checked={chosen}
                    onChange={() => {
                      if (!q.multiple) return onChange(String(i));
                      const now = new Set(value === "" ? [] : value.split(","));
                      if (now.has(String(i))) now.delete(String(i));
                      else now.add(String(i));
                      onChange([...now].map(Number).sort((a, b) => a - b).join(","));
                    }}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </fieldset>
        ) : (
          <label className="ln-field">
            <span>{t(LW.yourAnswer)}</span>
            {q.kind === "short" ? (
              <textarea className="ln-input" rows={5} value={value} maxLength={20_000} onChange={(event) => onChange(event.target.value)} />
            ) : (
              <input className="ln-input" inputMode={q.kind === "numeric" ? "decimal" : "text"} value={value} maxLength={200} onChange={(event) => onChange(event.target.value)} />
            )}
          </label>
        )}
        <div ref={outcome} tabIndex={-1} className="lw-answer-out">
          {submit.data === undefined ? null : (
            <div className="lw-verdict" data-status={submit.data.status}>
              <p className={`lw-v-title ${submit.data.status === "passed" ? "lw-ok" : "lw-bad"}`} role="status">
                {submit.data.status === "passed" ? <CircleCheck aria-hidden="true" /> : <CircleX aria-hidden="true" />}
                {submit.data.status === "passed" ? t(LW.correct) : t(LW.incorrect)}
                {submit.data.reward === undefined || submit.data.reward.coins <= 0 ? null : <span className="ln-badge lw-coins">{fill(t(LW.coins), { n: submit.data.reward.coins })}</span>}
              </p>
              <div className="lw-v-acts">
                {submit.data.status === "passed" ? null : (
                  <button type="button" className="ln-btn ln-btn-sm ln-btn-ai" onClick={onAskWhy}>
                    <Sparkles aria-hidden="true" />
                    {t(LW.askWhy)}
                  </button>
                )}
                <button type="button" className="ln-btn ln-btn-sm" onClick={onEditorial}>
                  <BookOpen aria-hidden="true" />
                  {t(LW.readEditorial)}
                </button>
              </div>
            </div>
          )}
          {!submit.isError ? null : why === null ? (
            <Failed error={submit.error} onRetry={() => submit.mutate()} headingLevel={3} />
          ) : (
            <p className="ln-notice ln-notice-info" role="status">
              {t(why)}
            </p>
          )}
        </div>
      </div>
      <div className="lw-status">
        {online ? null : (
          <span className="lw-small lw-off" role="status">
            {t(LW.offline)}
          </span>
        )}
        <span className="ln-grow" />
        {signedIn ? (
          <button type="button" className="ln-btn ln-btn-sm ln-btn-pri" disabled={!online || submit.isPending || value.trim() === ""} onClick={() => submit.mutate()}>
            <Send aria-hidden="true" />
            {submit.isPending ? t(LW.judging) : t(LW.submit)}
          </button>
        ) : (
          <ScreenLink to={`signin?next=${encodeURIComponent(`problems/${problem.slug}`)}`} className="ln-btn ln-btn-sm ln-btn-pri">
            {t(LW.signInToRun)}
          </ScreenLink>
        )}
      </div>
    </>
  );
}

/* ---------------- Sahayak's pane (its panel comes with K2-6) ---------------- */

function SahayakPane({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) {
  const { t } = useLearn();
  const closer = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) closer.current?.focus({ preventScroll: true });
  }, [open]);
  return (
    <>
      <div className="kit-pane-h lw-ai-h">
        <Sparkles aria-hidden="true" />
        <h2 className="ln-h3 ln-grow">{t(T.sahayak)}</h2>
        <button ref={closer} type="button" className="ln-icon-btn ln-sm" onClick={onClose} aria-label={t(T.close)} title={t(T.close)}>
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="lw-body">
        <Empty icon={<Sparkles />} title={t(T.sahayakSoon)} body={t(T.step2)} headingLevel={3} />
      </div>
    </>
  );
}

