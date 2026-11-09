import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Empty } from "@parikshaa/brand/kit";
import { Markdown } from "@parikshaa/brand/markdown";
import { ApiError } from "../api.ts";
import type { LessonTutorHistory, Problem, TutorAnswer, TutorCosts, TutorHistory } from "../practice/client.ts";
import { ScreenLink, useLearn, type SahayakAbout } from "./context.tsx";
import { Failed, Loading, Offline, SignedOut, useCredits, useLearnData, useLearnQuery, useLessonTutor, useOnline, usePlus, useSubmissions, useTutor } from "./data.tsx";
import { BookOpen, CodeXml, Lightbulb, Lock, MessagesSquare, ScanSearch, Sparkles } from "./icons.tsx";
import type { Tri } from "./screens.ts";
import { A, fill } from "./text.ts";
import "./learn-sahayak.css";

/**
 * Sahayak's panel (tracker row 140, K2-6; the mock's `SahayakPanel`,
 * docs/learn/mock-v3/app/src/ui/sahayak.tsx), in the shell's pane (a sheet
 * on a phone) and in the workspace's third pane, on the tutor the practice
 * site's API already has:
 *
 * - about a problem: what Sahayak said (`GET …/problems/<p>/tutor`), the next
 *   hint with its cost, a review of the learner's last submission (the
 *   server reads it; which hidden test failed is never said), a doubt, and
 *   once it is solved an interviewer's two follow-up questions (each answered
 *   here) and a draft of the learner's note;
 * - about a lesson: what Sahayak said (`GET …/lessons/<l>/tutor`), a doubt
 *   and a note draft; a lesson behind Plus is not read to Sahayak without it;
 * - the learner's credits (`GET /credits`), each ask's cost on its button,
 *   and the refusals the API makes: credits short, Plus, a contest running,
 *   too many questions in one sitting, Sahayak off on the site or out of reach.
 *
 * The API answers in one piece (no streaming), in English or Hindi. Every
 * answer is drawn by the brand's Markdown renderer as elements (never HTML;
 * code as text; links only http(s)). A draft note is the learner's to add to
 * their note: Sahayak saves nothing itself. Not here (no backend yet, Kadam
 * 3/5): a chat about nothing in particular, Build mode's diffs, answers that
 * arrive as they are written, thumbs up/down, a Hinglish answer.
 */

