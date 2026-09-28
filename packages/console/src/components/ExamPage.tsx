import { useState, type ReactNode } from "react";
import { CircleCheck, CircleX, Clock, Eye, Hourglass, Mail, Pencil, Play, SquareCheckBig, Target } from "lucide-react";
import type { Exam } from "@parikshaa/core/browser";
import type { ExamSummary, Results } from "../api.ts";
import { KIND_NAME } from "./Bank.tsx";
import { paperMarks } from "./ExamEditor.tsx";
import { QuestionView, TryTest } from "./Preview.tsx";

/**
 * One exam, as a test platform's test page: tabs for everything about it —
 * who is sitting it, its questions, invitations, the live room, results —
 * and down the side where its candidates stand.
 */

export type ExamTab = "attempts" | "questions" | "candidates" | "live" | "results";

const TABS: readonly (readonly [ExamTab, string])[] = [
  ["attempts", "Overview"],
  ["questions", "Questions"],
  ["candidates", "Candidates"],
  ["live", "Live sitting"],
  ["results", "Results"],
];

export function ExamTabs({ current, onGo, canReview }: { current: ExamTab | null; onGo: (tab: ExamTab) => void; canReview: boolean }) {
  return (
    <nav className="tabs exam-tabs" aria-label="Exam">
      {TABS.filter(([id]) => id !== "results" || canReview).map(([id, label]) => (
        <button key={id} type="button" className={`tab${current === id ? " on" : ""}`} aria-current={current === id ? "page" : undefined} onClick={() => onGo(id)}>
          {label}
        </button>
      ))}
    </nav>
  );
}

const minutes = (ms: number) => `${Math.round(ms / 60_000)} min`;

/**
 * Where the exam's candidates stand, as counts down the side of its page.
 * Qualified and not qualified appear once the exam has a qualifying mark and
 * someone has been graded against it.
 */
export function ExamSide({
  summary,
  exam,
  results,
  onResults,
  onEdit,
  onTry,
}: {
  summary: ExamSummary | undefined;
  exam: Exam | undefined;
  results: Results | undefined;
  onResults?: () => void;
  onEdit?: () => void;
  onTry?: () => void;
}) {
  const c = summary?.attempts ?? { invited: 0, inProgress: 0, submitted: 0, graded: 0, void: 0 };
  const cutoff = exam?.policy.cutoff;
  const qualified = results?.analytics.qualified ?? null;
  const failed = results?.analytics.failed ?? null;
  const counts: readonly { label: string; value: number | string; icon: typeof Mail; tone?: string }[] = [
    { label: "Invited", value: c.invited, icon: Mail },
    { label: "In progress", value: c.inProgress, icon: Hourglass, ...(c.inProgress > 0 ? { tone: "live" } : {}) },
    { label: "Completed", value: c.submitted + c.graded, icon: SquareCheckBig },
    { label: "To evaluate", value: c.submitted, icon: Clock, ...(c.submitted > 0 ? { tone: "attention" } : {}) },
    ...(cutoff === undefined
      ? []
      : [
          { label: "Qualified", value: qualified ?? "—", icon: CircleCheck, tone: "ok" },
          { label: "Not qualified", value: failed ?? "—", icon: CircleX, tone: "bad" },
        ]),
  ];
  return (
    <aside className="exam-side" aria-label="Candidates at a glance">
      <section className="card side-card">
        <h2 className="card-title">Candidates</h2>
        <ul className="side-counts">
          {counts.map(({ label, value, icon: Icon, tone }) => (
            <li key={label} className={tone === undefined ? undefined : tone}>
              <Icon aria-hidden="true" />
              <span className="side-label">{label}</span>
              <span className="side-value">{value}</span>
            </li>
          ))}
        </ul>
        {cutoff === undefined ? <p className="notice small">No qualifying mark is set, so results show marks only.</p> : null}
        {onResults === undefined ? null : (
          <button type="button" className="quiet block" onClick={onResults}>
            See results
          </button>
        )}
      </section>

      {exam === undefined ? null : (
        <section className="card side-card">
          <h2 className="card-title">This test</h2>
          <dl className="side-facts">
            <div>
              <dt>Duration</dt>
              <dd>{minutes(exam.policy.durationMs)}</dd>
            </div>
            <div>
              <dt>Questions</dt>
              <dd>{exam.questions.length + (exam.sections ?? []).reduce((s, x) => s + x.pick, 0)}</dd>
            </div>
            <div>
              <dt>Marks</dt>
              <dd>{paperMarks(exam)}</dd>
            </div>
            <div>
              <dt>Qualifying</dt>
              <dd>{cutoff === undefined ? "Not set" : `${cutoff.percent}%`}</dd>
            </div>
            <div>
              <dt>Answers</dt>
              <dd>{exam.policy.allowRevision ? "May be changed" : "Final once saved"}</dd>
            </div>
            <div>
              <dt>Camera</dt>
              <dd>{exam.policy.proctoring === undefined ? "Not used" : "Proctored"}</dd>
            </div>
          </dl>
          <div className="side-actions">
            {onTry === undefined ? null : (
              <button type="button" className="secondary" onClick={onTry}>
                <Play aria-hidden="true" />
                Try test
              </button>
            )}
            {onEdit === undefined ? null : (
              <button type="button" className="quiet" onClick={onEdit}>
                <Pencil aria-hidden="true" />
                Edit
              </button>
            )}
          </div>
        </section>
      )}
    </aside>
  );
}

