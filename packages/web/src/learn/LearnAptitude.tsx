import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookText, Brain, Sigma } from "lucide-react";
import { Empty, Meter } from "@parikshaa/brand/kit";
import { Markdown } from "@parikshaa/brand/markdown";
import { ApiError } from "../api.ts";
import type { Problem, ProblemSummary, Standing, Submission } from "../practice/client.ts";
import { answerText, ChoiceField, statementBody } from "./choice.tsx";
import { ScreenLink, useLearn } from "./context.tsx";
import { Failed, Loading, Offline, SignedOut, useLearnData, useOnline, useProblem, useProblems, useSubmissions, waitingForNetwork } from "./data.tsx";
import { ArrowRight, BookOpen, icon, ListChecks, Lock, Sparkles, Target, type LearnIcon } from "./icons.tsx";
import { screenById, type Tri } from "./screens.ts";
import { A, fill } from "./text.ts";
import "./learn-aptitude.css";

/**
 * Aptitude (tracker row 140, K2-8; the mock's `AptitudeBody` and `AptSetBody`,
 * docs/learn/mock-v3/app/src/screens/aptitude.tsx) on the site's own choice
 * and number problems, through what the practice API already does:
 *
 * - `GET /problems`: every problem with its kind, tags and the learner's
 *   standing. A choice (`mcq`) or number (`numeric`) problem is aptitude
 *   here: its first tag is its section, its second its topic (the content
 *   kit and the starter packs tag them so; CS fundamentals as subject, topic).
 * - The hub (`aptitude`): each section a card, each topic a row with how many
 *   the learner got right; how many right and wrong in all; the misses.
 * - A topic's set (`aptitude/<topic>`) and the misses (`aptitude/misses`,
 *   every one tried and not yet right): a palette (right, tried, now, in
 *   words too), one question at a time (`GET /problems/<problem>`: the stem
 *   and passage in the brand's Markdown, never HTML), Check (`POST …/submit`),
 *   then right or not on the option chosen, and the explanation.
 *
 * The explanation keeps the API's rules: it opens on a right answer or after
 * three wrong ones, and stays shut while a contest with the question runs. A
 * wrong answer never shows which option is right. Earlier answers come from
 * `GET …/submissions`; Sahayak answers on the question on show.
 *
 * Not here (no backend yet, Kadam 3/4): timed sets and mocks in an exam's
 * pattern, seconds per question against a target, analysis by topic, and
 * company patterns.
 */

