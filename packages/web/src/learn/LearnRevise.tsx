import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, RotateCcw } from "lucide-react";
import { Empty } from "@parikshaa/brand/kit";
import { Markdown } from "@parikshaa/brand/markdown";
import type { Difficulty, Grade, Revision as RevisionData } from "../practice/client.ts";
import { ArrowRight } from "./icons.tsx";
import { ScreenLink, useLearn } from "./context.tsx";
import { Failed, Loading, Offline, SignedOut, useLearnData, useOnline, useRevision, waitingForNetwork } from "./data.tsx";
import { screenById, type Tri } from "./screens.ts";
import { A, fill } from "./text.ts";
import "./learn-revise.css";

/**
 * Revision (tracker row 140, K2-3; the mock's `RevisionBody`,
 * docs/learn/mock-v3/app/src/screens/revise.tsx) on what the practice site's
 * API already does: `GET /revise` gives today's cards (problems the learner
 * solved, or answered wrong in a quiz, 15 a day), each with the learner's own
 * note and the gap each grade would set; `POST /revise/<problem>` grades one.
 *
 * One card at a time: the problem first ("say it out loud, then flip"), then
 * the learner's note as the answer (Markdown, drawn as elements by the
 * brand's renderer, never as HTML), then Again, Hard, Good or Easy with the
 * days each brings. Space flips and 1 to 4 grade. The mock's concept cards,
 * mistake notebook and memory strength per topic have no backend yet
 * (Kadam 3/4, LV-B3); they are not shown.
 */

export const R = {
  eyebrow: ["Revision", "Revision", "दोहराई"],
  titleN: ["{n} cards before you forget.", "Bhoolne se pehle {n} cards.", "भूलने से पहले {n} कार्ड।"],
  titleOne: ["One card before you forget.", "Bhoolne se pehle ek card.", "भूलने से पहले एक कार्ड।"],
  sub: [
    "Problems you solved, back on the day you would start to forget them. How well you remember sets when each comes again.",
    "Aapke solve kiye problems, us din jab bhoolna shuru hota hai. Jitna yaad, utni der baad card phir aayega.",
    "आपके हल किए प्रश्न, उस दिन जब भूलना शुरू होता है। जितना याद, उतनी देर बाद कार्ड फिर आएगा।",
  ],
  progress: ["Today's revision", "Aaj ki revision", "आज की दोहराई"],
  progressText: ["{done} of {n} done", "{n} me se {done} ho gaye", "{n} में से {done} पूरे"],
  cardOf: ["Card {i} of {n}", "Card {i} / {n}", "कार्ड {i} / {n}"],
  first: ["First revision", "Pehli revision", "पहली दोहराई"],
  repsOne: ["Revised once", "Ek baar revise kiya", "एक बार दोहराया"],
  reps: ["Revised {n} times", "{n} baar revise kiya", "{n} बार दोहराया"],
  topics: ["Topics", "Topics", "विषय"],
  think: ["Say the idea out loud first: the pattern, the steps, the trap. Then flip.", "Pehle bol kar batao: pattern, steps, trap. Phir palto.", "पहले बोलकर बताएँ: पैटर्न, कदम, जाल। फिर पलटें।"],
  show: ["Show the answer", "Jawab dikhao", "उत्तर दिखाएँ"],
  answer: ["Your note", "Aapka note", "आपका नोट"],
  noNote: [
    "No note on this problem yet. Open it, solve it again in your head, and write the one line you would want here next time.",
    "Is problem par abhi note nahi. Problem kholo, dimaag me phir solve karo, aur wo ek line likho jo agli baar yahan chahiye.",
    "इस प्रश्न पर अभी नोट नहीं। प्रश्न खोलें, मन में फिर हल करें, और वह एक पंक्ति लिखें जो अगली बार यहाँ चाहिए।",
  ],
  openProblem: ["Open the problem", "Problem kholo", "प्रश्न खोलें"],
  howWent: ["How well did you remember?", "Kitna yaad tha?", "कितना याद था?"],
  again: ["Again", "Phir se", "फिर से"],
  hard: ["Hard", "Mushkil", "कठिन"],
  good: ["Good", "Theek", "ठीक"],
  easy: ["Easy", "Aasaan", "आसान"],
  days: ["{n} d", "{n} din", "{n} दिन"],
  backIn: ["back in {n} days", "{n} din baad phir", "{n} दिन बाद फिर"],
  backTomorrow: ["back tomorrow", "kal phir", "कल फिर"],
  graded: ["{title}: {when}.", "{title}: {when}.", "{title}: {when}।"],
  doneTitle: ["Today's revision is done.", "Aaj ki revision ho gayi.", "आज की दोहराई हो गई।"],
  upcoming: ["{n} more cards come back on the days ahead.", "Aage ke dino me {n} aur cards aayenge.", "आगे के दिनों में {n} और कार्ड आएँगे।"],
  upcomingOne: ["One more card comes back on a day ahead.", "Aage ek aur card aayega.", "आगे एक और कार्ड आएगा।"],
  later: ["{n} more were due today; 15 come a day, so they are next.", "Aaj {n} aur due the; roz 15 aate hain, isliye wo agle.", "आज {n} और बाकी थे; रोज़ 15 आते हैं, इसलिए वे अगले।"],
  noneTitle: ["Nothing to revise today", "Aaj revise karne ko kuch nahi", "आज दोहराने को कुछ नहीं"],
  noneBody: [
    "Each problem you solve comes back here on the day you would start to forget it.",
    "Har solve kiya problem yahan us din aata hai jab use bhoolna shuru hota hai.",
    "हर हल किया प्रश्न यहाँ उस दिन आता है जब उसे भूलना शुरू होता है।",
  ],
  toToday: ["Back to Today", "Aaj par wapas", "आज पर वापस"],
  signInFirst: ["Sign in to revise", "Revise karne ke liye sign in karo", "दोहराने के लिए साइन इन करें"],
  how: [
    "Again brings a card back tomorrow, Hard a little later, and Good and Easy further each time you remember it.",
    "Phir se = kal; Mushkil = thoda baad; Theek aur Aasaan = har baar yaad rehne par aur door.",
    "फिर से = कल; कठिन = थोड़ा बाद; ठीक और आसान = हर बार याद रहने पर और दूर।",
  ],
} as const satisfies Record<string, Tri>;

