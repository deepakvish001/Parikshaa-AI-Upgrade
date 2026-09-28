import { useState, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  CircleCheck,
  CircleDot,
  CircleX,
  Copy,
  Eye,
  Mail,
  Pencil,
  Play,
  Send,
  SquareCheckBig,
  UserPlus,
} from "lucide-react";
import type { Exam } from "@parikshaa/core/browser";
import { Drawer } from "@parikshaa/brand/ui";
import type { ExamSummary, Results } from "../api.ts";
import { KIND_NAME } from "./Bank.tsx";
import { paperMarks } from "./ExamEditor.tsx";
import { QuestionView } from "./Preview.tsx";
import { Banner, PageActions, PageMeta, PageStatus, PhaseBadge, RowMenu, phaseOf } from "./kit.tsx";

/**
 * One exam, as a test platform's test page: a header with where it stands
 * and what to do next, tabs for everything about it — who is sitting it, its
 * questions, invitations, the live room, results — and down the side where
 * its candidates stand.
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
const IST = "Asia/Kolkata";
/** "1 Oct, 10:00 am IST" */
export const whenIst = (iso: string) =>
  `${new Intl.DateTimeFormat("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso)).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toLowerCase()}`)} IST`;

/** When it can be sat, in a few words, for the header's meta line. */
export function windowWords(summary: ExamSummary, now: number): string | null {
  const w = summary.window ?? null;
  if (w === null) return null;
  if (now < Date.parse(w.opensAt)) return `Opens ${whenIst(w.opensAt)}`;
  if (now < Date.parse(w.closesAt)) return `Open until ${whenIst(w.closesAt)}`;
  return `Closed ${whenIst(w.closesAt)}`;
}

export interface ExamActions {
  /** Try the test as a candidate would; nothing is recorded. */
  readonly onTry?: () => void;
  /** To the Candidates tab, to schedule and invite. */
  readonly onInvite?: () => void;
  readonly onEdit?: () => void;
  readonly onCopy?: () => void;
  readonly onArchive?: (archived: boolean) => void;
  /** Start one attempt by reference, and hand over its access code. */
  readonly onStartDirect?: () => void;
}

/**
 * The exam's part of the page header: its lifecycle chip, one meta line
 * ("Opens 1 Oct, 10:00 am IST · 60 min · 22 marks · qualifies at 50%"), and
 * Try test, Invite and "⋯". `quiet` leaves only "⋯", for a tab whose own
 * actions fill the header (Results' downloads).
 */
export function ExamHeader({
  summary,
  frozen,
  actions,
  quiet = false,
  now = Date.now(),
}: {
  summary: ExamSummary | undefined;
  frozen: boolean;
  actions: ExamActions;
  quiet?: boolean;
  now?: number;
}) {
  if (summary === undefined) return null;
  const archived = (summary.archivedAt ?? null) !== null;
  const facts = [
    windowWords(summary, now) ?? "No window set",
    summary.durationMs == null ? null : minutes(summary.durationMs),
    summary.totalMarks == null ? null : `${summary.totalMarks} marks`,
    summary.cutoffPercent == null ? null : `qualifies at ${summary.cutoffPercent}%`,
  ].filter((f): f is string => f !== null);
  return (
    <>
      <PageStatus>
        {archived ? <span className="pill">Archived</span> : null}
        <PhaseBadge phase={phaseOf(summary, now)} />
      </PageStatus>
      <PageMeta>
        <span>{facts.join(" · ")}</span>
      </PageMeta>
      <PageActions>
        {quiet || actions.onTry === undefined ? null : (
          <button type="button" className="secondary" onClick={actions.onTry}>
            <Play aria-hidden="true" />
            Try test
          </button>
        )}
        {quiet || actions.onInvite === undefined ? null : (
          <button type="button" onClick={actions.onInvite}>
            <Send aria-hidden="true" />
            Invite
          </button>
        )}
        <RowMenu
          of={summary.title}
          items={[
            actions.onEdit !== undefined && !frozen && { label: "Edit", icon: <Pencil />, onSelect: actions.onEdit },
            actions.onCopy !== undefined && { label: frozen ? "Copy to change" : "Make a copy", icon: <Copy />, onSelect: actions.onCopy },
            actions.onStartDirect !== undefined && { label: "Start an attempt by reference…", icon: <UserPlus />, onSelect: actions.onStartDirect },
            actions.onArchive !== undefined &&
              (archived
                ? { label: "Bring back from the archive", icon: <ArchiveRestore />, onSelect: () => actions.onArchive!(false) }
                : { label: "Archive", icon: <Archive />, onSelect: () => actions.onArchive!(true), danger: true }),
          ]}
        />
      </PageActions>
    </>
  );
}

/**
 * The one thing missing, when something is: no window, no one invited, or
 * answers waiting to be graded. Nothing when the exam is on its way.
 */
export function NextStep({ summary, now = Date.now(), onSchedule, onInvite, onGrade }: { summary: ExamSummary | undefined; now?: number; onSchedule?: () => void; onInvite?: () => void; onGrade?: () => void }) {
  if (summary === undefined) return null;
  const c = summary.attempts ?? { invited: 0, inProgress: 0, submitted: 0, graded: 0, void: 0 };
  const sat = c.inProgress + c.submitted + c.graded + c.void;
  const step =
    c.submitted > 0 && onGrade !== undefined
      ? { icon: SquareCheckBig, text: `${c.submitted} ${c.submitted === 1 ? "answer sheet" : "answer sheets"} to grade`, action: "See results", go: onGrade }
      : (summary.window ?? null) === null && sat === 0 && onSchedule !== undefined
        ? { icon: CalendarDays, text: "No window set yet", action: "Schedule a sitting", go: onSchedule }
        : c.invited === 0 && sat === 0 && onInvite !== undefined && phaseOf(summary, now) !== "closed"
          ? { icon: Mail, text: "No one invited yet", action: "Invite candidates", go: onInvite }
          : null;
  if (step === null) return null;
  const Icon = step.icon;
  return (
    <section className="card next-step" aria-label="Next step">
      <Icon aria-hidden="true" className="next-icon" />
      <p>
        <span className="next-label">Next step</span>
        {step.text}
      </p>
      <button type="button" className="secondary" onClick={step.go}>
        {step.action}
      </button>
    </section>
  );
}

/**
 * Where the exam's candidates stand, as counts down the side of its page, in
 * the glossary's words. Qualified and not qualified appear once the exam has
 * a qualifying mark.
 */
export function ExamSide({
  summary,
  exam,
  results,
  onResults,
}: {
  summary: ExamSummary | undefined;
  exam: Exam | undefined;
  results: Results | undefined;
  onResults?: () => void;
}) {
  const c = summary?.attempts ?? { invited: 0, inProgress: 0, submitted: 0, graded: 0, void: 0 };
  const cutoff = exam?.policy.cutoff;
  const hasCutoff = cutoff !== undefined || (summary?.cutoffPercent ?? null) !== null;
  const qualified = results?.analytics.qualified ?? null;
  const failed = results?.analytics.failed ?? null;
  const counts: readonly { label: string; value: number | string; icon: typeof Mail; tone?: string }[] = [
    { label: "Invited", value: c.invited, icon: Mail },
    { label: "In progress", value: c.inProgress, icon: CircleDot, ...(c.inProgress > 0 ? { tone: "live" } : {}) },
    { label: "Submitted", value: c.submitted + c.graded, icon: Send },
    { label: "To grade", value: c.submitted, icon: SquareCheckBig, ...(c.submitted > 0 ? { tone: "attention" } : {}) },
    ...(hasCutoff
      ? [
          { label: "Qualified", value: qualified ?? "—", icon: CircleCheck, tone: "ok" },
          { label: "Not qualified", value: failed ?? "—", icon: CircleX, tone: "bad" },
        ]
      : []),
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
        {hasCutoff ? null : <p className="notice small">No qualifying mark is set, so results show marks only.</p>}
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

const marksOf = (n: number) => `${n} mark${n === 1 ? "" : "s"}`;

/**
 * The exam's questions, read-only, grouped as candidates get them: every
 * candidate's questions, then each section with its draw and its marks. A
 * preview opens beside the list, as the candidate will see the question.
 */
export function QuestionsTab({ exam, frozen, onEdit }: { exam: Exam; frozen: boolean; onEdit?: () => void }) {
  const [open, setOpen] = useState<{ question: Exam["questions"][number]; label: string } | null>(null);
  const fixedMarks = exam.questions.reduce((sum, q) => sum + q.maxScore, 0);
  const row = (question: Exam["questions"][number], label: string) => (
    <li key={question.id} className="qread">
      <div className="qitem-row">
        <span className="qitem-num" aria-hidden="true">
          {label}
        </span>
        <span className="tag">{KIND_NAME[question.kind]}</span>
        <span className="qitem-stem static">{question.stem.length > 140 ? `${question.stem.slice(0, 140)}…` : question.stem}</span>
        <span className="qitem-marks">{marksOf(question.maxScore)}</span>
        <button type="button" className="quiet" aria-haspopup="dialog" aria-label={`Preview question ${label}`} onClick={() => setOpen({ question, label })}>
          <Eye aria-hidden="true" />
          Preview
        </button>
      </div>
    </li>
  );
  return (
    <>
      {frozen ? (
        <Banner
          tone="info"
          title="Candidates have sat this exam, so its questions are fixed."
          action={
            onEdit === undefined ? undefined : (
              <button type="button" className="secondary" onClick={onEdit}>
                <Copy aria-hidden="true" />
                Copy to change
              </button>
            )
          }
        >
          Copy it to make a changed version; the copy starts with no attempts.
        </Banner>
      ) : null}
      {exam.questions.length === 0 ? null : (
        <section className="card qgroup" aria-labelledby="qgroup-all">
          <div className="bar">
            <h2 className="card-title" id="qgroup-all">
              Every candidate gets
            </h2>
            <span className="notice">
              {exam.questions.length} {exam.questions.length === 1 ? "question" : "questions"} · {marksOf(fixedMarks)}
            </span>
            <span className="spacer" />
            {onEdit === undefined || frozen ? null : (
              <button type="button" className="secondary" onClick={onEdit}>
                <Pencil aria-hidden="true" />
                Edit questions
              </button>
            )}
          </div>
          <ol className="qlist read">{exam.questions.map((q, i) => row(q, String(i + 1)))}</ol>
        </section>
      )}
      {(exam.sections ?? []).map((section, index) => (
        <section key={section.id} className="card qgroup" aria-labelledby={`qgroup-${section.id}`}>
          <div className="bar">
            <h2 className="card-title" id={`qgroup-${section.id}`}>
              {section.title || section.id}
            </h2>
            <span className="notice">
              {section.pick} of {section.pool.length}
              {section.durationMs === undefined ? "" : `, ${minutes(section.durationMs)}`} · {marksOf(section.pick * (section.pool[0]?.maxScore ?? 0))}
            </span>
            <span className="spacer" />
            {index === 0 && exam.questions.length === 0 && onEdit !== undefined && !frozen ? (
              <button type="button" className="secondary" onClick={onEdit}>
                <Pencil aria-hidden="true" />
                Edit questions
              </button>
            ) : null}
          </div>
          <p className="notice small qgroup-note">Each candidate draws {section.pick} of these at random.</p>
          <ol className="qlist read">{section.pool.map((q, i) => row(q, `${section.id}.${i + 1}`))}</ol>
        </section>
      ))}
      {open === null ? null : (
        <Drawer label={`Question ${open.label}`} onClose={() => setOpen(null)} className="qpreview-drawer">
          <div className="drawer-head">
            <strong>Preview</strong>
            <span className="notice">as candidates see it; the right answer is marked</span>
            <span className="spacer" />
            <button type="button" className="quiet icon" aria-label="Close" onClick={() => setOpen(null)}>
              ×
            </button>
          </div>
          <div className="drawer-body">
            <QuestionView question={open.question} number={Number(open.label) || 1} />
          </div>
        </Drawer>
      )}
    </>
  );
}
