import { useState } from "react";
import { Archive, ArchiveRestore, Camera, ClipboardList, Copy, Layers, Pencil, Play, Plus, Search } from "lucide-react";
import type { ExamSummary } from "../api.ts";
import { EmptyState, PageActions, PhaseBadge, RowMenu, phaseOf, type Phase } from "./kit.tsx";

export type ExamFilter = "all" | "open" | "grading" | "scheduled" | "draft" | "closed" | "archived";

interface Props {
  readonly exams: readonly ExamSummary[];
  readonly onOpen: (examId: string) => void;
  readonly onEdit: (examId: string) => void;
  readonly onNew: () => void;
  /** Whether this account may author exams; the server refuses it either way. */
  readonly canWrite?: boolean;
  /** Copy an exam, which is how a sat — and so frozen — exam is changed. */
  readonly onClone?: (examId: string) => void;
  /** Open the exam and try it as a candidate would. */
  readonly onTry?: (examId: string) => void;
  /** Put an exam away, or bring it back. */
  readonly onArchive?: (examId: string, archived: boolean) => void;
  /** Where the list starts: Home's "To grade" opens it on the exams to grade. */
  readonly initialFilter?: ExamFilter;
  readonly now?: number;
}

const FILTERS: readonly [ExamFilter, string][] = [
  ["all", "All"],
  ["open", "Open now"],
  ["grading", "To grade"],
  ["scheduled", "Scheduled"],
  ["draft", "Draft"],
  ["closed", "Closed"],
  ["archived", "Archived"],
];

const NONE = { invited: 0, inProgress: 0, submitted: 0, graded: 0, void: 0 };
const countsOf = (exam: ExamSummary) => exam.attempts ?? NONE;
const sat = (exam: ExamSummary) => {
  const c = countsOf(exam);
  return c.inProgress + c.submitted + c.graded + c.void;
};
const archived = (exam: ExamSummary) => (exam.archivedAt ?? null) !== null;

const matches = (exam: ExamSummary, filter: ExamFilter, phase: Phase): boolean => {
  if (filter === "archived") return archived(exam);
  if (archived(exam)) return false;
  switch (filter) {
    case "grading":
      return countsOf(exam).submitted > 0;
    case "open":
    case "scheduled":
    case "draft":
    case "closed":
      return phase === filter;
    default:
      return true;
  }
};

const created = (iso: string | undefined) =>
  iso === undefined ? "" : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

/**
 * Every assessment the organisation runs, found quickly and read at a
 * glance: where each is in its life, and which need someone — sitting now,
 * or waiting to be graded. The headline figures are on Home, not here too.
 */
export function ExamList({ exams, onOpen, onEdit, onNew, canWrite = true, onClone, onTry, onArchive, initialFilter = "all", now = Date.now() }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ExamFilter>(initialFilter);

  const phases = new Map(exams.map((exam) => [exam.id, phaseOf(exam, now)]));
  const phase = (exam: ExamSummary) => phases.get(exam.id)!;
  const count = (id: ExamFilter) => exams.filter((exam) => matches(exam, id, phase(exam))).length;
  const needle = query.trim().toLowerCase();
  const shown = exams.filter((exam) => matches(exam, filter, phase(exam)) && (needle === "" || exam.title.toLowerCase().includes(needle)));

  return (
    <div className="exams-overview">
      {canWrite ? (
        <PageActions>
          <button type="button" onClick={onNew}>
            <Plus aria-hidden="true" />
            New exam
          </button>
        </PageActions>
      ) : null}

      {exams.length === 0 ? (
        <section className="card">
          <EmptyState icon={ClipboardList} action={canWrite ? { label: "New exam", onClick: onNew, icon: Plus } : undefined}>
            Your organisation's exams appear here. Write one from scratch, or draw its questions from the question bank.
          </EmptyState>
        </section>
      ) : (
        <section className="card exam-table" aria-label="Exams">
          <div className="bar filter-bar">
            <div className="chips" role="group" aria-label="Show">
              {FILTERS.filter(([id]) => id === "all" || id === filter || count(id) > 0).map(([id, label]) => (
                <button key={id} type="button" className="chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>
                  {label}
                  <span className="chip-count">{count(id)}</span>
                </button>
              ))}
            </div>
            <span className="spacer" />
            <label className="search">
              <Search aria-hidden="true" />
              <input type="search" aria-label="Search exams" placeholder="Search exams" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon={Search}
              compact
              action={needle !== "" ? { label: "Clear the search", onClick: () => setQuery("") } : filter !== "all" ? { label: "Show all exams", onClick: () => setFilter("all") } : undefined}
            >
              {needle !== "" ? `No exam matches “${query.trim()}”.` : "No exam is in this state just now."}
            </EmptyState>
          ) : (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Exam</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="num">
                      Questions
                    </th>
                    <th scope="col" className="num">
                      Candidates
                    </th>
                    <th scope="col" className="num">
                      In progress
                    </th>
                    <th scope="col" className="num">
                      To grade
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
                    const frozen = sat(exam) > 0;
                    const facts = [
                      exam.durationMs == null ? null : `${Math.round(exam.durationMs / 60_000)} min`,
                      exam.totalMarks == null ? null : `${exam.totalMarks} marks`,
                    ].filter((f): f is string => f !== null);
                    const standing = [c.inProgress > 0 ? `${c.inProgress} in progress` : null, c.submitted > 0 ? `${c.submitted} to grade` : null].filter(
                      (f): f is string => f !== null,
                    );
                    return (
                      <tr
                        key={exam.id}
                        className="opens"
                        onClick={(event) => {
                          // The title's own button, and the row's menu, speak for themselves.
                          if (!(event.target as HTMLElement).closest("button, a, [role='menu']")) onOpen(exam.id);
                        }}
                      >
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
                          {/* On a phone the row is a card: its standing in words, under the title. */}
                          <span className="exam-standing">{standing.length === 0 ? `${exam.questionCount} questions` : standing.join(" · ")}</span>
                        </td>
                        <td className="exam-status">
                          {archived(exam) ? <span className="pill">Archived</span> : <PhaseBadge phase={phase(exam)} />}
                        </td>
                        <td className="num wide-only">{exam.questionCount}</td>
                        <td className="num wide-only">{c.invited > 0 ? c.invited : sat(exam)}</td>
                        <td className="num wide-only">{c.inProgress > 0 ? <strong className="figure-live">{c.inProgress}</strong> : <span className="zero">0</span>}</td>
                        <td className="num wide-only">{c.submitted > 0 ? <strong className="figure-attention">{c.submitted}</strong> : <span className="zero">0</span>}</td>
                        <td className="muted wide-only">{created(exam.createdAt)}</td>
                        <td className="row-end">
                          <RowMenu
                            of={exam.title}
                            items={[
                              canWrite && {
                                label: "Edit",
                                icon: <Pencil />,
                                onSelect: () => onEdit(exam.id),
                                ...(frozen ? { disabled: "Sat by candidates, so fixed. Make a copy to change it." } : {}),
                              },
                              canWrite && onClone !== undefined && { label: frozen ? "Copy to change" : "Make a copy", icon: <Copy />, onSelect: () => onClone(exam.id) },
                              onTry !== undefined && { label: "Try test", icon: <Play />, onSelect: () => onTry(exam.id) },
                              canWrite &&
                                onArchive !== undefined &&
                                (archived(exam)
                                  ? { label: "Bring back from the archive", icon: <ArchiveRestore />, onSelect: () => onArchive(exam.id, false) }
                                  : { label: "Archive", icon: <Archive />, onSelect: () => onArchive(exam.id, true), danger: true }),
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