export const LS = {
  credits: ["{n} credits left", "{n} credits baaki", "{n} क्रेडिट बाक़ी"],
  getCredits: ["Get credits", "Credits lo", "क्रेडिट लें"],
  aboutProblem: ["Problem · {title}", "Problem · {title}", "प्रश्न · {title}"],
  aboutLesson: ["Lesson · {title}", "Lesson · {title}", "पाठ · {title}"],
  talk: ["Conversation with Sahayak", "Sahayak se baatcheet", "सहायक से बातचीत"],
  learnMode: [
    "Hints and questions, not the full solution. The last hint, the worked solution, opens after 3 wrong submissions.",
    "Hint aur sawaal, poora hal nahi. Aakhri hint (poora hal) 3 galat submit ke baad khulta hai.",
    "संकेत और सवाल, पूरा हल नहीं। आख़िरी संकेत (पूरा हल) 3 ग़लत सबमिशन के बाद खुलता है।",
  ],
  lessonMode: [
    "Ask anything about this lesson: Sahayak reads it with your question.",
    "Is lesson par kuch bhi poochho: Sahayak aapke sawaal ke saath lesson padhta hai.",
    "इस पाठ पर कुछ भी पूछें: सहायक आपके सवाल के साथ पाठ पढ़ता है।",
  ],
  inEnglish: ["Answers come in English.", "Jawab English me aata hai (Hinglish abhi nahi).", "जवाब अंग्रेज़ी में आता है।"],
  wrong: ["Sahayak can be wrong. Run your code to check.", "Sahayak galat ho sakta hai. Code chala kar jaancho.", "सहायक ग़लत हो सकता है। कोड चलाकर जाँचें।"],
  lessonWrong: ["Sahayak can be wrong. Check it against the lesson.", "Sahayak galat ho sakta hai. Lesson se mila kar dekho.", "सहायक ग़लत हो सकता है। पाठ से मिलाकर देखें।"],
  ask: ["Ask Sahayak", "Sahayak se poochho", "सहायक से पूछें"],
  askProblem: ["Ask about this problem…", "Is problem ke baare me poochho…", "इस प्रश्न के बारे में पूछें…"],
  askLesson: ["Ask about this lesson…", "Is lesson ke baare me poochho…", "इस पाठ के बारे में पूछें…"],
  send: ["Ask · {n} credits", "Poochho · {n} credits", "पूछें · {n} क्रेडिट"],
  thinking: ["Sahayak is thinking…", "Sahayak soch raha hai…", "सहायक सोच रहा है…"],
  you: ["You", "Aap", "आप"],
  empty: [
    "Nothing asked here yet. Every ask shows its cost before you spend.",
    "Yahan abhi kuch nahi poochha. Har sawaal ki keemat pehle dikhti hai.",
    "यहाँ अभी कुछ नहीं पूछा। हर सवाल की क़ीमत पहले दिखती है।",
  ],
  hintN: ["Hint {n}", "Hint {n}", "संकेत {n}"],
  review: ["Review of your last submission", "Aakhri submission ka review", "आख़िरी सबमिशन की समीक्षा"],
  doubt: ["Answer", "Jawab", "जवाब"],
  notes: ["A draft of your note", "Aapke note ka draft", "आपके नोट का ड्राफ़्ट"],
  followup: ["An interviewer's next questions", "Interviewer ke agle sawaal", "इंटरव्यूअर के अगले सवाल"],
  followupReply: ["How an interviewer takes your answer", "Interviewer aapka jawab kaise lega", "इंटरव्यूअर आपका जवाब कैसे लेगा"],
  cost: ["{n} credits", "{n} credits", "{n} क्रेडिट"],
  free: ["free", "free", "मुफ़्त"],
  actions: ["Ask for", "Maango", "माँगें"],
  actHint: ["Hint {n} · {cost}", "Hint {n} · {cost}", "संकेत {n} · {cost}"],
  actSolution: ["Worked solution · {cost}", "Poora hal · {cost}", "पूरा हल · {cost}"],
  actReview: ["Review my last submission · {cost}", "Aakhri submission ka review · {cost}", "आख़िरी सबमिशन की समीक्षा · {cost}"],
  actFollowups: ["Interview follow-ups · {cost}", "Interview ke agle sawaal · {cost}", "इंटरव्यू के अगले सवाल · {cost}"],
  actNotes: ["Draft my note · {cost}", "Mera note draft karo · {cost}", "मेरा नोट ड्राफ़्ट करें · {cost}"],
  hintsDone: ["Every hint is open.", "Saare hint khul gaye.", "सारे संकेत खुल गए।"],
  solutionLater: [
    "The worked solution opens after {n} wrong submissions ({done} so far).",
    "Poora hal {n} galat submit ke baad khulta hai (abhi {done}).",
    "पूरा हल {n} ग़लत सबमिशन के बाद खुलता है (अभी {done})।",
  ],
  needSubmit: ["A review reads your last submission: submit once first.", "Review aakhri submission padhta hai: pehle ek baar submit karo.", "समीक्षा आख़िरी सबमिशन पढ़ती है: पहले एक बार सबमिट करें।"],
  needSolve: [
    "Once you solve it: an interviewer's follow-ups and a draft of your note.",
    "Solve karne ke baad: interviewer ke agle sawaal aur note ka draft.",
    "हल करने के बाद: इंटरव्यूअर के अगले सवाल और नोट का ड्राफ़्ट।",
  ],
  accepted: ["Accepted", "Accepted", "स्वीकृत"],
  whyTitle: ["Why did it fail?", "Fail kyun hua?", "फ़ेल क्यों हुआ?"],
  whyLast: ["Your last submission: {verdict} · {passed} of {total} tests", "Aapka aakhri submit: {verdict} · {total} me se {passed} test", "आपका आख़िरी सबमिशन: {verdict} · {total} में से {passed} टेस्ट"],
  whyBody: [
    "Sahayak reads your last submission and says what holds and what is missing. Which hidden test failed, it never says.",
    "Sahayak aapka aakhri submission padh kar batata hai kya theek hai aur kya chhoota. Kaunsa chhupa test fail hua, ye kabhi nahi batata.",
    "सहायक आपका आख़िरी सबमिशन पढ़कर बताता है कि क्या ठीक है और क्या छूटा। कौन-सा छिपा टेस्ट फ़ेल हुआ, यह कभी नहीं बताता।",
  ],
  whyNoCode: [
    "This question is not code, so there is no review of it: ask Sahayak below why your answer is not right.",
    "Ye sawaal code nahi, isliye iska review nahi hota: neeche Sahayak se poochho ki jawab kyun galat hai.",
    "यह सवाल कोड नहीं, इसलिए इसकी समीक्षा नहीं होती: नीचे सहायक से पूछें कि जवाब क्यों ग़लत है।",
  ],
  whyNone: ["Nothing submitted yet: ask a doubt or open a hint.", "Abhi kuch submit nahi hua: doubt poochho ya hint kholo.", "अभी कुछ सबमिट नहीं हुआ: सवाल पूछें या संकेत खोलें।"],
  replyTo: ["Your answer to question {n}", "Sawaal {n} ka aapka jawab", "सवाल {n} का आपका जवाब"],
  replySend: ["Send · {n} credits", "Bhejo · {n} credits", "भेजें · {n} क्रेडिट"],
  toNote: ["Add to my note", "Mere note me jodo", "मेरे नोट में जोड़ें"],
  toNoteDone: ["Added to your note.", "Aapke note me jod diya.", "आपके नोट में जोड़ दिया।"],
  forget: ["Delete this conversation", "Ye baatcheet mitao", "यह बातचीत मिटाएँ"],
  forgetSure: ["Delete it for good", "Haan, hamesha ke liye mitao", "हाँ, हमेशा के लिए मिटाएँ"],
  keep: ["Keep it", "Rehne do", "रहने दें"],
  kept: ["Sahayak's answers are deleted on their own after 180 days.", "Sahayak ke jawab 180 din baad apne aap mit jaate hain.", "सहायक के जवाब 180 दिन बाद अपने आप मिट जाते हैं।"],
  signIn: ["Sign in to ask Sahayak", "Sahayak se poochhne ke liye sign in karo", "सहायक से पूछने के लिए साइन इन करें"],
  offTitle: ["Sahayak is off on this site", "Is site par Sahayak band hai", "इस साइट पर सहायक बंद है"],
  offBody: ["The site's staff have turned it off.", "Site ke staff ne ise band kiya hai.", "साइट के स्टाफ़ ने इसे बंद किया है।"],
  contestTitle: ["Sahayak is off during the contest", "Contest chalte waqt Sahayak band hai", "प्रतियोगिता के दौरान सहायक बंद है"],
  contestBody: ["So every score is your own. It opens again when the contest ends.", "Taaki har score aapka apna ho. Contest khatam hote hi wapas khulega.", "ताकि हर स्कोर आपका अपना हो। प्रतियोगिता ख़त्म होते ही फिर खुलेगा।"],
  plusTitle: ["This lesson comes with Plus", "Ye lesson Plus ke saath hai", "यह पाठ Plus के साथ है"],
  plusBody: ["Sahayak reads it for learners with Plus.", "Sahayak ise Plus wale learners ke liye padhta hai.", "सहायक इसे Plus वाले शिक्षार्थियों के लिए पढ़ता है।"],
  plusSee: ["See Plus on the current site", "Plus abhi wali site par dekho", "Plus मौजूदा साइट पर देखें"],
  notFound: ["Not on this site", "Is site par nahi", "इस साइट पर नहीं"],
  notFoundBody: ["Sahayak has nothing to read here: this problem or lesson is not on the site.", "Sahayak ke paas padhne ko kuch nahi: ye problem ya lesson is site par nahi.", "सहायक के पास पढ़ने को कुछ नहीं: यह प्रश्न या पाठ इस साइट पर नहीं।"],
  generalTitle: ["Sahayak answers on a problem or a lesson", "Sahayak kisi problem ya lesson par jawab deta hai", "सहायक किसी प्रश्न या पाठ पर जवाब देता है"],
  generalBody: [
    "Open one and ask here: Sahayak reads it with your question. Hints, a review of your code and doubts each show their cost first.",
    "Koi kholo aur yahan poochho: Sahayak use aapke sawaal ke saath padhta hai. Hint, code ka review aur doubt, har ek ki keemat pehle dikhti hai.",
    "कोई खोलें और यहाँ पूछें: सहायक उसे आपके सवाल के साथ पढ़ता है। संकेत, कोड की समीक्षा और सवाल, हर एक की क़ीमत पहले दिखती है।",
  ],
  toPractice: ["Open Practice", "Abhyas kholo", "अभ्यास खोलें"],
  broke: [
    "{n} credits left: not enough to ask. {m} free credits come each month.",
    "{n} credits baaki: poochhne ke liye kam. Har mahine {m} free credits milte hain.",
    "{n} क्रेडिट बाक़ी: पूछने के लिए कम। हर महीने {m} मुफ़्त क्रेडिट मिलते हैं।",
  ],
  noCredits: [
    "Not enough credits for that. This month's free credits come back next month, or get more.",
    "Iske liye credits kam hain. Free credits agle mahine phir milenge, ya aur lo.",
    "इसके लिए क्रेडिट कम हैं। मुफ़्त क्रेडिट अगले महीने फिर मिलेंगे, या और लें।",
  ],
  tooMany: ["That is a lot of questions for one sitting. Try again in a little while.", "Ek baithak me bahut sawaal ho gaye. Thodi der baad phir poochho.", "एक बैठक में बहुत सवाल हो गए। थोड़ी देर बाद फिर पूछें।"],
  unavailable: [
    "Sahayak could not answer just now. Your credits are back; try again in a minute.",
    "Sahayak abhi jawab nahi de paaya. Credits wapas aa gaye; ek minute baad phir koshish karo.",
    "सहायक अभी जवाब नहीं दे पाया। क्रेडिट वापस आ गए; एक मिनट बाद फिर कोशिश करें।",
  ],
  refused: ["Sahayak could not take that: {why}", "Sahayak ye nahi le saka: {why}", "सहायक यह नहीं ले सका: {why}"],
  retry: ["Try again", "Phir koshish karo", "फिर कोशिश करें"],
} as const satisfies Record<string, Tri>;