export const GRADES: readonly Grade[] = ["again", "hard", "good", "easy"];
const LEVEL_WORD: Record<Difficulty, Tri> = { easy: A.easy, medium: A.medium, hard: A.hard };
type Card = RevisionData["due"][number];

/** The heading where the cards cannot show: signed out, loading, failed. */
function Frame({ children }: { readonly children: ReactNode }) {
  const { t } = useLearn();
  return (
    <div className="ln-stack">
      <h1 className="ln-page-h1">{t(screenById("revision")?.title ?? R.eyebrow)}</h1>
      {children}
    </div>
  );
}

export function Revision() {
  const { t } = useLearn();
  const { signedIn } = useLearnData();
  const revision = useRevision();
  const online = useOnline();
  if (!signedIn) {
    return (
      <Frame>
        <SignedOut title={t(R.signInFirst)} />
      </Frame>
    );
  }
  if (waitingForNetwork(revision)) {
    return (
      <Frame>
        <Offline waiting />
      </Frame>
    );
  }
  if (revision.isPending) {
    return (
      <Frame>
        <Loading shape="doc" />
      </Frame>
    );
  }
  if (revision.isError) {
    return (
      <Frame>
        <Failed error={revision.error} onRetry={() => void revision.refetch()} retrying={revision.isFetching} />
      </Frame>
    );
  }
  return <Cards data={revision.data} offline={!online} />;
}

/** Whether a key press belongs to a field, a menu or a dialog, which keep their keys; Space also to a button or link it presses. */
const ownsKeys = (target: EventTarget | null, key: string): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.closest(key === " " ? "input, textarea, select, button, a, [role=menu], [role=dialog]" : "input, textarea, select, [role=menu], [role=dialog]") !== null);