export const AP = {
  eyebrow: ["Aptitude", "Aptitude", "एप्टीट्यूड"],
  title: ["Fast, and right the first time.", "Tez, aur pehli baar me sahi.", "तेज़, और पहली बार में सही।"],
  sub: [
    "Questions by section and topic. Check each answer; the explanation opens once you get it right, or after three tries.",
    "Section aur topic ke hisaab se sawaal. Har jawab check karo; samjhaav sahi karne par khulta hai, ya teen koshish ke baad.",
    "खंड और विषय के हिसाब से प्रश्न। हर उत्तर जाँचें; समझाव सही करने पर खुलता है, या तीन कोशिशों के बाद।",
  ],
  summary: ["{right} of {n} right · {wrong} still wrong", "{n} me se {right} sahi · {wrong} abhi galat", "{n} में से {right} सही · {wrong} अभी ग़लत"],
  misses: ["Retry your misses ({n})", "Galtiyan dobara karo ({n})", "ग़लतियाँ दोबारा करें ({n})"],
  sectionRight: ["{right} of {n} right", "{n} me se {right} sahi", "{n} में से {right} सही"],
  topicMeter: ["{topic}: {right} of {n} right", "{topic}: {n} me se {right} sahi", "{topic}: {n} में से {right} सही"],
  signedOut: [
    "You are not signed in, so the topics show without what you got right.",
    "Aap sign in nahi hain, isliye topics aapke sahi jawab ke bina dikh rahe hain.",
    "आप साइन इन नहीं हैं, इसलिए विषय आपके सही उत्तरों के बिना दिख रहे हैं।",
  ],
  signIn: ["Sign in", "Sign in karo", "साइन इन करें"],
  noneTitle: ["No aptitude questions here yet", "Yahan abhi aptitude ke sawaal nahi", "यहाँ अभी एप्टीट्यूड के प्रश्न नहीं"],
  noneBody: [
    "When the site's team adds choice or number questions (a starter pack, or a bulk upload), they show here by topic.",
    "Site ki team choice ya number wale sawaal jodegi (starter pack ya bulk upload se), to yahan topic ke hisaab se dikhenge.",
    "साइट की टीम विकल्प या संख्या वाले प्रश्न जोड़ेगी (स्टार्टर पैक या बल्क अपलोड से), तो यहाँ विषय के हिसाब से दिखेंगे।",
  ],
  toPractice: ["Open Abhyas", "Abhyas kholo", "अभ्यास खोलें"],
  other: ["Other questions", "Baaki sawaal", "बाक़ी प्रश्न"],
  // the set
  back: ["Aptitude", "Aptitude", "एप्टीट्यूड"],
  missesTitle: ["Your misses", "Aapki galtiyan", "आपकी ग़लतियाँ"],
  missesSub: ["Every question you tried and have not got right yet.", "Har sawaal jo aapne try kiya par abhi sahi nahi hua.", "हर प्रश्न जो आपने आज़माया पर अभी सही नहीं हुआ।"],
  missesNone: ["No misses left", "Koi galti baaki nahi", "कोई ग़लती बाक़ी नहीं"],
  missesNoneBody: ["Every question you tried, you have got right. Pick a topic for more.", "Jo bhi try kiya, sab sahi ho gaya. Aur ke liye koi topic chuno.", "जो भी आज़माया, सब सही हो गया। और के लिए कोई विषय चुनें।"],
  missingTitle: ["This topic is not here", "Ye topic yahan nahi hai", "यह विषय यहाँ नहीं है"],
  missingBody: ["It may have been renamed or taken down. Pick another from Aptitude.", "Shayad iska naam badla ya hata diya gaya. Aptitude se koi aur chuno.", "शायद इसका नाम बदला या हटा दिया गया। एप्टीट्यूड से कोई और चुनें।"],
  palette: ["Questions", "Sawaal", "प्रश्न"],
  qState: ["Question {n}: {state}", "Sawaal {n}: {state}", "प्रश्न {n}: {state}"],
  stRight: ["right", "sahi", "सही"],
  stTried: ["tried, not right yet", "try kiya, abhi sahi nahi", "आज़माया, अभी सही नहीं"],
  stOpen: ["not tried", "try nahi kiya", "नहीं आज़माया"],
  stNow: ["on show", "abhi yahi", "अभी यही"],
  legendRight: ["Right", "Sahi", "सही"],
  legendTried: ["Tried", "Try kiya", "आज़माया"],
  legendNow: ["Now", "Abhi", "अभी"],
  questionOf: ["Question {n} of {total}", "Sawaal {n} / {total}", "प्रश्न {n} / {total}"],
  answer: ["Your answer", "Aapka jawab", "आपका उत्तर"],
  check: ["Check", "Check karo", "जाँचें"],
  checking: ["Checking…", "Jaanch rahe hain…", "जाँच रहे हैं…"],
  signInToCheck: ["Sign in to check your answer", "Jawab check karne ke liye sign in karo", "उत्तर जाँचने के लिए साइन इन करें"],
  offline: ["Offline: you can read; Check waits for the network.", "Offline: padh sakte ho; Check net ka intezaar karega.", "ऑफ़लाइन: पढ़ सकते हैं; जाँच नेट का इंतज़ार करेगी।"],
  queued: ["No network: your answer is kept and goes when you are back online.", "Net nahi: jawab rakh liya, net aate hi jaayega.", "नेट नहीं: उत्तर रख लिया, नेट आते ही जाएगा।"],
  right: ["Right", "Sahi", "सही"],
  wrong: ["Not right", "Sahi nahi", "सही नहीं"],
  coins: ["+{n} coins", "+{n} coins", "+{n} सिक्के"],
  ask: ["Ask Sahayak", "Sahayak se poochho", "सहायक से पूछें"],
  askWhy: ["Why not? Ask Sahayak", "Kyun nahi? Sahayak se poochho", "क्यों नहीं? सहायक से पूछें"],
  explanation: ["Explanation", "Samjhaav", "समझाव"],
  locked: [
    "The explanation opens once you get it right, or after {n} wrong tries ({done}/{n}).",
    "Samjhaav sahi karne par khulta hai, ya {n} galat koshish ke baad ({done}/{n}).",
    "समझाव सही करने पर खुलता है, या {n} ग़लत कोशिशों के बाद ({done}/{n})।",
  ],
  lockedContest: ["The explanation is closed while the contest with this question runs.", "Is sawaal wala contest chal raha hai; tab tak samjhaav band.", "इस प्रश्न वाली प्रतियोगिता चल रही है; तब तक समझाव बंद।"],
  noExplanation: ["This question has no explanation yet.", "Is sawaal ka samjhaav abhi nahi.", "इस प्रश्न का समझाव अभी नहीं।"],
  earlier: ["Your earlier answers", "Aapke pichhle jawab", "आपके पिछले उत्तर"],
  prev: ["Previous", "Pichhla", "पिछला"],
  next: ["Next", "Aage", "आगे"],
  done: ["Back to Aptitude", "Aptitude par wapas", "एप्टीट्यूड पर वापस"],
  passage: ["Passage", "Passage", "गद्यांश"],
  copy: ["Copy", "Copy", "कॉपी"],
  copied: ["Copied", "Copy ho gaya", "कॉपी हो गया"],
} as const satisfies Record<string, Tri>;