const VERDICT: Readonly<Record<string, Tri>> = {
  wrong_answer: A.stWrong,
  time_limit: A.stTime,
  memory_limit: A.stMemory,
  runtime_error: A.stRuntime,
  compile_error: A.stCompile,
};

/** The learner's code as it stands, for a hint that can read it (the workspace's editor). */
export type CodeOf = () => { readonly language: string; readonly source: string } | undefined;

type Ask =
  | { readonly kind: "doubt"; readonly question: string }
  | { readonly kind: "hint" }
  | { readonly kind: "review" }
  | { readonly kind: "followups" }
  | { readonly kind: "reply"; readonly id: string; readonly index: number; readonly answer: string }
  | { readonly kind: "notes" };

type Entry = TutorAnswer & { readonly question: string };

const buyHref = (site: string) => `/practice/${encodeURIComponent(site)}/plus?learn_v2=0`;

/** What a refusal of the API means here; null for anything to show as a plain failure. */
function trouble(error: unknown): { readonly tri: Tri; readonly why?: string; readonly buy?: boolean; readonly plus?: boolean; readonly retry?: boolean } | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === "no_credits") return { tri: LS.noCredits, buy: true };
  if (error.code === "plus_required") return { tri: LS.plusTitle, plus: true };
  if (error.code === "tutor_closed") return { tri: LS.contestTitle };
  if (error.code === "too_many_runs" || error.status === 429) return { tri: LS.tooMany };
  if (error.code === "unavailable" || error.status === 503) return { tri: LS.unavailable, retry: true };
  const message = error.detail["message"];
  if (typeof message === "string" && message !== "" && [400, 404, 409, 422].includes(error.status)) return { tri: LS.refused, why: message };
  return null;
}

