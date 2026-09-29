import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Eye, GripVertical, Library, MousePointerClick, Play, Plus, Trash2 } from "lucide-react";
import { validateExam, type Exam, type ExamCutoff, type ExamProblem, type ProctoringPolicy, type Question } from "@parikshaa/core/browser";
import { TabPanel, Tabs, Tooltip } from "@parikshaa/brand/ui";
import { BankPicker, KIND_NAME, type BankLoader } from "./Bank.tsx";
import { EmptyState, PageActions, PageMeta, SettingsGroup } from "./kit.tsx";
import { QuestionView, TryTest } from "./Preview.tsx";
import { QuestionFields, blankQuestion, type ImageUploader } from "./QuestionFields.tsx";

interface Props {
  readonly initial?: Exam;
  readonly saving: boolean;
  readonly serverProblems: readonly ExamProblem[];
  readonly onSave: (exam: Exam) => void;
  readonly onCancel: () => void;
  /** Present when the account may read the bank, to add questions from it. */
  readonly loadBank?: BankLoader;
  /** Uploads a picture for a question or passage. */
  readonly uploadImage?: ImageUploader;
  /** Told whenever the exam differs from what was last saved, so leaving can warn. */
  readonly onDirtyChange?: (dirty: boolean) => void;
}

type Picking = { readonly into: "fixed" } | { readonly into: "section"; readonly index: number } | null;
type Tab = "questions" | "settings";

/** The marks a paper from this exam is out of: every fixed question, and each section's draw. */
export function paperMarks(exam: Exam): number {
  const fixed = exam.questions.reduce((sum, q) => sum + q.maxScore, 0);
  const drawn = (exam.sections ?? []).reduce((sum, s) => sum + s.pick * (s.pool[0]?.maxScore ?? 0), 0);
  return fixed + drawn;
}

const nextId = (exam: Exam): string => {
  const taken = new Set([...exam.questions, ...(exam.sections ?? []).flatMap((s) => s.pool)].map((q) => q.id as string));
  let n = exam.questions.length + 1;
  while (taken.has(`q${n}`)) n += 1;
  return `q${n}`;
};

const short = (stem: string) => (stem.trim() === "" ? "Untitled question" : stem.length > 110 ? `${stem.slice(0, 110)}…` : stem);

const SETTINGS: readonly (readonly [string, string])[] = [
  ["set-timing", "Timing"],
  ["set-cutoff", "Qualifying mark"],
  ["set-tools", "Candidate tools"],
  ["set-coding", "Coding"],
  ["set-proctoring", "Proctoring"],
];

/**
 * Writing an exam, as a test platform lays it out: on a wide screen, the
 * paper as a list of questions beside the one being edited — dragged, or
 * moved up and down, into order, and copied in from the library; below them
 * the sections drawn per candidate. Settings are one page of explained
 * groups. "Try test" sits the paper as a candidate would, and records
 * nothing; a bar at the foot says when there is something to save.
 */