/** The content kit's sections (docs/content/schema/mcq.schema.json), named; anything else shows its own tag. */
const SECTION_NAMES: Readonly<Record<string, Tri>> = {
  "aptitude-quant": ["Quantitative aptitude", "Quantitative aptitude", "मात्रात्मक योग्यता"],
  "aptitude-logical": ["Logical reasoning", "Logical reasoning", "तार्किक क्षमता"],
  "aptitude-verbal": ["Verbal ability", "Verbal ability", "मौखिक क्षमता"],
  "cs-cn": ["Computer networks", "Computer networks", "कंप्यूटर नेटवर्क"],
  "cs-os": ["Operating systems", "Operating systems", "ऑपरेटिंग सिस्टम"],
  "cs-dbms": ["DBMS", "DBMS", "DBMS"],
  "cs-oop": ["Object-oriented programming", "Object-oriented programming", "ऑब्जेक्ट-ओरिएंटेड प्रोग्रामिंग"],
  "cs-lld": ["Low-level design", "Low-level design", "लो-लेवल डिज़ाइन"],
  "sd-hld": ["High-level design", "High-level design", "हाई-लेवल डिज़ाइन"],
  "sql-concept": ["SQL", "SQL", "SQL"],
  "dsa-concept": ["DSA", "DSA", "DSA"],
};
/** Aptitude's own sections first, in this order; the rest as the site has them. */
const FIRST = ["aptitude-quant", "aptitude-logical", "aptitude-verbal"];
/** A section's icon and tone: the mock's (Sigma pen, Brain ai, BookText teal); any other section a list. */
const SECTION_LOOK: Readonly<Record<string, readonly [LearnIcon, string]>> = {
  "aptitude-quant": [Sigma, "pen"],
  "aptitude-logical": [Brain, "ai"],
  "aptitude-verbal": [BookText, "teal"],
};

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
const ArrowLeft = icon(
  "arrow-left",
  <>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </>,
);
const Send = icon(
  "send",
  <>
    <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
    <path d="m21.854 2.147-10.94 10.939" />
  </>,
);

/* ---------------- sections and topics from the problems ---------------- */

export interface AptTopic {
  /** Its address under `aptitude/`: section and topic, as a slug. */
  readonly slug: string;
  readonly name: string;
  readonly problems: readonly ProblemSummary[];
}

export interface AptSection {
  /** Its tag (`aptitude-quant`), or "" for questions without tags. */
  readonly id: string;
  readonly topics: readonly AptTopic[];
}