function Cards({ data, offline }: { readonly data: RevisionData; readonly offline: boolean }) {
  const { t, site } = useLearn();
  const { client } = useLearnData();
  const queryClient = useQueryClient();
  // Cards graded on this page: the list refreshes behind them, so they are set aside here at once.
  const [graded, setGraded] = useState<readonly string[]>([]);
  const [shown, setShown] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const flip = useRef<HTMLButtonElement>(null);
  const answer = useRef<HTMLDivElement>(null);
  const moved = useRef<"flip" | "grade" | null>(null);
  // Oldest first, then by name: the same order on every device and every reload.
  const left = [...data.due].sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title)).filter((card) => !graded.includes(card.slug));
  const card = left[0];
  const total = graded.length + left.length;
  const grade = useMutation({
    mutationFn: ({ slug, g }: { readonly slug: string; readonly g: Grade }) => client.grade(slug, g),
    onSuccess: (result, { slug }) => {
      const title = data.due.find((c) => c.slug === slug)?.title ?? slug;
      setGraded((was) => [...was, slug]);
      setShown(null);
      moved.current = "grade";
      setSaid(fill(t(R.graded), { title, when: result.intervalDays <= 1 ? t(R.backTomorrow) : fill(t(R.backIn), { n: result.intervalDays }) }));
      void queryClient.invalidateQueries({ queryKey: ["practice", site] });
    },
  });
  const canGrade = card !== undefined && shown === card.slug && !grade.isPending && !offline;
  const choose = (g: Grade) => {
    if (card !== undefined && canGrade) grade.mutate({ slug: card.slug, g });
  };

  // After a flip the answer is read; after a grade the next card's flip button has the focus.
  useEffect(() => {
    const was = moved.current;
    moved.current = null;
    if (was === "flip") answer.current?.focus();
    else if (was === "grade") flip.current?.focus();
  }, [shown, card?.slug]);

  // Space flips, 1 to 4 grade (DESIGN-SYSTEM §9: the keyboard does what the buttons do).
  const keys = useRef({ card, shown, canGrade, choose });
  keys.current = { card, shown, canGrade, choose };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || ownsKeys(event.target, event.key)) return;
      const now = keys.current;
      if (now.card === undefined) return;
      if (event.key === " " && now.shown !== now.card.slug) {
        event.preventDefault();
        moved.current = "flip";
        setShown(now.card.slug);
      } else if (/^[1-4]$/.test(event.key) && now.canGrade) {
        event.preventDefault();
        now.choose(GRADES[Number(event.key) - 1]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (data.due.length === 0 && graded.length === 0) {
    return (
      <Frame>
        <Empty
          icon={<RotateCcw />}
          title={t(R.noneTitle)}
          body={[t(R.noneBody), upcomingLine(data.upcoming, t)].filter((x) => x !== "").join(" ")}
          action={
            <ScreenLink to="aaj" className="ln-btn">
              {t(R.toToday)}
            </ScreenLink>
          }
        />
      </Frame>
    );
  }

  return (
    <div className="ln-stack">
      {offline ? <Offline /> : null}
      <header className="lr-head">
        <div className="ln-grow">
          <p className="ln-eyebrow">{t(R.eyebrow)}</p>
          <h1 className="ln-page-h1">{total === 1 ? t(R.titleOne) : fill(t(R.titleN), { n: total })}</h1>
          <p className="lr-sub">{t(R.sub)}</p>
        </div>
        <div className="lr-prog">
          <div
            className="lr-segs"
            role="progressbar"
            aria-label={t(R.progress)}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={graded.length}
            aria-valuetext={fill(t(R.progressText), { done: graded.length, n: total })}
          >
            {Array.from({ length: total }, (_, k) => (
              <i key={k} className={k < graded.length ? "lr-ok" : k === graded.length ? "lr-on" : undefined} />
            ))}
          </div>
          {card === undefined ? null : (
            <span className="ln-faint lr-num" aria-hidden="true">
              {fill(t(R.cardOf), { i: graded.length + 1, n: total })}
            </span>
          )}
        </div>
      </header>

      <p className="ln-sr" role="status">
        {said ?? ""}
      </p>
      {said === null ? null : (
        <p className="lr-said" aria-hidden="true">
          {said}
        </p>
      )}

      {card === undefined ? (
        <Done data={data} />
      ) : (
        <div className="lr-wrap">
          <FlashCard
            key={card.slug}
            card={card}
            shown={shown === card.slug}
            answerRef={answer}
            index={graded.length + 1}
            total={total}
          />
          {shown === card.slug ? (
            <div className="lr-grades" role="group" aria-label={t(R.howWent)}>
              {GRADES.map((g, i) => (
                <button key={g} type="button" className={`lr-grade lr-g-${g}`} disabled={!canGrade} onClick={() => choose(g)} aria-keyshortcuts={String(i + 1)}>
                  <b>{t(R[g])}</b>
                  <span aria-hidden="true">{fill(t(R.days), { n: card.next[g] })}</span>
                  <span className="ln-sr">{card.next[g] <= 1 ? t(R.backTomorrow) : fill(t(R.backIn), { n: card.next[g] })}</span>
                </button>
              ))}
            </div>
          ) : (
            <button
              ref={flip}
              type="button"
              className="ln-btn ln-btn-pri ln-btn-lg lr-flip"
              aria-keyshortcuts="Space"
              onClick={() => {
                moved.current = "flip";
                setShown(card.slug);
              }}
            >
              <Eye aria-hidden="true" />
              {t(R.show)}
              <kbd className="lr-kbd" aria-hidden="true">
                Space
              </kbd>
            </button>
          )}
          {grade.isError ? <Failed error={grade.error} onRetry={() => grade.variables === undefined ? undefined : grade.mutate(grade.variables)} headingLevel={3} /> : null}
          <p className="lr-how ln-faint">{t(R.how)}</p>
        </div>
      )}
    </div>
  );
}

const upcomingLine = (n: number, t: (tri: Tri) => string): string => (n === 0 ? "" : n === 1 ? t(R.upcomingOne) : fill(t(R.upcoming), { n }));

function FlashCard({
  card,
  shown,
  answerRef,
  index,
  total,
}: {
  readonly card: Card;
  readonly shown: boolean;
  readonly answerRef: RefObject<HTMLDivElement | null>;
  readonly index: number;
  readonly total: number;
}) {
  const { t } = useLearn();
  const reps = card.reps === 0 ? t(R.first) : card.reps === 1 ? t(R.repsOne) : fill(t(R.reps), { n: card.reps });
  const problem = `problems/${encodeURIComponent(card.slug)}`;
  return (
    <article className="lr-card" aria-label={fill(t(R.cardOf), { i: index, n: total })}>
      <div className="lr-card-top">
        <span className={`lr-level lr-lv-${card.difficulty}`}>{t(LEVEL_WORD[card.difficulty])}</span>
        <span className="ln-faint">{reps}</span>
      </div>
      <h2 className="lr-q">{card.title}</h2>
      {card.tags.length === 0 ? null : (
        <ul className="lr-tags" aria-label={t(R.topics)}>
          {card.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      {shown ? (
        <div className="lr-a" ref={answerRef} tabIndex={-1} aria-labelledby={`lr-a-${card.slug}`}>
          <p className="ln-eyebrow" id={`lr-a-${card.slug}`}>
            {t(R.answer)}
          </p>
          {card.note === null || card.note.trim() === "" ? <p className="lr-none">{t(R.noNote)}</p> : <Markdown source={card.note} className="ln-md" />}
          <ScreenLink to={problem} className="lr-open">
            {t(R.openProblem)}
            <ArrowRight aria-hidden="true" />
          </ScreenLink>
        </div>
      ) : (
        <p className="lr-think">{t(R.think)}</p>
      )}
    </article>
  );
}

function Done({ data }: { readonly data: RevisionData }) {
  const { t } = useLearn();
  const lines = [upcomingLine(data.upcoming, t), data.later === 0 ? "" : fill(t(R.later), { n: data.later })].filter((x) => x !== "");
  return (
    <section className="lr-done" aria-labelledby="lr-done-h">
      <span className="lr-done-tick" aria-hidden="true">
        <svg viewBox="0 0 56 56" width="56" height="56" focusable="false">
          <circle cx="28" cy="28" r="26" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M17 29l7 7 15-16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h2 className="lr-done-h" id="lr-done-h">
        {t(R.doneTitle)}
      </h2>
      {lines.map((line) => (
        <p key={line} className="ln-faint">
          {line}
        </p>
      ))}
      <ScreenLink to="aaj" className="ln-btn ln-btn-pri">
        {t(R.toToday)}
        <ArrowRight aria-hidden="true" />
      </ScreenLink>
    </section>
  );
}