/** Sahayak, about what it was opened on (`about`), or about nothing in particular. */
export function SahayakPanel({ about, code }: { readonly about: SahayakAbout | null; readonly code?: CodeOf }) {
  const { t } = useLearn();
  const { signedIn } = useLearnData();
  const plus = usePlus();
  if (!signedIn) {
    return (
      <div className="ls ls-state">
        <SignedOut title={t(LS.signIn)} headingLevel={3} />
      </div>
    );
  }
  if (plus.data?.tutor === false) return <Locked title={t(LS.offTitle)} body={t(LS.offBody)} />;
  if (about === null) return <General />;
  return <Talk key={`${about.kind}:${about.slug}`} about={about} {...(code === undefined ? {} : { code })} />;
}

function Locked({ title, body, action }: { readonly title: string; readonly body: string; readonly action?: ReactNode }) {
  return (
    <div className="ls ls-state">
      <div className="ls-locked">
        <span className="ls-mark" aria-hidden="true">
          <Lock />
        </span>
        <h3 className="ln-h3">{title}</h3>
        <p className="ln-faint">{body}</p>
        {action}
      </div>
    </div>
  );
}

/** The credits line: the balance (the month's free credits arrive when it is first read) and where to get more. */
function Bar({ label, icon }: { readonly label: string | null; readonly icon?: ReactNode }) {
  const { t, site } = useLearn();
  const credits = useCredits();
  return (
    <div className="ls-bar">
      {label === null ? null : (
        <span className="ls-ctx" title={label}>
          {icon}
          <span className="ls-ellipsis">{label}</span>
        </span>
      )}
      <span className="ls-credits">{credits.data === undefined ? null : fill(t(LS.credits), { n: credits.data.balance })}</span>
      <a className="ls-buy" href={buyHref(site)}>
        {t(LS.getCredits)}
      </a>
    </div>
  );
}

