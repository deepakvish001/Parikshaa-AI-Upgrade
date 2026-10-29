import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Empty } from "@parikshaa/brand/kit";
import { Markdown } from "@parikshaa/brand/markdown";
import { ApiError } from "../api.ts";
import type { Lesson, QuizResult, TrackItem, TrackView } from "../practice/client.ts";
import { ScreenLink, useLearn } from "./context.tsx";
import { Failed, Loading, Offline, useLearnData, useLearnQuery, useLesson, useOnline, usePlan, useTrack, useTracks, waitingForNetwork } from "./data.tsx";
import { ArrowRight, BookOpen, icon, Sparkles } from "./icons.tsx";
import { LESSON_SCREEN, type Tri } from "./screens.ts";
import { D, fill } from "./text.ts";
import "./learn-lesson.css";

/**
 * The lesson reader (tracker row 140, K2-4; the mock's `LessonBody` and
 * `LessonRail`, docs/learn/mock-v3/app/src/screens/learn.tsx), at the old
 * site's address `lessons/<lesson>`, on what the practice site's API already
 * does:
 *
 * - `GET /lessons/<lesson>`: the lesson's Markdown, drawn by the brand's
 *   renderer (elements, never HTML), its minutes, a video link (http and
 *   https only, opened outside), and whether it needs Plus;
 * - `POST /lessons/<lesson>/done`: marks it done, with the coins it pays;
 * - its quiz (`POST /lessons/<lesson>/quiz`): choice and number questions,
 *   asked without their answers and checked at once; each wrong one is due
 *   for revision today;
 * - the learner's note on it (`GET`/`PUT /notes/lesson/<lesson>`, Markdown);
 * - where it sits: the sheet it came from (`?track=`), or the plan's, or the
 *   site's only track (`GET /tracks/<track>`) gives the module's contents
 *   beside it and the items before and after.
 *
 * Open to anyone: signed out the lesson reads in full where it is free, and
 * the quiz, the note and "done" ask to sign in. Asking Sahayak about the
 * lesson opens the Sahayak pane (its answers come with K2-6). Not shown (no
 * backend yet): the mock's language switch per lesson (lessons have one
 * text), margin notes, "interview angle" and "problems that use this idea".
 */

