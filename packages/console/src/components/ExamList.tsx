import { useMemo, useState } from "react";
import { Camera, ClipboardList, Copy, Hourglass, Layers, Pencil, Plus, Search, SquareCheckBig, Users } from "lucide-react";
import type { ExamSummary } from "../api.ts";

interface Props {
  readonly exams: readonly ExamSummary[];
  readonly onOpen: (examId: string) => void;
  readonly onEdit: (examId: string) => void;
  readonly onNew: () => void;
  /** Whether this account may author exams; the server refuses it either way. */
  readonly canWrite?: boolean;
  /** Copy an exam, which is how a sat — and so frozen — exam is changed. */
  readonly onClone?: (examId: string) => void;
}

type Filter = "all" | "running" | "grading" | "unsat";

const FILTERS: readonly [Filter, string][] = [
  ["all", "All"],
  ["running", "Sitting now"],
  ["grading", "To grade"],
  ["unsat", "Not yet sat"],
];

const NONE = { invited: 0, inProgress: 0, submitted: 0, graded: 0, void: 0 };
const countsOf = (exam: ExamSummary) => exam.attempts ?? NONE;
const sat = (exam: ExamSummary) => {
  const c = countsOf(exam);
  return c.inProgress + c.submitted + c.graded + c.void;
};

const matches = (exam: ExamSummary, filter: Filter): boolean => {
  const c = countsOf(exam);
  switch (filter) {
    case "running":
      return c.inProgress > 0;
    case "grading":
      return c.submitted > 0;
    case "unsat":
      return sat(exam) === 0;
    default:
      return true;
  }
};

const created = (iso: string | undefined) =>
  iso === undefined ? "" : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/**
 * Every assessment the organisation runs, as a recruiter or an examinations
 * office reads it: how many are sitting now and how many wait on grading,
 * across all of them first, then exam by exam, with what each paper is.
 */
export function ExamList({ exams, onOpen, onEdit, onNew, canWrite = true, onClone }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const totals = useMemo(
    () =>
      exams.reduce(
        (sum, exam) => {
          const c = countsOf(exam);
          return { inProgress: sum.inProgress + c.inProgress, submitted: sum.submitted + c.submitted, graded: sum.graded + c.graded, candidates: sum.candidates + Math.max(c.invited, sat(exam)) };
        },
        { inProgress: 0, submitted: 0, graded: 0, candidates: 0 },
      ),
    [exams],
  );
  const needle = query.trim().toLowerCase();
  const shown = exams.filter((exam) => matches(exam, filter) && (needle === "" || exam.title.toLowerCase().includes(needle)));

  const tiles = [
    { label: "Exams", value: exams.length, icon: ClipboardList, tone: "" },
    { label: "Candidates", value: totals.candidates, icon: Users, tone: "" },
    { label: "Sitting now", value: totals.inProgress, icon: Hourglass, tone: totals.inProgress > 0 ? " live" : "" },
    { label: "To grade", value: totals.submitted, icon: SquareCheckBig, tone: totals.submitted > 0 ? " attention" : "" },
  ];

  return (
    <div className="exams-overview">
      <section className="kpis" aria-label="At a glance">
        {tiles.map(({ label, value, icon: Icon, tone }) => (
          <div className={`kpi${tone}`} key={label}>
            <span className="kpi-icon" aria-hidden="true">
              <Icon />
            </span>
            <span className="kpi-value">{value}</span>
            <span className="kpi-label">{label}</span>
          </div>
        ))}
      </section>

      <section className="card exam-table">
        <div className="bar">
          <strong>Exams</strong>
          <div className="segmented" role="group" aria-label="Show">
            {FILTERS.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
          <span className="spacer" />
          <label className="search">
            <Search aria-hidden="true" />
            <input type="search" aria-label="Search exams" placeholder="Search exams" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {canWrite ? (
            <button type="button" onClick={onNew}>
              <Plus aria-hidden="true" />
              New exam
            </button>
          ) : null}
        </div>

        {exams.length === 0 ? (
          <div className="empty">
            <ClipboardList aria-hidden="true" />
            <p>No exams yet.</p>
            {canWrite ? <p className="notice">Create one from scratch, or draw its questions from the question bank.</p> : null}
          </div>
        ) : shown.length === 0 ? (
          <p className="notice empty-line">No exam matches.</p>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Exam</th>
                  <th scope="col">Questions</th>
                  <th scope="col" className="num">
                    Candidates
                  </th>
                  <th scope="col" className="num">
                    Sitting
                  </th>
                  <th scope="col" className="num">
                    To grade
                  </th>
                  <th scope="col" className="num">
                    Graded
                  </th>
                  <th scope="col">Created</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((exam) => {
                  const c = countsOf(exam);
                  const facts = [
                    exam.durationMs == null ? null : `${Math.round(exam.durationMs / 60_000)} min`,
                    exam.totalMarks == null ? null : `${exam.totalMarks} marks`,
                  ].filter((f): f is string => f !== null);
                  return (
                    <tr key={exam.id}>
                      <td className="exam-cell">
                        <button type="button" className="crumb" onClick={() => onOpen(exam.id)}>
                          {exam.title}
                        </button>
                        <span className="exam-meta">
                          {facts.length > 0 ? <span>{facts.join(" · ")}</span> : null}
                          {(exam.sectionCount ?? 0) > 0 ? (
                            <span className="tag">
                              <Layers aria-hidden="true" />
                              {exam.sectionCount} {exam.sectionCount === 1 ? "section" : "sections"}
                            </span>
                          ) : null}
                          {exam.proctored === true ? (
                            <span className="tag">
                              <Camera aria-hidden="true" />
                              Proctored
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="num">{exam.questionCount}</td>
                      <td className="num">{c.invited > 0 ? c.invited : sat(exam)}</td>
                      <td className="num">{c.inProgress > 0 ? <span className="pill live">{c.inProgress}</span> : <span className="zero">0</span>}</td>
                      <td className="num">{c.submitted > 0 ? <span className="pill attention">{c.submitted}</span> : <span className="zero">0</span>}</td>
                      <td className="num">{c.graded > 0 ? c.graded : <span className="zero">0</span>}</td>
                      <td className="muted">{created(exam.createdAt)}</td>
                      <td className="row-actions">
                        {canWrite ? (
                          <button type="button" className="quiet" onClick={() => onEdit(exam.id)}>
                            <Pencil aria-hidden="true" />
                            Edit
                          </button>
                        ) : null}
                        {canWrite && onClone !== undefined ? (
                          <button type="button" className="quiet" onClick={() => onClone(exam.id)}>
                            <Copy aria-hidden="true" />
                            Copy
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
