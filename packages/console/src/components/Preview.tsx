import { useEffect, useId, useMemo, useState } from "react";
import { Dialog } from "@parikshaa/brand/ui";
import { ChevronLeft, ChevronRight, Eye, Flag, RotateCcw, X } from "lucide-react";
import { paperOf, resolvePaper, scoreDeterministic, type AttemptId, type Exam, type Question } from "@parikshaa/core/browser";
import { KIND_NAME } from "./Bank.tsx";

/**
 * Seeing a paper as a candidate will: one question read-only, from the
 * editor's list, or the whole test tried end to end with a clock and a
 * palette. Nothing is sent to the server and nothing is recorded; an
 * examiner can try a test as often as they like, sat or not.
 */

const chosenOf = (answer: string): ReadonlySet<number> =>
  new Set(
    answer
      .split(",")
      .filter((p) => /^\d+$/.test(p.trim()))
      .map(Number),
  );

/** A question as the candidate sees it. Without `onAnswer`, read-only, with the right answer shown for the examiner. */
export function QuestionView({
  question,
  number,
  answer = "",
  onAnswer,
}: {
  question: Question;
  number: number;
  answer?: string;
  onAnswer?: (next: string) => void;
}) {
  const examiner = onAnswer === undefined;
  // Unique per view: a preview and a try of the same question can be on screen at once.
  const name = `q-${question.id}-${useId()}`;
  return (
    <div className="qpreview">
      <div className="qpreview-head">
        <span className="qnum">Question {number}</span>
        <span className="tag">{KIND_NAME[question.kind]}</span>
        <span className="spacer" />
        <span className="notice">
          {question.maxScore} mark{question.maxScore === 1 ? "" : "s"}
          {"negativeMarks" in question && question.negativeMarks ? ` · −${question.negativeMarks} if wrong` : ""}
        </span>
      </div>
      {question.passage === undefined ? null : (
        <aside className="qpreview-passage" aria-label="Passage">
          {question.passage.title === undefined ? null : <strong>{question.passage.title}</strong>}
          <p>{question.passage.text}</p>
        </aside>
      )}
      <p className="qpreview-stem">{question.stem}</p>
      {(question.images ?? []).map((image) => (
        <img key={image.media} className="qpreview-image" src={`/api/media/${image.media}`} alt={image.alt} />
      ))}

      {question.kind === "mcq" ? (
        <McqOptions question={question} name={name} answer={answer} examiner={examiner} {...(onAnswer === undefined ? {} : { onAnswer })} />
      ) : question.kind === "numeric" ? (
        examiner ? (
          <p className="qpreview-key">
            Answer: {question.expected}
            {question.tolerance > 0 ? ` ± ${question.tolerance}` : ""}
          </p>
        ) : (
          <label className="field">
            <span>Your answer</span>
            <input inputMode="decimal" value={answer} onChange={(e) => onAnswer(e.target.value)} style={{ maxWidth: "14rem" }} />
          </label>
        )
      ) : question.kind === "short" ? (
        examiner ? (
          question.expectedPoints.length === 0 ? null : (
            <div className="qpreview-key">
              Looked for:
              <ul>
                {question.expectedPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )
        ) : (
          <label className="field">
            <span>Your answer</span>
            <textarea rows={6} value={answer} onChange={(e) => onAnswer(e.target.value)} />
          </label>
        )
      ) : (
        <>
          {question.starter === undefined || !examiner ? null : <pre className="code">{question.starter}</pre>}
          {examiner ? (
            <p className="notice">
              {question.language}
              {(question.languages ?? []).length > 1 ? ` and ${(question.languages ?? []).length - 1} more` : ""} ·{" "}
              {(question.tests ?? []).length} test{(question.tests ?? []).length === 1 ? "" : "s"},{" "}
              {(question.tests ?? []).filter((t) => t.hidden).length} hidden
            </p>
          ) : (
            <label className="field">
              <span>Your code ({question.language})</span>
              <textarea className="mono" rows={10} spellCheck={false} value={answer === "" ? (question.starter ?? "") : answer} onChange={(e) => onAnswer(e.target.value)} />
            </label>
          )}
        </>
      )}
    </div>
  );
}

function McqOptions({
  question,
  name,
  answer,
  examiner,
  onAnswer,
}: {
  question: Extract<Question, { kind: "mcq" }>;
  name: string;
  answer: string;
  examiner: boolean;
  onAnswer?: (next: string) => void;
}) {
  const several = (question.correctIndices ?? []).length > 1;
  const right = new Set(several ? question.correctIndices : [question.correctIndex]);
  const chosen = chosenOf(answer);
  return (
    <fieldset className="qpreview-options">
      <legend className="visually-hidden">Options</legend>
      {several ? <p className="notice">Choose every right option.</p> : null}
      {question.options.map((option, i) => (
        <label key={i} className={`qpreview-option${examiner && right.has(i) ? " right" : ""}${chosen.has(i) ? " chosen" : ""}`}>
          <input
            type={several ? "checkbox" : "radio"}
            name={name}
            checked={examiner ? right.has(i) : chosen.has(i)}
            disabled={examiner}
            onChange={(e) => {
              if (onAnswer === undefined) return;
              if (!several) return onAnswer(String(i));
              const next = new Set(chosen);
              if (e.target.checked) next.add(i);
              else next.delete(i);
              onAnswer([...next].sort((a, b) => a - b).join(","));
            }}
          />
          <span className="qpreview-letter" aria-hidden="true">
            {String.fromCharCode(65 + i)}
          </span>
          <span>{option}</span>
          {examiner && right.has(i) ? <span className="pill ok">Correct</span> : null}
        </label>
      ))}
    </fieldset>
  );
}

type Mark = "not-visited" | "not-answered" | "answered" | "marked" | "answered-marked";

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

/**
 * The whole test, tried as a candidate: one question at a time, the palette,
 * the clock, and at the end what the automatically marked questions would
 * have scored. A sectioned exam draws one paper, as a candidate's would be.
 */
export function TryTest({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const [seed, setSeed] = useState(() => `preview-${Date.now().toString(36)}`);
  const paper = useMemo(() => paperOf(exam, resolvePaper(exam, seed as AttemptId)).questions, [exam, seed]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Readonly<Record<string, string>>>({});
  const [marked, setMarked] = useState<ReadonlySet<string>>(new Set());
  const [visited, setVisited] = useState<ReadonlySet<string>>(new Set());
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);
  const question = paper[current];
  useEffect(() => {
    if (question !== undefined) setVisited((v) => (v.has(question.id) ? v : new Set([...v, question.id])));
  }, [question]);
  const left = exam.policy.durationMs - (now - started);

  const stateOf = (q: Question): Mark => {
    const answered = (answers[q.id] ?? "").trim() !== "";
    if (marked.has(q.id)) return answered ? "answered-marked" : "marked";
    if (answered) return "answered";
    return visited.has(q.id) ? "not-answered" : "not-visited";
  };
  const go = (index: number) => setCurrent(Math.max(0, Math.min(paper.length - 1, index)));
  const restart = () => {
    setSeed(`preview-${Date.now().toString(36)}`);
    setAnswers({});
    setMarked(new Set());
    setVisited(new Set());
    setCurrent(0);
    setFinished(false);
  };

  return (
    <Dialog label="Try test" variant="full" className="try" onClose={onClose}>
        <header className="try-bar">
          <span className="try-badge">
            <Eye aria-hidden="true" />
            Preview
          </span>
          <strong className="try-title">{exam.title || "Untitled exam"}</strong>
          <span className="try-note">Nothing you do here is saved</span>
          <span className="spacer" />
          {finished ? null : (
            <span className={`try-clock${left < 5 * 60_000 ? " low" : ""}`} role="timer" aria-label={`${Math.ceil(Math.max(0, left) / 60_000)} minutes left`}>
              {clock(left)}
            </span>
          )}
          <button type="button" className="secondary" onClick={onClose}>
            <X aria-hidden="true" />
            End preview
          </button>
        </header>

        {paper.length === 0 ? (
          <p className="notice try-empty">This exam has no questions yet.</p>
        ) : finished ? (
          <TryResult paper={paper} answers={answers} onAgain={restart} onClose={onClose} />
        ) : (
          <div className="try-body">
            <main className="try-main">
              {question === undefined ? null : (
                <QuestionView
                  key={question.id}
                  question={question}
                  number={current + 1}
                  answer={answers[question.id] ?? ""}
                  onAnswer={(next) => setAnswers((a) => ({ ...a, [question.id]: next }))}
                />
              )}
              <footer className="try-foot">
                <button type="button" className="secondary" disabled={current === 0} onClick={() => go(current - 1)}>
                  <ChevronLeft aria-hidden="true" />
                  Previous
                </button>
                <button type="button" className="quiet" onClick={() => question && setAnswers((a) => ({ ...a, [question.id]: "" }))}>
                  Clear response
                </button>
                <span className="spacer" />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    if (question === undefined) return;
                    setMarked((m) => {
                      const next = new Set(m);
                      if (next.has(question.id)) next.delete(question.id);
                      else next.add(question.id);
                      return next;
                    });
                    go(current + 1);
                  }}
                >
                  <Flag aria-hidden="true" />
                  Mark for review &amp; next
                </button>
                {current === paper.length - 1 ? (
                  <button type="button" onClick={() => setFinished(true)}>
                    Finish preview
                  </button>
                ) : (
                  <button type="button" onClick={() => go(current + 1)}>
                    Save &amp; next
                    <ChevronRight aria-hidden="true" />
                  </button>
                )}
              </footer>
            </main>
            <aside className="try-side" aria-label="Question palette">
              <div className="try-palette" role="group" aria-label="Questions">
                {paper.map((q, i) => (
                  <button
                    key={q.id}
                    type="button"
                    className={`try-cell ${stateOf(q)}${i === current ? " current" : ""}`}
                    aria-current={i === current ? "step" : undefined}
                    aria-label={`Question ${i + 1}: ${stateOf(q).replace("-", " ")}`}
                    onClick={() => go(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <ul className="try-legend">
                <li>
                  <span className="try-cell answered" aria-hidden="true" /> Answered
                </li>
                <li>
                  <span className="try-cell not-answered" aria-hidden="true" /> Not answered
                </li>
                <li>
                  <span className="try-cell marked" aria-hidden="true" /> Marked
                </li>
                <li>
                  <span className="try-cell not-visited" aria-hidden="true" /> Not visited
                </li>
              </ul>
              <button type="button" className="block" onClick={() => setFinished(true)}>
                Submit preview
              </button>
            </aside>
          </div>
        )}
    </Dialog>
  );
}

function TryResult({
  paper,
  answers,
  onAgain,
  onClose,
}: {
  paper: readonly Question[];
  answers: Readonly<Record<string, string>>;
  onAgain: () => void;
  onClose: () => void;
}) {
  const rows = paper.map((q) => {
    const given = answers[q.id] ?? "";
    const scored = q.kind === "mcq" || q.kind === "numeric" ? scoreDeterministic(q, given) : null;
    return { q, answered: given.trim() !== "", score: scored?.score ?? null };
  });
  const auto = rows.filter((r) => r.score !== null);
  const got = auto.reduce((s, r) => s + (r.score ?? 0), 0);
  const outOf = auto.reduce((s, r) => s + r.q.maxScore, 0);
  return (
    <section className="try-result" aria-label="How the preview went">
      <h2>Preview finished</h2>
      <p>
        {auto.length === 0
          ? "No question on this paper is marked automatically; a person or the rubric grader marks them."
          : `${Math.round(got * 100) / 100} of ${outOf} marks on the ${auto.length} question${auto.length === 1 ? "" : "s"} marked automatically.`}{" "}
        <span className="notice">The rest are marked by a grader after a real attempt.</span>
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Question</th>
            <th scope="col">Type</th>
            <th scope="col">Answered</th>
            <th scope="col" className="num">
              Marks
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ q, answered, score }, i) => (
            <tr key={q.id}>
              <td className="mono">{i + 1}</td>
              <td>{q.stem.length > 80 ? `${q.stem.slice(0, 80)}…` : q.stem}</td>
              <td>{KIND_NAME[q.kind]}</td>
              <td>{answered ? "Yes" : "No"}</td>
              <td className="num">{score === null ? "Graded later" : `${Math.round(score * 100) / 100} / ${q.maxScore}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <button type="button" className="secondary" onClick={onAgain}>
          <RotateCcw aria-hidden="true" />
          Try again
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}