export const LL = {
  minutes: ["{n} min read", "{n} min padhai", "{n} मिनट पढ़ाई"],
  backToSheet: ["Back to the sheet", "Sheet par wapas", "शीट पर वापस"],
  where: ["Module {m} · item {i} of {n}", "Module {m} · {n} me se {i}", "मॉड्यूल {m} · {n} में से {i}"],
  video: ["Watch the video", "Video dekho", "वीडियो देखें"],
  videoNote: ["Opens on another site", "Doosri site par khulega", "दूसरी साइट पर खुलेगा"],
  done: ["Mark as done", "Ho gaya, mark karo", "पूरा हुआ, चिह्नित करें"],
  doneAlready: ["Done", "Ho gaya", "पूरा"],
  doneCoins: ["Lesson done. +{n} coins.", "Lesson ho gaya. +{n} coins.", "पाठ पूरा। +{n} सिक्के।"],
  doneNoCoins: ["Lesson done.", "Lesson ho gaya.", "पाठ पूरा।"],
  lockedTitle: ["This lesson is part of Plus", "Ye lesson Plus me hai", "यह पाठ प्लस में है"],
  lockedBody: [
    "The first modules of every track are free. Plus opens the rest of this track.",
    "Har track ke pehle modules free hain. Plus is track ka baaki hissa kholta hai.",
    "हर ट्रैक के पहले मॉड्यूल मुफ़्त हैं। प्लस इस ट्रैक का बाकी हिस्सा खोलता है।",
  ],
  seePlus: ["See Plus on the current site", "Plus abhi wali site par dekho", "प्लस अभी की साइट पर देखें"],
  quiz: ["Check yourself", "Khud jaancho", "ख़ुद जाँचें"],
  quizHint: [
    "{n} questions, checked at once. A wrong answer comes back in revision today.",
    "{n} sawaal, turant jaanche jaate hain. Galat jawab aaj revision me aata hai.",
    "{n} सवाल, तुरंत जाँचे जाते हैं। ग़लत जवाब आज दोहराई में आता है।",
  ],
  quizHintOne: [
    "One question, checked at once. A wrong answer comes back in revision today.",
    "Ek sawaal, turant jaancha jaata hai. Galat jawab aaj revision me aata hai.",
    "एक सवाल, तुरंत जाँचा जाता है। ग़लत जवाब आज दोहराई में आता है।",
  ],
  question: ["Question {i}", "Sawaal {i}", "सवाल {i}"],
  yourAnswer: ["Your answer", "Aapka jawab", "आपका जवाब"],
  check: ["Check my answers", "Mere jawab jaancho", "मेरे जवाब जाँचें"],
  answerAll: ["Answer every question to check.", "Jaanchne ke liye har sawaal ka jawab do.", "जाँचने के लिए हर सवाल का जवाब दें।"],
  right: ["Right.", "Sahi.", "सही।"],
  wrong: ["Not quite. The answer: {answer}", "Sahi nahi. Jawab: {answer}", "सही नहीं। जवाब: {answer}"],
  score: ["{score} of {total} right", "{total} me se {score} sahi", "{total} में से {score} सही"],
  revise: ["{n} to revise today", "Aaj {n} revise karne hain", "आज {n} दोहराने हैं"],
  again: ["Try again", "Phir se karo", "फिर से करें"],
  note: ["My note", "Mera note", "मेरा नोट"],
  noteNone: ["No note on this lesson yet: the one line you would want in a week.", "Is lesson par abhi note nahi: wo ek line likho jo ek hafte baad chahiye.", "इस पाठ पर अभी नोट नहीं: वह एक पंक्ति लिखें जो एक हफ़्ते बाद चाहिए।"],
  write: ["Write a note", "Note likho", "नोट लिखें"],
  edit: ["Edit", "Badlo", "बदलें"],
  save: ["Save", "Save karo", "सहेजें"],
  cancel: ["Cancel", "Rehne do", "रहने दें"],
  noteText: ["Your note, in Markdown", "Aapka note, Markdown me", "आपका नोट, Markdown में"],
  noteHint: ["Saved to Notes. An empty note is deleted.", "Notes me save hota hai. Khaali note mit jaata hai.", "नोट्स में सहेजा जाता है। ख़ाली नोट मिट जाता है।"],
  saved: ["Note saved.", "Note save ho gaya.", "नोट सहेजा गया।"],
  askSahayak: ["Ask Sahayak about this lesson", "Is lesson par Sahayak se poochho", "इस पाठ पर सहायक से पूछें"],
  signIn: ["Sign in for the quiz, a note and your progress", "Quiz, note aur pragati ke liye sign in karo", "क्विज़, नोट और प्रगति के लिए साइन इन करें"],
  prev: ["Before: {title}", "Pichhla: {title}", "पिछला: {title}"],
  next: ["Next: {title}", "Agla: {title}", "अगला: {title}"],
  inModule: ["In this module", "Is module me", "इस मॉड्यूल में"],
  module: ["Module {m}", "Module {m}", "मॉड्यूल {m}"],
  stDone: ["done", "ho gaya", "पूरा"],
  stTried: ["tried", "koshish ki", "कोशिश की"],
  stLocked: ["needs Plus", "Plus chahiye", "प्लस चाहिए"],
  here: ["you are here", "aap yahan hain", "आप यहाँ हैं"],
  notFoundTitle: ["No lesson at this address", "Is pate par koi lesson nahi", "इस पते पर कोई पाठ नहीं"],
  notFoundBody: ["It may have been moved or taken down. The sheet has every lesson in order.", "Shayad hata ya badal diya gaya. Sheet me har lesson kram se hai.", "शायद हटा या बदल दिया गया। शीट में हर पाठ क्रम से है।"],
  toSheet: ["Open the sheet", "Sheet kholo", "शीट खोलें"],
} as const satisfies Record<string, Tri>;

const ArrowLeft = icon(
  "arrow-left",
  <>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </>,
);
const Check = icon("check", <path d="M20 6 9 17l-5-5" />);
const Lock = icon(
  "lock",
  <>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>,
);
const Play = icon("play", <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />);

/** Only an http(s) address opens: anything else (a script, a data address) is not a link. */
export const safeVideo = (url: string | null): string | null => {
  if (url === null) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
};