/** The overview: what is happening now, beside the counts. */
export function ExamOverview({ side, children }: { side: ReactNode; children: ReactNode }) {
  return (
    <div className="exam-layout">
      <div className="exam-main">{children}</div>
      {side}
    </div>
  );
}

/**
 * The exam's questions, read-only, each with a preview as the candidate will
 * see it: every candidate's questions, then each section's pool.
 */
export function QuestionsTab({ exam, frozen, onEdit }: { exam: Exam; frozen: boolean; onEdit?: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [trying, setTrying] = useState(false);
  const row = (question: Exam["questions"][number], label: string) => (
    <li key={question.id} className="qread">
      <div className="qitem-row">
        <span className="qitem-num" aria-hidden="true">
          {label}
        </span>
        <span className="tag">{KIND_NAME[question.kind]}</span>
        <span className="qitem-stem static">{question.stem.length > 140 ? `${question.stem.slice(0, 140)}…` : question.stem}</span>
        <span className="qitem-marks">
          {question.maxScore} mark{question.maxScore === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          className="quiet"
          aria-expanded={open === question.id}
          aria-label={`Preview question ${label}`}
          onClick={() => setOpen(open === question.id ? null : question.id)}
        >
          <Eye aria-hidden="true" />
          Preview
        </button>
      </div>
      {open === question.id ? (
        <div className="qitem-preview">
          <QuestionView question={question} number={Number(label) || 1} />
        </div>
      ) : null}
    </li>
  );
  return (
    <>
      <section className="card">
        <div className="bar">
          <Target aria-hidden="true" className="inline-icon" />
          <strong>
            {exam.questions.length + (exam.sections ?? []).reduce((s, x) => s + x.pick, 0)} questions · {paperMarks(exam)} marks ·{" "}
            {minutes(exam.policy.durationMs)}
          </strong>
          <span className="spacer" />
          <button type="button" className="secondary" onClick={() => setTrying(true)}>
            <Play aria-hidden="true" />
            Try test
          </button>
          {onEdit === undefined ? null : (
            <button type="button" className="secondary" onClick={onEdit}>
              <Pencil aria-hidden="true" />
              {frozen ? "Copy to change" : "Edit questions"}
            </button>
          )}
        </div>
        {frozen ? <p className="notice">Candidates have sat this exam, so its questions are fixed. Copy it to make a changed version.</p> : null}
        {exam.questions.length === 0 ? null : (
          <>
            <h2 className="card-title">Every candidate gets</h2>
            <ol className="qlist read">{exam.questions.map((q, i) => row(q, String(i + 1)))}</ol>
          </>
        )}
        {(exam.sections ?? []).map((section) => (
          <div key={section.id} className="qsection">
            <h2 className="card-title">
              {section.title || section.id}{" "}
              <span className="notice">
                · each candidate draws {section.pick} of {section.pool.length}
                {section.durationMs === undefined ? "" : ` · ${minutes(section.durationMs)} of its own`}
              </span>
            </h2>
            <ol className="qlist read">{section.pool.map((q, i) => row(q, `${section.id}.${i + 1}`))}</ol>
          </div>
        ))}
      </section>
      {trying ? <TryTest exam={exam} onClose={() => setTrying(false)} /> : null}
    </>
  );
}