export const isChoiceProblem = (p: ProblemSummary): boolean => p.kind === "mcq" || p.kind === "numeric";

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/, "");

/** A tag as words: `time-and-work` → "Time and work"; a name already in words stays as it is. */
export function tagWords(tag: string): string {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(tag)) return tag;
  const words = tag.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The site's choice and number problems by section (the first tag) and topic (the second, else the first), in the site's order. */
export function aptitudeOf(all: readonly ProblemSummary[]): readonly AptSection[] {
  const sections = new Map<string, Map<string, { name: string; problems: ProblemSummary[] }>>();
  for (const p of all.filter(isChoiceProblem)) {
    const section = p.tags[0] ?? "";
    const topic = p.tags[1] ?? p.tags[0] ?? "";
    const topics = sections.get(section) ?? new Map<string, { name: string; problems: ProblemSummary[] }>();
    sections.set(section, topics);
    const slug = slugify(`${section} ${topic}`) || "questions";
    const entry = topics.get(slug) ?? { name: topic === "" ? "" : tagWords(topic), problems: [] };
    topics.set(slug, entry);
    entry.problems.push(p);
  }
  const rank = (id: string) => (FIRST.includes(id) ? FIRST.indexOf(id) : FIRST.length + (id === "" ? 1 : 0));
  return [...sections.entries()]
    .map(([id, topics]) => ({ id, topics: [...topics.entries()].map(([slug, t]) => ({ slug, name: t.name, problems: t.problems })) }))
    .sort((a, b) => rank(a.id) - rank(b.id));
}

const rightOf = (problems: readonly ProblemSummary[]) => problems.filter((p) => p.status === "solved").length;
const missesOf = (problems: readonly ProblemSummary[]) => problems.filter((p) => isChoiceProblem(p) && p.status === "attempted");

function useSectionName(): (id: string) => string {
  const { t } = useLearn();
  return (id) => (id === "" ? t(AP.other) : Object.hasOwn(SECTION_NAMES, id) ? t(SECTION_NAMES[id]!) : tagWords(id));
}

/* ---------------- the screen ---------------- */

function Frame({ children }: { readonly children: ReactNode }) {
  const { t } = useLearn();
  return (
    <div className="ln-stack">
      <h1 className="ln-page-h1">{t(screenById("aptitude")?.title ?? AP.eyebrow)}</h1>
      {children}
    </div>
  );
}

/** `topic` null: the hub; "misses": every question tried and not right yet; else a topic's set. */
export function Aptitude({ topic }: { readonly topic: string | null }) {
  const problems = useProblems();
  if (waitingForNetwork(problems)) {
    return (
      <Frame>
        <Offline waiting />
      </Frame>
    );
  }
  if (problems.isPending) {
    return (
      <Frame>
        <Loading shape="list" />
      </Frame>
    );
  }
  if (problems.isError) {
    return (
      <Frame>
        <Failed error={problems.error} onRetry={() => void problems.refetch()} retrying={problems.isFetching} />
      </Frame>
    );
  }
  if (topic === null) return <Hub all={problems.data} />;
  return <SetPage all={problems.data} topic={topic} />;
}