function General() {
  const { t } = useLearn();
  return (
    <div className="ls">
      <Bar label={null} />
      <div className="ls-state">
        <Empty
          icon={<Sparkles />}
          title={t(LS.generalTitle)}
          body={t(LS.generalBody)}
          headingLevel={3}
          action={
            <ScreenLink to="practice" className="ln-btn ln-btn-pri">
              {t(LS.toPractice)}
            </ScreenLink>
          }
        />
      </div>
    </div>
  );
}

function Talk({ about, code }: { readonly about: SahayakAbout; readonly code?: CodeOf }) {
  const { t, lang, site, notify } = useLearn();
  const { client } = useLearnData();
  const online = useOnline();
  const queryClient = useQueryClient();
  const id = useId();
  const isProblem = about.kind === "problem";
  const reply = lang === "hi" ? "hi" : "en";
  // The problem itself (shared with the workspace): a contest running on it, and whether it is solved.
  const problem: UseQueryResult<Problem> = useLearnQuery(["problem", about.slug], (c) => c.problem(about.slug), { session: false, enabled: isProblem });
  const closed = isProblem && (problem.data?.contest ?? null) !== null;
  const tutor = useTutor(about.slug, isProblem && !closed);
  const lessonTutor = useLessonTutor(about.slug, !isProblem);
  const history: UseQueryResult<TutorHistory | LessonTutorHistory> = isProblem ? tutor : lessonTutor;
  const submissions = useSubmissions(isProblem ? about.slug : null);
  const credits = useCredits();
  const plus = usePlus();
  const [question, setQuestion] = useState("");
  const [sure, setSure] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  const settle = () => queryClient.invalidateQueries({ queryKey: ["practice", site, "prep"] });
  const ask = useMutation({
    mutationFn: (a: Ask): Promise<TutorAnswer> => {
      const subject = isProblem ? { problem: about.slug } : { lesson: about.slug };
      switch (a.kind) {
        case "doubt":
          return client.doubt(subject, a.question, reply);
        case "hint":
          return client.hint(about.slug, reply, code?.());
        case "review":
          return client.review(about.slug, reply);
        case "followups":
          return client.followups(about.slug, reply);
        case "reply":
          return client.replyToFollowup(about.slug, a.id, a.index, a.answer, reply);
        case "notes":
          return client.notesDraft(subject, reply);
      }
    },
    // The answer is in the history before "thinking" goes; credits are read again either way (a failure gives them back).
    onSuccess: async (_answer, a) => {
      if (a.kind === "doubt") setQuestion("");
      await settle();
    },
    onError: () => void settle(),
  });
  const forget = useMutation({ mutationFn: () => client.forgetTutor(about.slug), onSuccess: () => settle().then(() => setSure(false)) });
  const toNote = useMutation({
    mutationFn: async (draft: string) => {
      let mine = "";
      try {
        mine = (await client.note(about.kind, about.slug)).body;
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
      return client.saveNote(about.kind, about.slug, mine.trim() === "" ? draft : `${mine.trimEnd()}\n\n${draft}`);
    },
    onSuccess: async () => {
      notify({ tone: "ok", text: t(LS.toNoteDone) });
      await queryClient.invalidateQueries({ queryKey: ["practice", site, "note"] });
      await queryClient.invalidateQueries({ queryKey: ["practice", site, "notes"] });
    },
  });

  const entries: readonly Entry[] = history.data?.entries ?? [];
  // A new answer, or Sahayak starting on one, scrolls the conversation to its end.
  useEffect(() => {
    const el = body.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [entries.length, ask.isPending]);

  const label = fill(t(isProblem ? LS.aboutProblem : LS.aboutLesson), { title: about.title });
  const bar = <Bar label={label} icon={isProblem ? <CodeXml aria-hidden="true" /> : <BookOpen aria-hidden="true" />} />;

  // Refusals that close the whole panel: a contest on the problem, a lesson behind Plus, nothing to read.
  const refusedAll = history.error instanceof ApiError ? history.error : null;
  if (closed || refusedAll?.code === "tutor_closed") return <Locked title={t(LS.contestTitle)} body={t(LS.contestBody)} />;
  if (refusedAll?.code === "plus_required") {
    return (
      <Locked
        title={t(LS.plusTitle)}
        body={t(LS.plusBody)}
        action={
          <a className="ln-btn ln-btn-pri" href={buyHref(site)}>
            {t(LS.plusSee)}
          </a>
        }
      />
    );
  }
  if (refusedAll?.status === 404) return <Locked title={t(LS.notFound)} body={t(LS.notFoundBody)} />;
  if (history.data === undefined) {
    return (
      <div className="ls">
        {bar}
        <div className="ls-state">{history.isError ? <Failed error={history.error} onRetry={() => void history.refetch()} retrying={history.isFetching} headingLevel={3} /> : <Loading shape="list" />}</div>
      </div>
    );
  }

  const costs: TutorCosts = history.data.costs;
  const balance = credits.data?.balance ?? null;
  const afford = (n: number) => balance === null || balance >= n;
  const busy = ask.isPending;
  const can = (n: number) => online && !busy && afford(n);
  const costWord = (n: number) => (n === 0 ? t(LS.free) : fill(t(LS.cost), { n }));
  const next = isProblem ? (tutor.data?.nextHint ?? null) : null;
  const failures = isProblem ? (tutor.data?.failures ?? 0) : 0;
  const solved = problem.data?.status === "solved";
  // A review reads the last submission's code: none for a choice or number question.
  const codeQuestion = problem.data?.question.kind === "code";
  const submitted = (submissions.data ?? []).some((s) => s.language !== null);
  const last = submissions.data?.[0];
  const cheapest = Math.min(costs.doubt, ...(next !== null && next.available ? [next.credits] : []));
  const broke = balance !== null && balance < cheapest;
  const failure = ask.isError ? trouble(ask.error) : null;
  const send = (event?: FormEvent) => {
    event?.preventDefault();
    const q = question.trim();
    if (q.length >= 3 && can(costs.doubt)) ask.mutate({ kind: "doubt", question: q });
  };
  const sendOnKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) send(event);
  };

  return (
    <div className="ls">
      {bar}
      <div className="ls-body" ref={body} role="log" aria-label={t(LS.talk)} tabIndex={0}>
        <p className="ls-note">
          {t(isProblem ? LS.learnMode : LS.lessonMode)}
          {lang === "hg" ? ` ${t(LS.inEnglish)}` : null}
        </p>

        {isProblem && about.kind === "problem" && about.why === true ? (
          <section className="ls-why" aria-labelledby={`${id}-why`}>
            <h3 className="ls-why-h" id={`${id}-why`}>
              <ScanSearch aria-hidden="true" />
              {t(LS.whyTitle)}
            </h3>
            {submissions.data === undefined ? null : last === undefined ? (
              <p>{t(LS.whyNone)}</p>
            ) : (
              <>
                <p className="ls-why-last">{fill(t(LS.whyLast), { verdict: t(last.status === "passed" ? LS.accepted : (VERDICT[last.status] ?? A.stOther)), passed: last.passed, total: last.total })}</p>
                {last.language === null ? (
                  <p className="ln-faint ls-small">{t(LS.whyNoCode)}</p>
                ) : (
                  <>
                    <p className="ln-faint ls-small">{t(LS.whyBody)}</p>
                    <button type="button" className="ln-btn ln-btn-sm ln-btn-ai" disabled={!can(costs.review)} onClick={() => ask.mutate({ kind: "review" })}>
                      <ScanSearch aria-hidden="true" />
                      {fill(t(LS.actReview), { cost: costWord(costs.review) })}
                    </button>
                  </>
                )}
              </>
            )}
          </section>
        ) : null}

        {entries.length === 0 && !busy ? <p className="ln-faint ls-small">{t(LS.empty)}</p> : null}
        <ol className="ls-talk">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Said entry={entry} busy={busy} can={can} costs={costs} onReply={(a) => ask.mutate(a)} onNote={(draft) => toNote.mutate(draft)} noting={toNote.isPending || !online} />
            </li>
          ))}
          {busy ? (
            <li>
              {ask.variables?.kind === "doubt" || ask.variables?.kind === "reply" ? (
                <p className="ls-me">
                  <span className="ln-sr">{t(LS.you)}: </span>
                  {ask.variables.kind === "doubt" ? ask.variables.question : ask.variables.answer}
                </p>
              ) : null}
              <p className="ls-thinking" role="status">
                <Sparkles aria-hidden="true" />
                {t(LS.thinking)}
              </p>
            </li>
          ) : null}
        </ol>

        {!ask.isError ? null : failure === null ? (
          <Failed error={ask.error} onRetry={() => ask.variables !== undefined && ask.mutate(ask.variables)} headingLevel={3} />
        ) : (
          <p className="ln-notice ln-notice-error ls-trouble" role="alert">
            <span className="ln-grow">{fill(t(failure.tri), { why: failure.why ?? "" })}</span>
            {failure.buy === true ? (
              <a className="ln-btn ln-btn-sm" href={buyHref(site)}>
                {t(LS.getCredits)}
              </a>
            ) : null}
            {failure.plus === true ? (
              <a className="ln-btn ln-btn-sm" href={buyHref(site)}>
                {t(LS.plusSee)}
              </a>
            ) : null}
            {failure.retry === true && ask.variables !== undefined ? (
              <button type="button" className="ln-btn ln-btn-sm" disabled={!online} onClick={() => ask.variables !== undefined && ask.mutate(ask.variables)}>
                {t(LS.retry)}
              </button>
            ) : null}
          </p>
        )}
      </div>

      {online ? null : <Offline />}
      {broke ? (
        <p className="ln-notice ls-broke">
          <span className="ln-grow">{fill(t(LS.broke), { n: balance ?? 0, m: plus.data?.monthlyCredits ?? 0 })}</span>
          <a className="ln-btn ln-btn-sm" href={buyHref(site)}>
            {t(LS.getCredits)}
          </a>
        </p>
      ) : null}

      <div className="ls-acts" role="group" aria-label={t(LS.actions)}>
        {isProblem ? (
          next === null ? (
            <span className="ln-faint ls-small">{t(LS.hintsDone)}</span>
          ) : next.available ? (
            <button type="button" className="ls-chip" disabled={!can(next.credits)} onClick={() => ask.mutate({ kind: "hint" })}>
              <Lightbulb aria-hidden="true" />
              {fill(t(next.level === 4 ? LS.actSolution : LS.actHint), { n: next.level, cost: costWord(next.credits) })}
            </button>
          ) : (
            <span className="ln-faint ls-small">
              <Lock aria-hidden="true" /> {fill(t(LS.solutionLater), { n: 3, done: failures })}
            </span>
          )
        ) : null}
        {isProblem && submitted && about.why !== true ? (
          <button type="button" className="ls-chip" disabled={!can(costs.review)} onClick={() => ask.mutate({ kind: "review" })}>
            <ScanSearch aria-hidden="true" />
            {fill(t(LS.actReview), { cost: costWord(costs.review) })}
          </button>
        ) : null}
        {isProblem && solved && costs.followup !== undefined ? (
          <button type="button" className="ls-chip" disabled={!can(costs.followup)} onClick={() => ask.mutate({ kind: "followups" })}>
            <MessagesSquare aria-hidden="true" />
            {fill(t(LS.actFollowups), { cost: costWord(costs.followup) })}
          </button>
        ) : null}
        {(!isProblem || solved) && costs.notes !== undefined ? (
          <button type="button" className="ls-chip" disabled={!can(costs.notes)} onClick={() => ask.mutate({ kind: "notes" })}>
            <BookOpen aria-hidden="true" />
            {fill(t(LS.actNotes), { cost: costWord(costs.notes) })}
          </button>
        ) : null}
        {isProblem && codeQuestion && !submitted && submissions.data !== undefined ? <span className="ln-faint ls-small">{t(LS.needSubmit)}</span> : null}
        {isProblem && !solved && problem.data !== undefined ? <span className="ln-faint ls-small">{t(LS.needSolve)}</span> : null}
      </div>

      <form className="ls-compose" onSubmit={send}>
        <label className="ln-sr" htmlFor={`${id}-q`}>
          {t(LS.ask)}
        </label>
        <textarea
          id={`${id}-q`}
          rows={2}
          maxLength={2000}
          value={question}
          placeholder={t(isProblem ? LS.askProblem : LS.askLesson)}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={sendOnKey}
          aria-describedby={`${id}-wrong`}
          aria-keyshortcuts="Control+Enter"
        />
        <div className="ls-compose-foot">
          <span className="ln-faint ls-small ln-grow" id={`${id}-wrong`}>
            {t(isProblem ? LS.wrong : LS.lessonWrong)}
          </span>
          <button type="submit" className="ln-btn ln-btn-sm ln-btn-ai" disabled={question.trim().length < 3 || !can(costs.doubt)}>
            {fill(t(LS.send), { n: costs.doubt })}
          </button>
        </div>
      </form>

      <div className="ls-foot">
        <span className="ln-faint ls-small ln-grow">{t(LS.kept)}</span>
        {!isProblem || entries.length === 0 ? null : sure ? (
          <>
            <button type="button" className="ls-link ls-danger" disabled={forget.isPending || !online} onClick={() => forget.mutate()}>
              {t(LS.forgetSure)}
            </button>
            <button type="button" className="ls-link" onClick={() => setSure(false)}>
              {t(LS.keep)}
            </button>
          </>
        ) : (
          <button type="button" className="ls-link" onClick={() => setSure(true)}>
            {t(LS.forget)}
          </button>
        )}
      </div>
    </div>
  );
}