const itemPath = (item: Pick<TrackItem, "kind" | "slug">, track: string): string =>
  item.kind === "lesson" ? `lessons/${encodeURIComponent(item.slug)}?track=${encodeURIComponent(track)}` : `problems/${encodeURIComponent(item.slug)}`;

/** The sheet this lesson was opened from (`?track=`), if the address says. */
const trackFromAddress = (): string | null => {
  const raw = new URLSearchParams(window.location.search).get("track");
  return raw !== null && /^[a-z0-9][a-z0-9-]{0,120}$/.test(raw) ? raw : null;
};

/** Where a lesson sits in a track: its module, its place, and the items on either side. */
export function placeOf(view: TrackView, slug: string) {
  const all = view.modules.flatMap((m, mi) => m.items.map((item, ii) => ({ item, module: mi, index: ii })));
  const at = all.findIndex((x) => x.item.kind === "lesson" && x.item.slug === slug);
  if (at < 0) return null;
  const here = all[at]!;
  const mod = view.modules[here.module]!;
  return { module: here.module, title: mod.title, index: here.index, of: mod.items.length, items: mod.items, prev: all[at - 1]?.item ?? null, next: all[at + 1]?.item ?? null };
}

function Frame({ children }: { readonly children: ReactNode }) {
  const { t } = useLearn();
  return (
    <div className="ln-stack">
      <h1 className="ln-page-h1">{t(LESSON_SCREEN.title)}</h1>
      {children}
    </div>
  );
}

export function LessonReader({ slug }: { readonly slug: string }) {
  const { t } = useLearn();
  const lesson = useLesson(slug);
  if (waitingForNetwork(lesson)) {
    return (
      <Frame>
        <Offline waiting />
      </Frame>
    );
  }
  if (lesson.isPending) {
    return (
      <Frame>
        <Loading shape="doc" />
      </Frame>
    );
  }
  if (lesson.isError) {
    if (lesson.error instanceof ApiError && lesson.error.status === 404) {
      return (
        <Frame>
          <Empty
            icon={<BookOpen />}
            title={t(LL.notFoundTitle)}
            body={t(LL.notFoundBody)}
            action={
              <ScreenLink to="sheet" className="ln-btn ln-btn-pri">
                {t(LL.toSheet)}
              </ScreenLink>
            }
          />
        </Frame>
      );
    }
    return (
      <Frame>
        <Failed error={lesson.error} onRetry={() => void lesson.refetch()} retrying={lesson.isFetching} />
      </Frame>
    );
  }
  return <Reader lesson={lesson.data} />;
}

/** The track this lesson is read in: the sheet's from the address, else the plan's, else the site's only one. */
function useTrackOf(): string | null {
  const { signedIn } = useLearnData();
  const [fromAddress] = useState(trackFromAddress);
  const plan = usePlan();
  const tracks = useTracks();
  if (fromAddress !== null) return fromAddress;
  const planned = signedIn ? (plan.data?.track.slug ?? null) : null;
  if (planned !== null) return planned;
  return tracks.data?.length === 1 ? tracks.data[0]!.slug : null;
}