function Hub({ all }: { readonly all: readonly ProblemSummary[] }) {
  const { t } = useLearn();
  const { signedIn } = useLearnData();
  const online = useOnline();
  const id = useId();
  const sectionName = useSectionName();
  const sections = useMemo(() => aptitudeOf(all), [all]);
  const questions = all.filter(isChoiceProblem);
  const right = rightOf(questions);
  const misses = missesOf(questions);
  return (
    <div className="ln-stack la-page">
      {online ? null : <Offline />}
      <header className="la-head">
        <div className="la-head-text">
          <p className="ln-eyebrow">{t(AP.eyebrow)}</p>
          <h1 className="ln-page-h1">{t(AP.title)}</h1>
          <p className="la-sub">{t(AP.sub)}</p>
          {signedIn && questions.length > 0 ? <p className="la-summary">{fill(t(AP.summary), { right, n: questions.length, wrong: misses.length })}</p> : null}
        </div>
        {signedIn && misses.length > 0 ? (
          <div className="la-acts">
            <ScreenLink to="aptitude/misses" className="ln-btn ln-btn-pri">
              <Target aria-hidden="true" />
              {fill(t(AP.misses), { n: misses.length })}
            </ScreenLink>
          </div>
        ) : null}
      </header>

      {signedIn ? null : (
        <p className="ln-notice ln-notice-info">
          <span className="ln-grow">{t(AP.signedOut)}</span>
          <ScreenLink to="signin?next=aptitude" className="ln-btn ln-btn-sm ln-btn-pri">
            {t(AP.signIn)}
          </ScreenLink>
        </p>
      )}

      {sections.length === 0 ? (
        <Empty
          title={t(AP.noneTitle)}
          body={t(AP.noneBody)}
          headingLevel={2}
          action={
            <ScreenLink to="practice" className="ln-btn ln-btn-pri">
              {t(AP.toPractice)}
            </ScreenLink>
          }
        />
      ) : (
        <div className="la-sections">
          {sections.map((section, i) => {
            const inSection = section.topics.flatMap((x) => x.problems);
            return (
              <section key={section.id} className="ln-card la-section" aria-labelledby={`${id}-s${i}`}>
                <div className="la-section-h">
                  <SectionIcon id={section.id} />
                  <h2 className="ln-h3 ln-grow" id={`${id}-s${i}`}>
                    {sectionName(section.id)}
                  </h2>
                  {signedIn ? <span className="la-num ln-faint">{fill(t(AP.sectionRight), { right: rightOf(inSection), n: inSection.length })}</span> : null}
                </div>
                <ul className="la-topics">
                  {section.topics.map((x) => {
                    const done = rightOf(x.problems);
                    const name = x.name === "" ? sectionName(section.id) : x.name;
                    return (
                      <li key={x.slug}>
                        <ScreenLink to={`aptitude/${x.slug}`} className="la-topic">
                          <span className="la-topic-name">{name}</span>
                          <Meter
                            label={fill(t(AP.topicMeter), { topic: name, right: done, n: x.problems.length })}
                            value={done}
                            max={Math.max(1, x.problems.length)}
                            size="thin"
                            tone={done === x.problems.length ? "tick" : "pen"}
                            className="la-topic-meter"
                          />
                          <span className="la-num ln-faint">
                            {done}/{x.problems.length}
                          </span>
                          <ArrowRight aria-hidden="true" className="la-topic-go" />
                        </ScreenLink>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionIcon({ id }: { readonly id: string }) {
  const [Icon, tone] = SECTION_LOOK[id] ?? [ListChecks, "ink"];
  return (
    <span className={`la-section-ic la-tone-${tone}`} aria-hidden="true">
      <Icon aria-hidden="true" />
    </span>
  );
}

/* ---------------- a set: a topic's questions, or the misses ---------------- */

function SetPage({ all, topic }: { readonly all: readonly ProblemSummary[]; readonly topic: string }) {
  const { t } = useLearn();
  const { signedIn } = useLearnData();
  const sectionName = useSectionName();
  const sections = useMemo(() => aptitudeOf(all), [all]);
  const misses = topic === "misses";
  // The misses are the ones tried and not yet right when the set opened: one got right stays in it, marked right.
  const [missed] = useState(() => new Set(missesOf(all).map((p) => p.slug)));
  const found = misses ? null : sections.flatMap((s) => s.topics.map((x) => ({ section: s.id, topic: x }))).find((x) => x.topic.slug === topic);
  const back = (
    <ScreenLink to="aptitude" className="ln-btn ln-btn-sm ln-btn-ghost la-back">
      <ArrowLeft aria-hidden="true" />
      {t(AP.back)}
    </ScreenLink>
  );
  if (misses && !signedIn) {
    return (
      <div className="ln-stack la-page">
        <div className="la-top">{back}</div>
        <h1 className="ln-page-h1">{t(AP.missesTitle)}</h1>
        <SignedOut />
      </div>
    );
  }
  const problems = misses ? all.filter((p) => missed.has(p.slug)) : (found?.topic.problems ?? []);
  if (problems.length === 0) {
    return (
      <div className="ln-stack la-page">
        <div className="la-top">{back}</div>
        <h1 className="ln-page-h1">{misses ? t(AP.missesTitle) : t(AP.missingTitle)}</h1>
        <Empty
          title={misses ? t(AP.missesNone) : t(AP.missingTitle)}
          body={misses ? t(AP.missesNoneBody) : t(AP.missingBody)}
          headingLevel={2}
          action={
            <ScreenLink to="aptitude" className="ln-btn ln-btn-pri">
              {t(AP.done)}
            </ScreenLink>
          }
        />
      </div>
    );
  }
  const name = misses ? t(AP.missesTitle) : found!.topic.name === "" ? sectionName(found!.section) : found!.topic.name;
  const sub = misses ? t(AP.missesSub) : sectionName(found!.section);
  return <QuestionSet key={topic} name={name} sub={sub} problems={problems} back={back} here={misses ? "aptitude/misses" : `aptitude/${topic}`} />;
}

function standingWord(status: Standing): Tri {
  return status === "solved" ? AP.stRight : status === "attempted" ? AP.stTried : AP.stOpen;
}

function QuestionSet({
  name,
  sub,
  problems,
  back,
  here,
}: {
  readonly name: string;
  readonly sub: string;
  readonly problems: readonly ProblemSummary[];
  readonly back: ReactNode;
  readonly here: string;
}) {
  const { t } = useLearn();
  const id = useId();
  // Opens on the first not yet right, else the first.
  const [at, setAt] = useState(() => Math.max(0, problems.findIndex((p) => p.status !== "solved")));
  const index = Math.min(at, problems.length - 1);
  const current = problems[index]!;
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const go = (to: number) => {
    moved.current = true;
    setAt(to);
  };
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    heading.current?.focus({ preventScroll: true });
  }, [index]);
  const right = rightOf(problems);
  return (
    <div className="ln-stack la-page la-set">
      <div className="la-top">
        {back}
        <span className="la-num ln-faint">{fill(t(AP.sectionRight), { right, n: problems.length })}</span>
      </div>
      <header className="la-set-head">
        <p className="ln-eyebrow">{sub}</p>
        <h1 className="ln-page-h1">{name}</h1>
      </header>
      <nav className="la-pal-wrap" aria-label={t(AP.palette)}>
        <ol className="la-pal">
          {problems.map((p, i) => {
            const state = i === index ? "now" : p.status === "solved" ? "ok" : p.status === "attempted" ? "bad" : "open";
            const words = `${t(standingWord(p.status))}${i === index ? `, ${t(AP.stNow)}` : ""}`;
            return (
              <li key={p.slug}>
                <button
                  type="button"
                  className={`la-qn la-qn-${state}${p.status === "solved" ? " la-qn-right" : p.status === "attempted" ? " la-qn-tried" : ""}`}
                  aria-label={fill(t(AP.qState), { n: i + 1, state: words })}
                  title={fill(t(AP.qState), { n: i + 1, state: words })}
                  {...(i === index ? { "aria-current": "step" as const } : {})}
                  onClick={() => go(i)}
                >
                  {i + 1}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="la-legend ln-faint" aria-hidden="true">
          <span>
            <i className="la-key la-qn-right" />
            {t(AP.legendRight)}
          </span>
          <span>
            <i className="la-key la-qn-tried" />
            {t(AP.legendTried)}
          </span>
          <span>
            <i className="la-key la-qn-now" />
            {t(AP.legendNow)}
          </span>
        </p>
      </nav>
      <section className="la-q" aria-labelledby={`${id}-q`}>
        <Question key={current.slug} summary={current} position={index + 1} total={problems.length} heading={heading} headingId={`${id}-q`} here={here} />
        <div className="la-q-nav">
          <button type="button" className="ln-btn" disabled={index === 0} onClick={() => go(index - 1)}>
            <ArrowLeft aria-hidden="true" />
            {t(AP.prev)}
          </button>
          <span className="ln-grow" />
          {index < problems.length - 1 ? (
            <button type="button" className="ln-btn ln-btn-pri" onClick={() => go(index + 1)}>
              {t(AP.next)}
              <ArrowRight aria-hidden="true" />
            </button>
          ) : (
            <ScreenLink to="aptitude" className="ln-btn ln-btn-pri">
              {t(AP.done)}
              <ArrowRight aria-hidden="true" />
            </ScreenLink>
          )}
        </div>
      </section>
    </div>
  );
}

/** What a failed check says: kept for later offline, or null for the shared error. */
function trouble(error: unknown): Tri | null {
  return error instanceof ApiError && error.code === "queued_offline" ? AP.queued : null;
}

function Question({
  summary,
  position,
  total,
  heading,
  headingId,
  here,
}: {
  readonly summary: ProblemSummary;
  readonly position: number;
  readonly total: number;
  readonly heading: RefObject<HTMLHeadingElement | null>;
  readonly headingId: string;
  readonly here: string;
}) {
  const { t, setHere } = useLearn();
  const problem = useProblem(summary.slug);
  // Sahayak, opened from the top bar, answers on the question on show.
  useEffect(() => {
    setHere({ kind: "problem", slug: summary.slug, title: summary.title });
    return () => setHere(null);
  }, [summary.slug, summary.title, setHere]);
  const head = (
    <div className="la-q-head">
      <span className="ln-eyebrow">{fill(t(AP.questionOf), { n: position, total })}</span>
      <span className={`ln-badge la-lvl la-lvl-${summary.difficulty}`}>{t(A[summary.difficulty])}</span>
    </div>
  );
  const title = (
    <h2 className="la-q-title" id={headingId} ref={heading} tabIndex={-1}>
      {summary.title}
    </h2>
  );
  if (waitingForNetwork(problem)) {
    return (
      <>
        {head}
        {title}
        <Offline waiting />
      </>
    );
  }
  if (problem.isPending) {
    return (
      <>
        {head}
        {title}
        <Loading shape="list" />
      </>
    );
  }
  if (problem.isError) {
    return (
      <>
        {head}
        {title}
        <Failed error={problem.error} onRetry={() => void problem.refetch()} retrying={problem.isFetching} headingLevel={3} />
      </>
    );
  }
  return (
    <>
      {head}
      {title}
      <Answering problem={problem.data} here={here} />
    </>
  );
}

function Answering({ problem, here }: { readonly problem: Problem; readonly here: string }) {
  const { t, site, openSahayak } = useLearn();
  const { signedIn, client } = useLearnData();
  const online = useOnline();
  const queryClient = useQueryClient();
  const id = useId();
  const copy = { label: t(AP.copy), done: t(AP.copied) };
  const q = problem.question;
  const [value, setValue] = useState("");
  const outcome = useRef<HTMLDivElement>(null);
  const submissions = useSubmissions(signedIn ? problem.slug : null);
  const check = useMutation({
    mutationFn: (answer: string) => client.submit(problem.slug, answer),
    onSuccess: async () => {
      outcome.current?.focus({ preventScroll: true });
      // The problem (its explanation may open now), the list (the palette) and the earlier answers.
      await queryClient.invalidateQueries({ queryKey: ["practice", site] });
    },
  });
  const verdict = check.data;
  const right = verdict?.status === "passed";
  const why = check.isError ? trouble(check.error) : null;
  const wrongs = (submissions.data ?? []).filter((s) => s.status !== "passed").length;
  return (
    <>
      {q.passage === null ? null : (
        <section className="la-passage" aria-labelledby={`${id}-passage`}>
          <h3 className="ln-eyebrow" id={`${id}-passage`}>
            {q.passage.title ?? t(AP.passage)}
          </h3>
          <div className="ln-md">
            <Markdown source={q.passage.text} copy={copy} />
          </div>
        </section>
      )}
      <div className="ln-md la-stem">
        <Markdown source={statementBody(q.stem, problem.title)} copy={copy} />
      </div>
      <ChoiceField question={q} value={value} onChange={setValue} label={t(AP.answer)} checked={verdict === undefined ? null : { answer: check.variables ?? "", right }} disabled={check.isPending} />
      <div className="la-check">
        {signedIn ? (
          <button type="button" className="ln-btn ln-btn-pri" disabled={!online || check.isPending || value.trim() === ""} onClick={() => check.mutate(value)}>
            <Send aria-hidden="true" />
            {check.isPending ? t(AP.checking) : t(AP.check)}
          </button>
        ) : (
          <ScreenLink to={`signin?next=${encodeURIComponent(here)}`} className="ln-btn ln-btn-pri">
            {t(AP.signInToCheck)}
          </ScreenLink>
        )}
        {online ? null : (
          <span className="ln-faint la-small" role="status">
            {t(AP.offline)}
          </span>
        )}
      </div>
      <div ref={outcome} tabIndex={-1} className="la-out">
        {verdict === undefined ? null : (
          <div className={`la-verdict ${right ? "la-ok" : "la-bad"}`}>
            <p className="la-v-title" role="status">
              {right ? <CircleCheck aria-hidden="true" /> : <CircleX aria-hidden="true" />}
              {right ? t(AP.right) : t(AP.wrong)}
              {verdict.reward === undefined || verdict.reward.coins <= 0 ? null : <span className="ln-badge la-coins">{fill(t(AP.coins), { n: verdict.reward.coins })}</span>}
            </p>
            <button type="button" className="ln-btn ln-btn-sm ln-btn-ai" onClick={() => openSahayak({ kind: "problem", slug: problem.slug, title: problem.title, ...(right ? {} : { why: true }) })}>
              <Sparkles aria-hidden="true" />
              {right ? t(AP.ask) : t(AP.askWhy)}
            </button>
          </div>
        )}
        {!check.isError ? null : why === null ? (
          <Failed error={check.error} onRetry={() => check.mutate(value)} headingLevel={3} />
        ) : (
          <p className="ln-notice ln-notice-info" role="status">
            {t(why)}
          </p>
        )}
      </div>
      <Explanation problem={problem} wrongs={wrongs} />
      {signedIn ? <Earlier problem={problem} submissions={submissions.data ?? []} /> : null}
    </>
  );
}

function Explanation({ problem, wrongs }: { readonly problem: Problem; readonly wrongs: number }) {
  const { t } = useLearn();
  const id = useId();
  const copy = { label: t(AP.copy), done: t(AP.copied) };
  if (problem.editorial !== null) {
    return (
      <section className="la-sol" aria-labelledby={`${id}-sol`}>
        <h3 className="la-sol-h" id={`${id}-sol`}>
          <BookOpen aria-hidden="true" />
          {t(AP.explanation)}
        </h3>
        <div className="ln-md">
          <Markdown source={problem.editorial} copy={copy} />
        </div>
      </section>
    );
  }
  if (!problem.editorialLocked) return <p className="ln-faint la-small la-sol-none">{t(AP.noExplanation)}</p>;
  return (
    <p className="la-locked">
      <Lock aria-hidden="true" />
      <span>{problem.contest !== null ? t(AP.lockedContest) : fill(t(AP.locked), { n: 3, done: Math.min(wrongs, 3) })}</span>
    </p>
  );
}

function Earlier({ problem, submissions }: { readonly problem: Problem; readonly submissions: readonly Submission[] }) {
  const { t, lang } = useLearn();
  const id = useId();
  if (submissions.length === 0) return null;
  const when = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <section className="la-earlier" aria-labelledby={`${id}-e`}>
      <h3 className="ln-eyebrow" id={`${id}-e`}>
        {t(AP.earlier)}
      </h3>
      <ul>
        {submissions.slice(0, 5).map((s) => {
          const ok = s.status === "passed";
          return (
            <li key={s.id} className={ok ? "la-ok" : "la-bad"}>
              {ok ? <CircleCheck aria-hidden="true" /> : <CircleX aria-hidden="true" />}
              <b className="la-mono">{answerText(problem.question, s.answer)}</b>
              <span>{t(ok ? AP.right : AP.wrong)}</span>
              <span className="ln-faint la-small ln-dated">{when.format(new Date(s.createdAt))}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