const ENTRY: Readonly<Record<Entry["mode"], { readonly tri: Tri; readonly icon: ReactNode }>> = {
  hint: { tri: LS.hintN, icon: <Lightbulb aria-hidden="true" /> },
  review: { tri: LS.review, icon: <ScanSearch aria-hidden="true" /> },
  doubt: { tri: LS.doubt, icon: <Sparkles aria-hidden="true" /> },
  notes: { tri: LS.notes, icon: <BookOpen aria-hidden="true" /> },
  followup: { tri: LS.followup, icon: <MessagesSquare aria-hidden="true" /> },
  followup_reply: { tri: LS.followupReply, icon: <MessagesSquare aria-hidden="true" /> },
};

/** One thing Sahayak said: the learner's question first, when there was one. */
function Said({
  entry,
  busy,
  can,
  costs,
  onReply,
  onNote,
  noting,
}: {
  readonly entry: Entry;
  readonly busy: boolean;
  readonly can: (n: number) => boolean;
  readonly costs: TutorCosts;
  readonly onReply: (ask: Ask) => void;
  readonly onNote: (draft: string) => void;
  readonly noting: boolean;
}) {
  const { t } = useLearn();
  const kind = ENTRY[entry.mode] ?? ENTRY.doubt;
  const questions = entry.mode === "followup" && Array.isArray(entry.data?.["questions"]) ? (entry.data["questions"] as unknown[]).filter((q): q is string => typeof q === "string") : null;
  return (
    <>
      {entry.question === "" ? null : (
        <p className="ls-me">
          <span className="ln-sr">{t(LS.you)}: </span>
          {entry.question}
        </p>
      )}
      <article className="ls-msg" aria-label={fill(t(kind.tri), { n: entry.hintLevel ?? 0 })}>
        <p className="ls-msg-h">
          {kind.icon}
          <b className="ln-grow">{fill(t(kind.tri), { n: entry.hintLevel ?? 0 })}</b>
          <span className="ln-faint">{entry.credits === 0 ? t(LS.free) : fill(t(LS.cost), { n: entry.credits })}</span>
        </p>
        {questions === null ? (
          <div className="ln-md">
            <Markdown source={entry.answer} />
          </div>
        ) : (
          <ol className="ls-qs">
            {questions.map((q, index) => (
              <li key={index}>
                <FollowUp entry={entry} question={q} index={index} disabled={busy || !can(costs.followupReply ?? 10)} cost={costs.followupReply ?? 10} onReply={onReply} />
              </li>
            ))}
          </ol>
        )}
        {entry.mode === "notes" ? (
          <button type="button" className="ln-btn ln-btn-sm" disabled={noting} onClick={() => onNote(entry.answer)}>
            <BookOpen aria-hidden="true" />
            {t(LS.toNote)}
          </button>
        ) : null}
      </article>
    </>
  );
}

/** One of an interviewer's follow-up questions, with a box for the learner's answer. */
function FollowUp({ entry, question, index, disabled, cost, onReply }: { readonly entry: Entry; readonly question: string; readonly index: number; readonly disabled: boolean; readonly cost: number; readonly onReply: (ask: Ask) => void }) {
  const { t } = useLearn();
  const id = useId();
  const [answer, setAnswer] = useState("");
  return (
    <form
      className="ls-q"
      onSubmit={(event) => {
        event.preventDefault();
        if (answer.trim().length >= 3) onReply({ kind: "reply", id: entry.id, index, answer: answer.trim() });
      }}
    >
      <div className="ln-md">
        <Markdown source={question} />
      </div>
      <label className="ln-sr" htmlFor={id}>
        {fill(t(LS.replyTo), { n: index + 1 })}
      </label>
      <textarea id={id} className="ln-input" rows={2} maxLength={4000} value={answer} onChange={(event) => setAnswer(event.target.value)} />
      <button type="submit" className="ln-btn ln-btn-sm" disabled={disabled || answer.trim().length < 3}>
        {fill(t(LS.replySend), { n: cost })}
      </button>
    </form>
  );
}