export function ExamEditor({ initial, saving, serverProblems, onSave, onCancel, loadBank, uploadImage, onDirtyChange }: Props) {
  const [picking, setPicking] = useState<Picking>(null);
  const [tab, setTab] = useState<Tab>("questions");
  const [trying, setTrying] = useState(false);
  const [exam, setExam] = useState<Exam>(
    initial ?? {
      id: `exam-${Date.now()}` as Exam["id"],
      title: "",
      questions: [blankQuestion("q1")],
      policy: { durationMs: 60 * 60 * 1000, allowRevision: true, vivaTriggerRatio: 0.5 },
    },
  );
  // A new exam opens on its blank first question; a saved one as a list to scan.
  const [selected, setSelected] = useState<string | null>(initial === undefined ? "q1" : null);
  const [previewing, setPreviewing] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [attempted, setAttempted] = useState(false);
  const detail = useRef<HTMLDivElement>(null);

  // Unsaved: anything that differs from what was opened.
  const baseline = useMemo(() => JSON.stringify(exam), []); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(exam) !== baseline;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const validation = validateExam(exam);
  const problems: readonly ExamProblem[] =
    serverProblems.length > 0 ? serverProblems : validation.ok ? [] : validation.problems;
  const showProblems = attempted || serverProblems.length > 0;

  const patchQuestion = (index: number, next: Question) =>
    setExam((e) => ({ ...e, questions: e.questions.map((q, i) => (i === index ? next : q)) }));
  const moveTo = (from: number, to: number) =>
    setExam((e) => {
      if (to < 0 || to >= e.questions.length || from === to) return e;
      const questions = [...e.questions];
      const [moved] = questions.splice(from, 1);
      questions.splice(to, 0, moved!);
      return { ...e, questions };
    });
  const select = (id: string, preview = false) => {
    setSelected(id);
    setPreviewing(preview);
    // Below two panes the editor is under the list: bring it into view.
    window.requestAnimationFrame?.(() => detail.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }));
  };

  const sections = exam.sections ?? [];
  type Section = (typeof sections)[number];
  const patchSection = (index: number, next: Section) =>
    setExam((e) => ({ ...e, sections: (e.sections ?? []).map((s, i) => (i === index ? next : s)) }));
  const onExam = new Set([...exam.questions, ...sections.flatMap((s) => s.pool)].map((q) => q.id as string));
  const setPolicy = (patch: Partial<Exam["policy"]>) => setExam((e) => ({ ...e, policy: { ...e.policy, ...patch } }));
  const hasCode = [...exam.questions, ...sections.flatMap((s) => s.pool)].some((q) => q.kind === "code");

  const addFromBank = (questions: readonly Question[]) => {
    if (picking?.into === "fixed") {
      setExam((e) => ({ ...e, questions: [...e.questions, ...questions] }));
    } else if (picking?.into === "section") {
      const section = sections[picking.index]!;
      patchSection(picking.index, { ...section, pool: [...section.pool, ...questions] });
    }
    setPicking(null);
  };

  const marks = paperMarks(exam);
  const count = exam.questions.length + sections.reduce((sum, s) => sum + s.pick, 0);
  const cutoff = exam.policy.cutoff;
  const index = selected === null ? -1 : exam.questions.findIndex((q) => (q.id as string) === selected);
  const current = index < 0 ? null : exam.questions[index]!;

  return (
    <form
      className="exam-editor"
      onSubmit={(event) => {
        event.preventDefault();
        setAttempted(true);
        if (validateExam(exam).ok) onSave(exam);
      }}
    >
      <PageMeta>
        <span aria-label="This paper" role="group" className="editor-facts">
          <span>{count} questions</span> · <span>{marks} marks</span> · <span>{Math.round(exam.policy.durationMs / 60000)} min</span> ·{" "}
          <span>{cutoff === undefined ? "no qualifying mark" : `qualifies at ${cutoff.percent}%`}</span>
        </span>
      </PageMeta>
      <PageActions>
        <button type="button" className="secondary" onClick={() => setTrying(true)}>
          <Play aria-hidden="true" />
          Try test
        </button>
      </PageActions>
      {trying ? <TryTest exam={exam} onClose={() => setTrying(false)} /> : null}

      <section className="card editor-head">
        <div className="field">
          <label htmlFor="exam-title">Title</label>
          <input id="exam-title" value={exam.title} onChange={(e) => setExam({ ...exam, title: e.target.value })} />
        </div>
      </section>

      <Tabs
        label="Exam editor"
        idBase="editor"
        value={tab}
        onChange={setTab}
        items={[
          { id: "questions", label: "Questions" },
          { id: "settings", label: "Settings" },
        ]}
      />

      <TabPanel idBase="editor" id="settings" value={tab}>
        <div className="settings-page">
          <nav className="settings-anchors" aria-label="Settings">
            {SETTINGS.filter(([id]) => id !== "set-coding" || hasCode).map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
          <div className="settings-groups">
            <SettingsGroup id="set-timing" title="Timing" description="How long candidates have, and whether an answer can be changed once saved.">
              <div className="grid">
                <div className="field">
                  <label htmlFor="duration">Duration (minutes)</label>
                  <input
                    id="duration"
                    type="number"
                    min={1}
                    value={Math.round(exam.policy.durationMs / 60000)}
                    onChange={(e) => setPolicy({ durationMs: Number(e.target.value) * 60000 })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="revision">Revision</label>
                  <select id="revision" value={String(exam.policy.allowRevision)} onChange={(e) => setPolicy({ allowRevision: e.target.value === "true" })}>
                    <option value="true">Answers may be changed</option>
                    <option value="false">Answers are final</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="ratio">Follow-up from this share of the marks</label>
                  <input
                    id="ratio"
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={exam.policy.vivaTriggerRatio}
                    onChange={(e) => setPolicy({ vivaTriggerRatio: Number(e.target.value) })}
                  />
                  <p className="notice">
                    Answers scoring at or above this fraction are followed up. Below it, the answer is already wrong and its provenance does not matter.
                  </p>
                </div>
              </div>
            </SettingsGroup>

            <SettingsGroup id="set-cutoff" title="Qualifying mark" description="Who qualifies: a share of the whole paper and, for a sectioned exam, of each part.">
              <CutoffFields
                exam={exam}
                onChange={(next) => {
                  const { cutoff: _, ...rest } = exam.policy;
                  setExam({ ...exam, policy: next === undefined ? rest : { ...rest, cutoff: next } });
                }}
              />
            </SettingsGroup>

            <SettingsGroup id="set-tools" title="Candidate tools" description="What a candidate has beside the paper while they answer.">
              <label className="inline">
                <input type="checkbox" checked={exam.policy.calculator === true} onChange={(e) => setPolicy({ calculator: e.target.checked })} /> Offer an on-screen
                scientific calculator
              </label>
            </SettingsGroup>

            {hasCode ? (
              <SettingsGroup id="set-coding" title="Coding" description="What Submit shows on a coding question, and help in the code editor.">
                <div className="grid code-policy">
                  <div className="field">
                    <label htmlFor="test-feedback">Submit shows the candidate</label>
                    <select
                      id="test-feedback"
                      value={exam.policy.testFeedback ?? "all"}
                      onChange={(e) => setPolicy({ testFeedback: e.target.value as "all" | "visible" })}
                    >
                      <option value="all">Every test's verdict, hidden ones without their content</option>
                      <option value="visible">Only the visible tests; hidden ones after the test</option>
                    </select>
                  </div>
                  <label className="inline">
                    <input type="checkbox" checked={exam.policy.codeCompletion === true} onChange={(e) => setPolicy({ codeCompletion: e.target.checked })} /> Offer
                    completion in the code editor
                  </label>
                </div>
              </SettingsGroup>
            ) : null}

            <SettingsGroup id="set-proctoring" title="Proctoring" description="Whether the candidate's camera is used, and what is taken. Off unless you turn it on.">
              <ProctoringFields
                value={exam.policy.proctoring}
                onChange={(proctoring) => {
                  const { proctoring: _, ...rest } = exam.policy;
                  setExam({ ...exam, policy: proctoring === undefined ? rest : { ...rest, proctoring } });
                }}
              />
            </SettingsGroup>
          </div>
        </div>
      </TabPanel>

      <TabPanel idBase="editor" id="questions" value={tab}>
        <div className="editor-panes">
          <div className="editor-list">
            <div className="qlist-head">
              <strong>Every candidate gets</strong>
              <span className="notice">
                {exam.questions.length} question{exam.questions.length === 1 ? "" : "s"} · {exam.questions.reduce((s, q) => s + q.maxScore, 0)} marks
              </span>
            </div>

            <ol className="qlist compact">
              {exam.questions.map((question, i) => {
                const id = question.id as string;
                const on = id === selected;
                return (
                  <li
                    key={id}
                    className={dragging === null ? undefined : dragging === i ? "dragging" : "drop-target"}
                    onDragOver={(event) => {
                      if (dragging === null) return;
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragging !== null) moveTo(dragging, i);
                      setDragging(null);
                    }}
                  >
                    <section className={`qitem${on ? " selected" : ""}`} aria-label={`Question ${i + 1}`}>
                      <span
                        className="drag-handle"
                        draggable
                        aria-hidden="true"
                        title="Drag to reorder"
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", String(i));
                          setDragging(i);
                        }}
                        onDragEnd={() => setDragging(null)}
                      >
                        <GripVertical />
                      </span>
                      <span className="qitem-num" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className="qitem-body">
                        <button type="button" className="qitem-stem" aria-pressed={on} onClick={() => select(id)}>
                          {short(question.stem)}
                        </button>
                        <span className="qitem-sub">
                          <span className="tag">{KIND_NAME[question.kind]}</span>
                          <span className="qitem-marks">
                            {question.maxScore} mark{question.maxScore === 1 ? "" : "s"}
                          </span>
                        </span>
                      </span>
                      <span className="qitem-actions">
                        <Tooltip text="Move up">
                          <button type="button" className="quiet icon" aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => moveTo(i, i - 1)}>
                            <ArrowUp aria-hidden="true" />
                          </button>
                        </Tooltip>
                        <Tooltip text="Move down">
                          <button
                            type="button"
                            className="quiet icon"
                            aria-label={`Move question ${i + 1} down`}
                            disabled={i === exam.questions.length - 1}
                            onClick={() => moveTo(i, i + 1)}
                          >
                            <ArrowDown aria-hidden="true" />
                          </button>
                        </Tooltip>
                        <Tooltip text="Preview as the candidate sees it">
                          <button type="button" className="quiet icon" aria-label={`Preview question ${i + 1}`} onClick={() => select(id, true)}>
                            <Eye aria-hidden="true" />
                          </button>
                        </Tooltip>
                        <Tooltip text="Remove from the paper">
                          <button
                            type="button"
                            className="quiet icon danger-quiet"
                            aria-label={`Remove question ${i + 1}`}
                            disabled={exam.questions.length === 1 && sections.length === 0}
                            onClick={() => {
                              if (on) setSelected(null);
                              setExam((e) => ({ ...e, questions: e.questions.filter((_, j) => j !== i) }));
                            }}
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        </Tooltip>
                      </span>
                    </section>
                  </li>
                );
              })}
            </ol>

            <div className="row">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const id = nextId(exam);
                  setExam((e) => ({ ...e, questions: [...e.questions, blankQuestion(id)] }));
                  select(id);
                }}
              >
                <Plus aria-hidden="true" />
                Add question
              </button>
              {loadBank === undefined ? null : (
                <button type="button" className="secondary" onClick={() => setPicking({ into: "fixed" })}>
                  <Library aria-hidden="true" />
                  Add from bank
                </button>
              )}
            </div>
            {picking?.into === "fixed" && loadBank !== undefined ? (
              <BankPicker load={loadBank} exclude={onExam} onPick={addFromBank} onClose={() => setPicking(null)} />
            ) : null}
          </div>

          <div className="editor-detail" ref={detail}>
            {current === null ? (
              <section className="card">
                <EmptyState icon={MousePointerClick} compact>
                  Choose a question from the list to edit it here, or add one.
                </EmptyState>
              </section>
            ) : (
              <section className="card qitem-editor" aria-label={`Editing question ${index + 1}`}>
                <div className="bar">
                  <strong>Question {index + 1}</strong>
                  <span className="tag">{KIND_NAME[current.kind]}</span>
                  <span className="spacer" />
                  <button type="button" className="quiet" aria-pressed={previewing} onClick={() => setPreviewing(!previewing)}>
                    <Eye aria-hidden="true" />
                    {previewing ? "Back to editing" : "Preview"}
                  </button>
                  <button type="button" className="quiet" onClick={() => setSelected(null)}>
                    Done
                  </button>
                </div>
                {previewing ? (
                  <div className="qitem-preview" aria-label={`Preview of question ${index + 1}`} role="group">
                    <QuestionView question={current} number={index + 1} />
                  </div>
                ) : (
                  <div className="qitem-fields">
                    <QuestionFields
                      key={current.id}
                      question={current}
                      onChange={(next) => patchQuestion(index, next)}
                      {...(uploadImage === undefined ? {} : { upload: uploadImage })}
                      {...(exam.questions[index - 1]?.passage === undefined ? {} : { previousPassage: exam.questions[index - 1]!.passage! })}
                    />
                  </div>
                )}
              </section>
            )}
          </div>
        </div>

        {/*
         * Sections: each candidate draws `pick` questions from the pool, seeded
         * by their attempt, so neighbours sit different papers. The pool is a
         * copy; questions in it are edited in the bank and added again.
         */}
        {sections.map((section, index) => (
          <section className="card" key={section.id} aria-label={`Section ${index + 1}`}>
            <div className="bar">
              <strong>Section {index + 1}</strong>
              <span className="spacer" />
              <button
                type="button"
                className="quiet"
                onClick={() =>
                  setExam((e) => {
                    const cutoff = e.policy.cutoff;
                    const { [section.id]: _, ...minimums } = cutoff?.sections ?? {};
                    const { sections: __, ...overall } = cutoff ?? { percent: 0 };
                    return {
                      ...e,
                      sections: (e.sections ?? []).filter((_, i) => i !== index),
                      policy:
                        cutoff === undefined ? e.policy : { ...e.policy, cutoff: Object.keys(minimums).length === 0 ? overall : { ...overall, sections: minimums } },
                    };
                  })
                }
              >
                Remove section
              </button>
            </div>
            <div className="grid">
              <div className="field">
                <label htmlFor={`section-title-${section.id}`}>Section title</label>
                <input id={`section-title-${section.id}`} value={section.title} onChange={(e) => patchSection(index, { ...section, title: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`section-pick-${section.id}`}>Questions per candidate</label>
                <input
                  id={`section-pick-${section.id}`}
                  type="number"
                  min={1}
                  max={Math.max(1, section.pool.length)}
                  value={section.pick}
                  onChange={(e) => patchSection(index, { ...section, pick: Number(e.target.value) })}
                />
              </div>
              <div className="field">
                <label htmlFor={`section-time-${section.id}`}>Own time (minutes)</label>
                <input
                  id={`section-time-${section.id}`}
                  type="number"
                  min={1}
                  placeholder="None"
                  value={section.durationMs === undefined ? "" : section.durationMs / 60_000}
                  onChange={(e) => {
                    const { durationMs: _, ...rest } = section;
                    patchSection(index, e.target.value === "" ? rest : { ...rest, durationMs: Number(e.target.value) * 60_000 });
                  }}
                />
              </div>
            </div>
            <p className="notice">
              Each candidate draws {section.pick} of these {section.pool.length}. Every question in the pool must carry the same marks, so every paper is
              worth the same.
              {section.durationMs === undefined
                ? null
                : ` Once any section has its own time, the test is taken section by section, in order: each is locked once left, and closes when its ${section.durationMs / 60_000} minutes are up.`}
            </p>
            <ul className="pool">
              {section.pool.map((question) => (
                <li key={question.id}>
                  <span className="tag">{KIND_NAME[question.kind]}</span> <span>{question.stem}</span>{" "}
                  <span className="notice">· {question.maxScore} marks</span>{" "}
                  <button
                    type="button"
                    className="quiet"
                    aria-label={`Remove "${question.stem}" from the pool`}
                    onClick={() => patchSection(index, { ...section, pool: section.pool.filter((q) => q.id !== question.id) })}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {loadBank === undefined ? null : (
              <div className="row">
                <button type="button" className="secondary" onClick={() => setPicking({ into: "section", index })}>
                  <Library aria-hidden="true" />
                  Add from bank
                </button>
              </div>
            )}
            {picking?.into === "section" && picking.index === index && loadBank !== undefined ? (
              <BankPicker load={loadBank} exclude={onExam} onPick={addFromBank} onClose={() => setPicking(null)} />
            ) : null}
          </section>
        ))}

        <div className="row">
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setExam((e) => ({
                ...e,
                sections: [...(e.sections ?? []), { id: `s${(e.sections ?? []).length + 1}`, title: "", pick: 1, pool: [] }],
              }))
            }
          >
            Add a section drawn per candidate
          </button>
        </div>
      </TabPanel>

      {showProblems && problems.length > 0 ? (
        <ul className="problems" aria-label="Problems with this exam">
          {problems.map((problem) => (
            <li key={`${problem.path}:${problem.message}`}>
              <span className="mono">{problem.path}</span> — {problem.message}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Always in reach at the foot of the page, and says when there is something to save. */}
      <div className={`save-bar${dirty ? " dirty" : ""}`}>
        <span className="save-state" role="status">
          {dirty ? "Unsaved changes" : initial === undefined ? "Not saved yet" : "No changes"}
        </span>
        <span className="spacer" />
        <button type="button" className="quiet" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save exam"}
        </button>
      </div>
    </form>
  );
}

/**
 * The qualifying mark: a share of the whole paper and, for a sectioned exam,
 * optionally of each part. Results then say who qualified; a person still
 * decides what happens next.
 */
function CutoffFields({ exam, onChange }: { exam: Exam; onChange: (next: ExamCutoff | undefined) => void }) {
  const cutoff = exam.policy.cutoff;
  const sections = exam.sections ?? [];
  const parts = sections.length === 0 ? [] : [...(exam.questions.length > 0 ? [{ id: "", title: "General (every candidate's questions)" }] : []), ...sections.map((s) => ({ id: s.id, title: s.title || s.id }))];
  const setSection = (id: string, value: string) => {
    if (cutoff === undefined) return;
    const { [id]: _, ...rest } = cutoff.sections ?? {};
    const next = value === "" ? rest : { ...rest, [id]: Number(value) };
    const { sections: __, ...base } = cutoff;
    onChange(Object.keys(next).length === 0 ? base : { ...base, sections: next });
  };
  return (
    <>
      <label className="inline">
        <input type="checkbox" checked={cutoff !== undefined} onChange={(e) => onChange(e.target.checked ? { percent: 60 } : undefined)} /> Set a qualifying mark
      </label>
      {cutoff === undefined ? (
        <p className="notice">Off: results show marks only, with no one marked as qualified or not.</p>
      ) : (
        <>
          <div className="grid">
            <div className="field">
              <label htmlFor="cutoff-percent">Qualifying mark (% of the paper)</label>
              <input id="cutoff-percent" type="number" min={0} max={100} step={0.5} value={cutoff.percent} onChange={(e) => onChange({ ...cutoff, percent: Number(e.target.value) })} />
            </div>
            {parts.map((part) => (
              <div className="field" key={part.id}>
                <label htmlFor={`cutoff-section-${part.id || "general"}`}>Minimum in {part.title} (%)</label>
                <input
                  id={`cutoff-section-${part.id || "general"}`}
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  placeholder="None"
                  value={cutoff.sections?.[part.id] ?? ""}
                  onChange={(e) => setSection(part.id, e.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="notice">
            A candidate qualifies at {cutoff.percent}% or more of their paper
            {Object.keys(cutoff.sections ?? {}).length > 0 ? ", and the minimum in every section that has one" : ""}. Results and the scorecard say
            Qualified or Not qualified; nothing is sent to anyone because of it.
          </p>
        </>
      )}
    </>
  );
}

/**
 * Camera proctoring (ROADMAP §14), off unless the author turns it on. Each
 * piece is an observation for a person; candidates are told exactly what is
 * taken before their clock starts.
 */
function ProctoringFields({ value, onChange }: { value: ProctoringPolicy | undefined; onChange: (next: ProctoringPolicy | undefined) => void }) {
  const on = value !== undefined;
  const policy: ProctoringPolicy = value ?? { identity: true, snapshotEverySeconds: 60, browserEvents: true };
  return (
    <fieldset className="proctoring">
      <legend className="visually-hidden">Proctoring</legend>
      <label className="inline">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? policy : undefined)} /> Use the candidate's camera
      </label>
      {on ? (
        <div className="grid">
          <label className="inline">
            <input type="checkbox" checked={policy.identity} onChange={(e) => onChange({ ...policy, identity: e.target.checked })} /> Photo of the candidate and
            their ID before they start
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={policy.snapshotEverySeconds !== null}
              onChange={(e) => onChange({ ...policy, snapshotEverySeconds: e.target.checked ? 60 : null })}
            />{" "}
            Webcam photos while they answer
          </label>
          {policy.snapshotEverySeconds === null ? null : (
            <div className="field">
              <label htmlFor="snapshot-every">Every (seconds)</label>
              <input
                id="snapshot-every"
                type="number"
                min={15}
                max={900}
                value={policy.snapshotEverySeconds}
                onChange={(e) => onChange({ ...policy, snapshotEverySeconds: Number(e.target.value) })}
              />
            </div>
          )}
          <label className="inline">
            <input type="checkbox" checked={policy.browserEvents} onChange={(e) => onChange({ ...policy, browserEvents: e.target.checked })} /> Record leaving
            the tab or full screen, copy and paste
          </label>
        </div>
      ) : (
        <p className="notice">Off: the test uses no camera, and records nothing about the candidate's browser.</p>
      )}
      {on ? <p className="notice">Candidates are told all of this before their clock starts. Nothing here marks anyone down by itself.</p> : null}
    </fieldset>
  );
}