function Reader({ lesson }: { readonly lesson: Lesson }) {
  const { t, site, openSahayak } = useLearn();
  const { signedIn } = useLearnData();
  const online = useOnline();
  const trackSlug = useTrackOf();
  const track = useTrack(trackSlug);
  const place = track.data === undefined ? null : placeOf(track.data, lesson.slug);
  const video = safeVideo(lesson.videoUrl);
  const next = `lessons/${lesson.slug}`;
  return (
    <div className="ll-page">
      <article className="ll-main" aria-labelledby="ll-title">
        {online ? null : <Offline />}
        <div className="ll-top">
          {track.data === undefined ? null : (
            <ScreenLink to={`sheet/${encodeURIComponent(track.data.slug)}`} className="ln-btn ln-btn-ghost ln-btn-sm">
              <ArrowLeft aria-hidden="true" />
              {track.data.title}
            </ScreenLink>
          )}
          {place === null ? null : <span className="ln-faint">{fill(t(LL.where), { m: place.module + 1, i: place.index + 1, n: place.of })}</span>}
        </div>
        <header className="ll-head">
          <p className="ln-eyebrow">{fill(t(LL.minutes), { n: lesson.estMinutes })}</p>
          <h1 className="ll-title" id="ll-title">
            {lesson.title}
          </h1>
          <div className="ll-acts">
            {signedIn && !lesson.locked ? <DoneButton lesson={lesson} offline={!online} /> : null}
            {video === null || lesson.locked ? null : (
              <a className="ln-btn" href={video} target="_blank" rel="noopener noreferrer">
                <Play aria-hidden="true" />
                {t(LL.video)}
                <span className="ln-sr"> ({t(LL.videoNote)})</span>
              </a>
            )}
          </div>
        </header>
        {lesson.locked ? (
          <section className="ln-card ll-locked" aria-labelledby="ll-locked">
            <Lock aria-hidden="true" />
            <div className="ln-grow">
              <h2 className="ln-h3" id="ll-locked">
                {t(LL.lockedTitle)}
              </h2>
              <p className="ln-faint">{t(LL.lockedBody)}</p>
            </div>
            <a className="ln-btn ln-btn-pri" href={`/practice/${encodeURIComponent(site)}/plus?learn_v2=0`}>
              {t(LL.seePlus)}
            </a>
          </section>
        ) : (
          <div className="ln-md ll-body">
            <Markdown source={lesson.body} />
          </div>
        )}
        {lesson.locked ? null : !signedIn ? (
          <p className="ln-notice ln-notice-info ll-signin">
            <span className="ln-grow">{t(LL.signIn)}</span>
            <ScreenLink to={`signin?next=${encodeURIComponent(next)}`} className="ln-btn ln-btn-sm ln-btn-pri">
              {t(D.signIn)}
            </ScreenLink>
          </p>
        ) : (
          <>
            {lesson.quiz.length === 0 ? null : <Quiz lesson={lesson} offline={!online} />}
            <LessonNote slug={lesson.slug} offline={!online} />
          </>
        )}
        <div className="ll-foot">
          {lesson.locked ? null : (
            <button type="button" className="ln-btn ln-btn-ai" onClick={openSahayak}>
              <Sparkles aria-hidden="true" />
              {t(LL.askSahayak)}
            </button>
          )}
          <span className="ln-grow" />
          {place === null || track.data === undefined ? null : (
            <>
              {place.prev === null ? null : (
                <ScreenLink to={itemPath(place.prev, track.data.slug)} className="ln-btn">
                  <ArrowLeft aria-hidden="true" />
                  {fill(t(LL.prev), { title: place.prev.title })}
                </ScreenLink>
              )}
              {place.next === null ? null : (
                <ScreenLink to={itemPath(place.next, track.data.slug)} className="ln-btn ln-btn-pri">
                  {fill(t(LL.next), { title: place.next.title })}
                  <ArrowRight aria-hidden="true" />
                </ScreenLink>
              )}
            </>
          )}
        </div>
      </article>
      {place === null || track.data === undefined ? null : (
        <nav className="ln-card ll-toc" aria-label={t(LL.inModule)}>
          <p className="ln-eyebrow">{fill(t(LL.module), { m: place.module + 1 })}</p>
          <b className="ll-toc-title">{place.title}</b>
          <ol>
            {place.items.map((item, i) => {
              const here = item.kind === "lesson" && item.slug === lesson.slug;
              const status = item.status === "done" ? LL.stDone : item.locked ? LL.stLocked : item.status === "attempted" ? LL.stTried : null;
              return (
                <li key={`${item.kind}-${item.slug}`} className={here ? "ll-here" : item.status === "done" ? "ll-done" : undefined}>
                  <span className="ll-toc-n" aria-hidden="true">
                    {item.status === "done" ? <Check /> : i + 1}
                  </span>
                  <ScreenLink to={itemPath(item, track.data!.slug)} current={here}>
                    {item.title}
                    {status === null ? null : <span className="ln-sr"> ({t(status)})</span>}
                    {here ? <span className="ln-sr"> ({t(LL.here)})</span> : null}
                  </ScreenLink>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </div>
  );
}

function DoneButton({ lesson, offline }: { readonly lesson: Lesson; readonly offline: boolean }) {
  const { t, site, notify } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  const done = useMutation({
    mutationFn: () => client.lessonDone(lesson.slug),
    onSuccess: async (reward) => {
      notify({ tone: "ok", text: reward.coins > 0 ? fill(t(LL.doneCoins), { n: reward.coins }) : t(LL.doneNoCoins) });
      await queryClient.invalidateQueries({ queryKey: ["practice", site] });
    },
  });
  if (lesson.done || done.isSuccess) {
    return (
      <span className="ln-badge ln-tone-tick">
        <Check aria-hidden="true" />
        {t(LL.doneAlready)}
      </span>
    );
  }
  return (
    <>
      <button type="button" className="ln-btn ln-btn-pri" disabled={done.isPending || offline} onClick={() => done.mutate()}>
        <Check aria-hidden="true" />
        {t(LL.done)}
      </button>
      {done.isError ? <Failed error={done.error} onRetry={() => done.mutate()} headingLevel={3} /> : null}
    </>
  );
}

/** What an answer says, in the question's own words: the options it names, or the number. */
export function answerText(question: Lesson["quiz"][number]["question"], answer: string): string {
  if (question.kind !== "mcq") return answer;
  const picked = answer
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n))
    .map((n) => question.options[n])
    .filter((x): x is string => x !== undefined);
  return picked.length === 0 ? answer : picked.join(", ");
}

function Quiz({ lesson, offline }: { readonly lesson: Lesson; readonly offline: boolean }) {
  const { t, site } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  const id = useId();
  const [answers, setAnswers] = useState<Readonly<Record<string, string>>>({});
  const scoreRef = useRef<HTMLParagraphElement>(null);
  const check = useMutation({
    mutationFn: (): Promise<QuizResult> => client.lessonQuiz(lesson.slug, answers),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["practice", site] }),
  });
  const result = check.data;
  useEffect(() => {
    if (result !== undefined) scoreRef.current?.focus();
  }, [result]);
  const outcome = new Map((result?.results ?? []).map((r) => [r.slug, r]));
  const ready = lesson.quiz.every((q) => (answers[q.slug] ?? "").trim() !== "");
  const set = (slug: string, value: string) => setAnswers((was) => ({ ...was, [slug]: value }));
  return (
    <section className="ln-card ll-quiz" aria-labelledby={`${id}-h`}>
      <h2 className="ln-h3" id={`${id}-h`}>
        {t(LL.quiz)}
      </h2>
      <p className="ln-faint">{lesson.quiz.length === 1 ? t(LL.quizHintOne) : fill(t(LL.quizHint), { n: lesson.quiz.length })}</p>
      <ol className="ll-qs">
        {lesson.quiz.map((q, i) => {
          const r = outcome.get(q.slug);
          const name = `${id}-${q.slug}`;
          const value = answers[q.slug] ?? "";
          const locked = result !== undefined;
          return (
            <li key={q.slug} className={r === undefined ? undefined : r.right ? "ll-right" : "ll-wrong"}>
              <fieldset className="ll-q">
                <legend className="ln-sr">{fill(t(LL.question), { i: i + 1 })}</legend>
                <div className="ln-md ll-stem">
                  <Markdown source={q.question.stem} />
                </div>
                {q.question.kind === "mcq" ? (
                  <div className="ll-options">
                    {q.question.options.map((option, oi) => {
                      const chosen = q.question.kind === "mcq" && q.question.multiple ? value.split(",").includes(String(oi)) : value === String(oi);
                      const multiple = q.question.kind === "mcq" && q.question.multiple;
                      return (
                        <label key={`${oi}-${option}`} className={`ll-option${chosen ? " ll-on" : ""}`}>
                          <input
                            type={multiple ? "checkbox" : "radio"}
                            name={name}
                            checked={chosen}
                            disabled={locked}
                            onChange={() => {
                              if (!multiple) return set(q.slug, String(oi));
                              const now = new Set(value === "" ? [] : value.split(","));
                              if (now.has(String(oi))) now.delete(String(oi));
                              else now.add(String(oi));
                              set(q.slug, [...now].map(Number).sort((a, b) => a - b).join(","));
                            }}
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <label className="ln-field ll-num">
                    <span>{t(LL.yourAnswer)}</span>
                    <input className="ln-input" inputMode={q.question.kind === "numeric" ? "decimal" : "text"} value={value} disabled={locked} maxLength={200} onChange={(event) => set(q.slug, event.target.value)} />
                  </label>
                )}
              </fieldset>
              {r === undefined ? null : (
                <div className={`ll-verdict ${r.right ? "ll-v-right" : "ll-v-wrong"}`}>
                  <p>
                    <b>{r.right ? t(LL.right) : fill(t(LL.wrong), { answer: answerText(q.question, r.answer) })}</b>
                  </p>
                  {r.explanation.trim() === "" ? null : (
                    <div className="ln-md">
                      <Markdown source={r.explanation} />
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {check.isError ? <Failed error={check.error} onRetry={() => check.mutate()} headingLevel={3} /> : null}
      {result === undefined ? (
        <div className="ll-row">
          <button type="button" className="ln-btn ln-btn-pri" disabled={!ready || check.isPending || offline} onClick={() => check.mutate()} aria-describedby={ready ? undefined : `${id}-why`}>
            {t(LL.check)}
          </button>
          {ready ? null : (
            <span className="ln-faint" id={`${id}-why`}>
              {t(LL.answerAll)}
            </span>
          )}
        </div>
      ) : (
        <div className="ll-row">
          <p className="ll-score" ref={scoreRef} tabIndex={-1} role="status">
            <b>{fill(t(LL.score), { score: result.score, total: result.total })}</b>
            {result.revise === 0 ? null : <span className="ln-badge ln-tone-red">{fill(t(LL.revise), { n: result.revise })}</span>}
          </p>
          <button
            type="button"
            className="ln-btn"
            onClick={() => {
              check.reset();
              setAnswers({});
            }}
          >
            {t(LL.again)}
          </button>
        </div>
      )}
    </section>
  );
}

function LessonNote({ slug, offline }: { readonly slug: string; readonly offline: boolean }) {
  const { t, site, notify } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  const id = useId();
  const note = useLearnQuery(["note", "lesson", slug], (c) => c.note("lesson", slug));
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) box.current?.focus();
  }, [editing]);
  const save = useMutation({
    mutationFn: () => client.saveNote("lesson", slug, body),
    onSuccess: async () => {
      setEditing(false);
      notify({ tone: "ok", text: t(LL.saved) });
      await queryClient.invalidateQueries({ queryKey: ["practice", site] });
    },
  });
  const saved = note.data?.body ?? "";
  return (
    <section className="ln-card ll-note" aria-labelledby={`${id}-h`}>
      <div className="ll-note-h">
        <h2 className="ln-h3 ln-grow" id={`${id}-h`}>
          {t(LL.note)}
        </h2>
        {editing || note.isPending || note.isError ? null : (
          <button
            type="button"
            className="ln-btn ln-btn-sm"
            onClick={() => {
              setBody(saved);
              setEditing(true);
            }}
          >
            {t(saved === "" ? LL.write : LL.edit)}
          </button>
        )}
      </div>
      {note.isPending ? (
        <Loading shape="doc" />
      ) : note.isError ? (
        <Failed error={note.error} onRetry={() => void note.refetch()} retrying={note.isFetching} headingLevel={3} />
      ) : editing ? (
        <form
          className="ll-note-form"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label className="ln-field">
            <span>{t(LL.noteText)}</span>
            <textarea ref={box} className="ln-input ll-note-text" rows={6} maxLength={50_000} value={body} onChange={(event) => setBody(event.target.value)} aria-describedby={`${id}-hint`} />
          </label>
          <p className="ln-faint" id={`${id}-hint`}>
            {t(LL.noteHint)}
          </p>
          {save.isError ? <Failed error={save.error} onRetry={() => save.mutate()} headingLevel={3} /> : null}
          <div className="ll-row">
            <button type="submit" className="ln-btn ln-btn-pri" disabled={save.isPending || offline}>
              {t(LL.save)}
            </button>
            <button type="button" className="ln-btn ln-btn-ghost" onClick={() => setEditing(false)}>
              {t(LL.cancel)}
            </button>
          </div>
        </form>
      ) : saved === "" ? (
        <p className="ln-faint">{t(LL.noteNone)}</p>
      ) : (
        <div className="ln-md ll-note-body">
          <Markdown source={saved} />
        </div>
      )}
    </section>
  );
}
